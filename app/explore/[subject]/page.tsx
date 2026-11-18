import { notFound } from 'next/navigation';
import { BrowsePage } from '@/components/landing';
import { getSubject, subjects } from '@/lib/content';

type Props = { params: Promise<{ subject: string }> };
export function generateStaticParams() { return subjects.map(item => ({ subject: item.id })); }
export async function generateMetadata({ params }: Props) {
  const subject = getSubject((await params).subject);
  return subject ? { title: subject.name, description: subject.intro, alternates: { canonical: `/explore/${subject.id}` } } : {};
}
export default async function Page({ params }: Props) {
  const subject = getSubject((await params).subject);
  if (!subject) notFound();
  return <BrowsePage subject={subject.id} />;
}
