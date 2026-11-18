'use client';

import { BookOpen, Bookmark, Check, Clock3, Play, X } from 'lucide-react';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { coverSource, entryKey, getSubject, readingTime, youtubeId, type Entry, type Subject } from '@/lib/content';
import { listenForStudio, localEntries, mergeEntries } from '@/lib/browser-store';
import { localPreview } from '@/lib/config';
import { useStudent } from './student';
import { Modal } from './modal';

type Catalog = { entries: Entry[]; play: (entry: Entry) => void };
const CatalogContext = createContext<Catalog>({ entries: [], play: () => {} });
export const useCatalog = () => useContext(CatalogContext);

export function CatalogProvider({ initial, children }: { initial: Entry[]; children: ReactNode }) {
  const [local, setLocal] = useState<Entry[]>([]);
  const [video, setVideo] = useState<Entry | null>(null);
  useEffect(() => {
    if (!localPreview) return;
    const sync = () => setLocal(localEntries());
    sync();
    return listenForStudio(sync);
  }, []);
  return <CatalogContext.Provider value={{ entries: localPreview ? mergeEntries(initial, local) : initial, play: setVideo }}>
    {children}
    {video && <VideoModal entry={video} onClose={() => setVideo(null)} />}
  </CatalogContext.Provider>;
}

export function SubjectTag({ subject }: { subject: Subject }) {
  return <span className={`subject-tag tone-${subject}`}><span aria-hidden="true" />{getSubject(subject)?.name}</span>;
}

export function SaveButton({ entry, inline = false }: { entry: Entry; inline?: boolean }) {
  const { progress, mark, ready } = useStudent();
  const key = entryKey(entry);
  const saved = !!progress[key]?.saved;
  return <button type="button" className={inline ? 'button button-outline' : 'card-save icon-button'} title={saved ? 'Remove from field bag' : 'Save to field bag'} aria-label={`${saved ? 'Unsave' : 'Save'} ${entry.title}`} aria-pressed={saved} disabled={!ready} onClick={() => mark(key, 'saved')}>
    <Bookmark size={inline ? 16 : 18} fill={saved ? 'currentColor' : 'none'} />{inline && (saved ? 'Saved' : 'Save for later')}
  </button>;
}

export function CompleteButton({ entry }: { entry: Entry }) {
  const { progress, mark, ready } = useStudent();
  const key = entryKey(entry);
  const done = !!progress[key]?.completed;
  const label = entry.kind === 'article' ? 'read' : 'watched';
  return <button type="button" className={`button ${done ? 'button-outline' : 'button-primary'}`} aria-pressed={done} disabled={!ready} onClick={() => mark(key, 'completed')}>
    <Check size={17} />{done ? `Marked as ${label}` : `Mark as ${label}`}
  </button>;
}

export function CoverImage({ entry, eager = false }: { entry: Entry; eager?: boolean }) {
  return <img src={coverSource(entry)} alt={entry.image_alt} loading={eager ? 'eager' : 'lazy'} decoding="async"
    onError={(event) => { const image = event.currentTarget; if (!image.src.endsWith('/images/hero-fern.webp')) image.src = '/images/hero-fern.webp'; }} />;
}

export function EntryCard({ entry }: { entry: Entry }) {
  const { play } = useCatalog();
  const { progress } = useStudent();
  const isVideo = entry.kind === 'video';
  const done = !!progress[entryKey(entry)]?.completed;
  const minutes = entry.read_minutes || readingTime(entry.body);
  const media = <><CoverImage entry={entry} />{isVideo && <span className="card-play" aria-hidden="true"><Play size={19} fill="currentColor" /></span>}{isVideo && entry.duration && <span className="duration">{entry.duration}</span>}</>;
  return <article className="entry-card">
    <div className="entry-media">
      {isVideo ? <button className="entry-cover" onClick={() => play(entry)} aria-label={`Play ${entry.title}`}>{media}</button>
        : <Link className="entry-cover" href={`/articles/${entry.slug}`} aria-label={`Read ${entry.title}`}>{media}</Link>}
      <SaveButton entry={entry} />
    </div>
    <div className="entry-text">
      <div className="entry-meta"><SubjectTag subject={entry.subject} />
        <span className="entry-time">{done ? <><Check size={14} />{isVideo ? 'Watched' : 'Read'}</> : isVideo ? <><Play size={12} /> Video</> : <><Clock3 size={14} /> {minutes} min read</>}</span>
      </div>
      <h3>{isVideo ? <button onClick={() => play(entry)}>{entry.title}</button> : <Link href={`/articles/${entry.slug}`}>{entry.title}</Link>}</h3>
      <p>{entry.excerpt}</p>
    </div>
  </article>;
}

export function EmptyCatalog({ title = 'Nothing here yet', text = 'Try a different search or come back for more field notes.' }: { title?: string; text?: string }) {
  return <div className="empty-state"><BookOpen size={28} strokeWidth={1.5} /><h3>{title}</h3><p>{text}</p></div>;
}

function VideoModal({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const id = youtubeId(entry.video_url);
  return <Modal title={entry.title} className="video-dialog" onClose={onClose}>
    {id ? <div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={entry.title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
      : <div className="empty-state"><X size={24} />This video link is unavailable.</div>}
    <p className="dialog-text">{entry.excerpt}</p>
    <div className="dialog-actions"><CompleteButton entry={entry} />{id && <a className="text-link" href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer">Open on YouTube <span aria-hidden="true">↗</span></a>}</div>
  </Modal>;
}
