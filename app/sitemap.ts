import type { MetadataRoute } from 'next';
import { subjects } from '@/lib/content';
import { getEntries } from '@/lib/entries-server';
export const revalidate = 300;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://cellula.in').replace(/\/$/, '');
  const entries = await getEntries().catch(() => []);
  return ['', '/explore', '/videos', '/privacy', ...subjects.map(subject => `/explore/${subject.id}`)].map(path => ({ url: `${site}${path}` })).concat(entries.filter(entry => entry.kind === 'article').map(entry => ({ url: `${site}/articles/${entry.slug}`, lastModified: entry.published_at || undefined })));
}
