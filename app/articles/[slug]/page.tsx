import { notFound } from 'next/navigation';
import { ArticlePage, PreviewArticle } from '@/components/article';
import { localPreview } from '@/lib/config';
import { getEntries, getEntry } from '@/lib/entries-server';

type Props = { params: Promise<{ slug: string }> };
export async function generateStaticParams() {
  const entries = await getEntries().catch(() => []);
  return entries.filter(item => item.kind === 'article').slice(0, 20).map(item => ({ slug: item.slug }));
}
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const entry = /^[a-z0-9-]{1,80}$/.test(slug) ? await getEntry(slug) : null;
  return entry ? { title: entry.title, description: entry.excerpt, alternates: { canonical: `/articles/${slug}` }, openGraph: { type: 'article', images: entry.image_url ? [entry.image_url] : [] }, } : { title: 'Field note' };
}
export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const entry = await getEntry(slug);
  if (localPreview) return <PreviewArticle slug={slug} fallback={entry} />;
  if (!entry) notFound();
  return <ArticlePage entry={entry} />;
}
