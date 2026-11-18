-- Run once on a new Supabase project, then import the optional starter seed.sql.
begin;

create table public.editor_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.editor_accounts enable row level security;
revoke all on public.editor_accounts from anon, authenticated;
grant select on public.editor_accounts to authenticated;
create policy "editors can see their own role" on public.editor_accounts for select to authenticated
  using (user_id = (select auth.uid()));

create table public.entries (
  slug text primary key check (length(slug) between 1 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null check (kind in ('article', 'video')),
  subject text not null check (subject in ('zoology', 'botany', 'environment')),
  title text not null check (length(title) between 1 and 140),
  excerpt text not null default '' check (length(excerpt) <= 280),
  body text not null default '' check (length(body) <= 75000),
  image_url text not null default '' check (length(image_url) <= 2048),
  image_alt text not null default '' check (length(image_alt) <= 240),
  video_url text not null default '' check (length(video_url) <= 500),
  duration text not null default '' check (length(duration) <= 16),
  published_at timestamptz,
  read_minutes integer generated always as (greatest(1, ceil(cardinality(regexp_split_to_array(trim(body), '\s+')) / 165.0)::integer)) stored
);
create index entries_published_idx on public.entries (published_at desc) where published_at is not null;
create index entries_subject_kind_idx on public.entries (subject, kind, published_at desc) where published_at is not null;
alter table public.entries enable row level security;
revoke all on public.entries from anon, authenticated;
grant select on public.entries to anon, authenticated;
grant insert, update on public.entries to authenticated;
create policy "published material is public" on public.entries for select to anon, authenticated
  using (published_at <= now());
create policy "editors can read drafts" on public.entries for select to authenticated
  using (exists (select 1 from public.editor_accounts where user_id = (select auth.uid())));
create policy "editors can create entries" on public.entries for insert to authenticated
  with check (exists (select 1 from public.editor_accounts where user_id = (select auth.uid())));
create policy "editors can edit entries" on public.entries for update to authenticated
  using (exists (select 1 from public.editor_accounts where user_id = (select auth.uid())))
  with check (exists (select 1 from public.editor_accounts where user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-images', 'entry-images', true, 5242880, array['image/webp', 'image/png', 'image/jpeg', 'image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "editors can upload images to their folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.editor_accounts where user_id = (select auth.uid())));

create table public.student_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null check (length(item_key) <= 88 and item_key ~ '^(article|video):[a-z0-9]+(-[a-z0-9]+)*$'),
  saved boolean not null default false,
  completed boolean not null default false,
  changed bigint not null check (changed > 0),
  primary key (user_id, item_key)
);
alter table public.student_progress enable row level security;
revoke all on public.student_progress from anon, authenticated;
grant select, insert, update on public.student_progress to authenticated;
create policy "students can see their own progress" on public.student_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy "students can add their own progress" on public.student_progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "students can update their own progress" on public.student_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.merge_student_progress(p_user uuid, p_items jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is distinct from p_user or p_user is null then raise exception 'Invalid user'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then raise exception 'Invalid batch'; end if;
  insert into public.student_progress as current_items (user_id, item_key, saved, completed, changed)
    select p_user, x.item_key, x.saved, x.completed, x.changed
    from jsonb_to_recordset(p_items) as x(item_key text, saved boolean, completed boolean, changed bigint)
    where x.changed <= (extract(epoch from now()) * 1000)::bigint + 300000
    on conflict (user_id, item_key) do update
      set saved = excluded.saved, completed = excluded.completed, changed = excluded.changed
      where excluded.changed >= current_items.changed;
end;
$$;
revoke all on function public.merge_student_progress(uuid, jsonb) from public, anon;
grant execute on function public.merge_student_progress(uuid, jsonb) to authenticated;

create table public.guru_counters (
  bucket text primary key,
  hits integer not null check (hits >= 0),
  expires_at timestamptz not null
);
create index guru_expiry_idx on public.guru_counters (expires_at);
alter table public.guru_counters enable row level security;
revoke all on public.guru_counters from public, anon, authenticated;
grant select, insert, update, delete on public.guru_counters to service_role;

create function public.take_guru_slot(p_bucket text, p_cap integer, p_expiry timestamptz) returns integer
language sql security invoker set search_path = '' as $$
  insert into public.guru_counters as counters (bucket, hits, expires_at) values (p_bucket, 1, p_expiry)
  on conflict (bucket) do update set
    hits = case when counters.expires_at <= now() then 1 else counters.hits + 1 end,
    expires_at = case when counters.expires_at <= now() then excluded.expires_at else counters.expires_at end
    where counters.expires_at <= now() or counters.hits < p_cap
  returning hits;
$$;
revoke all on function public.take_guru_slot(text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.take_guru_slot(text, integer, timestamptz) to service_role;

create function public.reserve_guru_request(p_guest uuid, p_user uuid, p_ip text, p_daily_limit integer) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  already_used integer;
  new_count integer;
  minute_end timestamptz := date_trunc('minute', now()) + interval '1 minute';
  utc_day_end timestamptz := (date_trunc('day', now() at time zone 'UTC') + interval '1 day') at time zone 'UTC';
begin
  if (p_guest is null) = (p_user is null) then raise exception 'Missing or ambiguous identity'; end if;
  if p_guest is not null then
    select hits into already_used from public.guru_counters where bucket = 'guest:' || p_guest::text and expires_at > now();
    if already_used >= 2 then return jsonb_build_object('status', 'guest', 'remaining', 0); end if;
  end if;
  if public.take_guru_slot('ip:' || p_ip, 45, minute_end) is null then
    return jsonb_build_object('status', 'rate', 'remaining', null);
  end if;
  if p_user is not null and public.take_guru_slot('user:' || p_user::text, 10, minute_end) is null then
    return jsonb_build_object('status', 'rate', 'remaining', null);
  end if;
  if public.take_guru_slot('global', greatest(1, least(p_daily_limit, 1000000)), utc_day_end) is null then
    return jsonb_build_object('status', 'busy', 'remaining', null);
  end if;
  if p_guest is not null then
    new_count := public.take_guru_slot('guest:' || p_guest::text, 2, now() + interval '365 days');
    if new_count is null then return jsonb_build_object('status', 'guest', 'remaining', 0); end if;
    return jsonb_build_object('status', 'ok', 'remaining', 2 - new_count);
  end if;
  return jsonb_build_object('status', 'ok', 'remaining', null);
end;
$$;
revoke all on function public.reserve_guru_request(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_guru_request(uuid, uuid, text, integer) to service_role;

create function public.refund_guru_guest(p_guest uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.guru_counters set hits = greatest(0, hits - 1) where bucket = 'guest:' || p_guest::text and expires_at > now();
$$;
revoke all on function public.refund_guru_guest(uuid) from public, anon, authenticated;
grant execute on function public.refund_guru_guest(uuid) to service_role;

commit;
