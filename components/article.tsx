'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import { formattedDate, getSubject, isPublished, readingTime, validCover, type Entry } from '@/lib/content';
import { listenForStudio, localEntries } from '@/lib/browser-store';
import { localPreview } from '@/lib/config';
import { CompleteButton, CoverImage, SaveButton, SubjectTag } from './catalog';

export function EntryBody({ body }: { body: string }) {
  return <Markdown skipHtml urlTransform={(url, key) => key === 'src' ? validCover(url, localPreview) ? url : '' : defaultUrlTransform(url)} components={{
    img: ({ src, alt }) => src ? <img src={src} alt={alt || ''} loading="lazy" decoding="async" /> : null,
    a: ({ href, children }) => href ? <a href={href} rel="noreferrer">{children}</a> : <>{children}</>,
  }}>{body}</Markdown>;
}

export function ArticlePage({ entry }: { entry: Entry }) {
  return <main id="main-content" className="site-width article-page">
    <Link className="breadcrumb" href={`/explore/${entry.subject}`}><ArrowLeft size={16} /> Back to {getSubject(entry.subject)?.name}</Link>
    <header className="article-intro"><div className="entry-meta"><SubjectTag subject={entry.subject} /><span className="entry-time"><Clock3 size={15} /> {entry.read_minutes || readingTime(entry.body)} min read</span></div>
      <h1>{entry.title}</h1><p>{entry.excerpt}</p><div className="article-byline"><span><BookOpen size={15} /> Cellula Field Notes</span><time dateTime={entry.published_at || undefined}>{formattedDate(entry.published_at)}</time><SaveButton entry={entry} inline /></div></header>
    <div className="article-cover"><CoverImage entry={entry} eager /></div>
    <div className="article-content"><div className="prose"><EntryBody body={entry.body} /></div>
      <div className="article-end"><div><p className="kicker">Fieldwork complete?</p><p>Keep track of what you’ve studied in your field bag.</p></div><CompleteButton entry={entry} /></div>
      <Link className="text-link" href="/explore">Find another field note <ArrowRight size={17} /></Link></div>
  </main>;
}

export function PreviewArticle({ slug, fallback }: { slug: string; fallback: Entry | null }) {
  const [entry, setEntry] = useState(fallback);
  const [ready, setReady] = useState(!!fallback);
  useEffect(() => {
    const sync = () => {
      const local = localEntries().find(item => item.slug === slug);
      setEntry(local ? local.kind === 'article' && isPublished(local) ? local : null : fallback);
      setReady(true);
    };
    sync();
    return listenForStudio(sync);
  }, [slug, fallback]);
  if (entry) return <ArticlePage entry={entry} />;
  return <main className="site-width short-page" id="main-content"><div className="empty-state"><BookOpen size={30} /><h1>{ready ? 'Field note not found' : 'Loading field note…'}</h1><p>{ready ? 'This note may be a draft or saved in a different browser.' : 'Checking your browser’s field notes.'}</p><Link href="/explore" className="button button-primary">Browse field notes <ArrowRight size={17} /></Link></div></main>;
}
