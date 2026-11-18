import 'server-only';
import { unstable_cache } from 'next/cache';
import { publicDatabase } from './supabase-server';
import { localPreview } from './config';
import { seedEntries } from './seed';
import { newestFirst, type Entry } from './content';

const list = unstable_cache(async (): Promise<Entry[]> => {
  const database = publicDatabase();
  if (!database) return localPreview ? [...seedEntries].sort(newestFirst) : [];
  const { data, error } = await database.from('entries')
    .select('slug, kind, subject, title, excerpt, image_url, image_alt, video_url, duration, published_at, read_minutes')
    .not('published_at', 'is', null).order('published_at', { ascending: false }).limit(1000);
  if (error) throw new Error('Could not load published entries');
  return (data || []).map(row => ({ ...row, body: '' })) as Entry[];
}, ['published-cellula-v1'], { tags: ['entries'], revalidate: 300 });

const entry = unstable_cache(async (slug: string): Promise<Entry | null> => {
  const database = publicDatabase();
  if (!database) return localPreview ? seedEntries.find(item => item.slug === slug && item.kind === 'article') || null : null;
  const { data, error } = await database.from('entries').select('*').eq('slug', slug).eq('kind', 'article').maybeSingle();
  if (error) throw new Error('Could not load article');
  return data as Entry | null;
}, ['cellula-article-v1'], { tags: ['entries'], revalidate: 300 });

export const getEntries = list;
export const getEntry = entry;
