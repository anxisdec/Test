import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { validateEntry } from '@/lib/content';
import { readJson, sameOrigin } from '@/lib/http';
import { sessionDatabase } from '@/lib/supabase-server';

function reply(payload: object, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: 'Use the Cellula editor to publish.' }, 403);
  const db = await sessionDatabase();
  if (!db) return reply({ error: 'Publishing is not connected. Use browser-only preview.' }, 503);
  try {
    const { data: session } = await db.auth.getUser();
    if (!session.user) return reply({ error: 'Please sign in to publish.' }, 401);
    const { data: editor } = await db.from('editor_accounts').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (!editor) return reply({ error: 'This account isn’t an editor.' }, 403);
    let incoming: { entry?: unknown; action?: unknown; editing?: unknown };
    try { incoming = await readJson(request, 100_000) as typeof incoming; }
    catch { return reply({ error: 'The article is too long or the request is invalid.' }, 400); }
    const { entry, action, editing } = incoming || {};
    const existingSlug = typeof editing === 'string' && /^[a-z0-9-]{1,80}$/.test(editing) ? editing : null;
    if (!['publish', 'draft', 'unpublish'].includes(String(action))) return reply({ error: 'Choose a valid editor action.' }, 400);
    let checked;
    try { checked = validateEntry(entry, action === 'publish'); }
    catch (error) { return reply({ error: (error as Error).message }, 400); }
    if (existingSlug && checked.slug !== existingSlug) return reply({ error: 'An existing post keeps its original URL.' }, 400);
    if (existingSlug) {
      const current = await db.from('entries').select('published_at, kind').eq('slug', existingSlug).maybeSingle();
      if (current.error) return reply({ error: 'The editor is temporarily unavailable.' }, 503);
      if (!current.data) return reply({ error: 'This entry no longer exists.' }, 404);
      if (current.data.kind !== checked.kind) return reply({ error: 'An existing post keeps its original format.' }, 400);
      if (action === 'draft' && current.data.published_at) return reply({ error: 'Choose Update published entry or Unpublish for an entry that is already public.' }, 409);
      if (action === 'publish' && current.data.published_at) checked.published_at = current.data.published_at;
    }
    const operation = existingSlug ? db.from('entries').update(checked).eq('slug', existingSlug) : db.from('entries').insert(checked);
    const { data, error } = await operation.select('*').single();
    if (error?.code === '23505') return reply({ error: 'That URL slug is taken. Choose a different one.' }, 409);
    if (error || !data) return reply({ error: 'We couldn’t save this entry. Try again shortly.' }, 503);
    revalidateTag('entries', { expire: 0 });
    revalidatePath('/', 'layout');
    return reply({ entry: data });
  } catch { return reply({ error: 'The editor is temporarily unavailable.' }, 503); }
}
