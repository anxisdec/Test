'use client';

import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Compass, Crosshair, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { entryKey, getSubject, subjects, type Kind, type Subject } from '@/lib/content';
import { EmptyCatalog, EntryCard, useCatalog } from './catalog';
import { SubjectIcon } from './icons';

export function HomePage() {
  const { entries } = useCatalog();
  const articles = entries.filter(entry => entry.kind === 'article').slice(0, 3);
  const videos = entries.filter(entry => entry.kind === 'video').slice(0, 3);
  return <main id="main-content" className="site-width home-page">
    <section className="hero" aria-labelledby="hero-title">
      <img src="/images/hero-fern.webp" className="hero-image" alt="" fetchPriority="high" width={1792} height={592} />
      <div className="hero-content">
        <p className="hero-eyebrow"><span aria-hidden="true" /> The life science field guide</p>
        <h1 id="hero-title">A closer look at<br /><em>the living world.</em></h1>
        <p className="hero-description">Field notes, videos, and a little wonder.<br className="hero-break" /> Explore zoology, botany, and environmental science.</p>
        <div className="hero-actions"><Link href="/explore" className="button button-lime">Explore field notes <ArrowRight size={17} /></Link><Link href="/videos" className="button hero-secondary"><Play size={16} fill="currentColor" /> Watch videos</Link></div>
      </div>
      <div className="hero-caption"><Crosshair size={20} strokeWidth={1.15} /><div><p>FIG. 01 <span aria-hidden="true">/</span> IN THE UNDERSTORY</p><span>Fern fronds · Polypodiopsida</span></div></div>
    </section>

    <section className="home-section subjects-section" aria-labelledby="subjects-title">
      <div className="section-heading subject-heading"><div><p className="kicker">The study collections</p><h2 id="subjects-title">Explore by subject</h2></div><p className="section-aside">Three paths into the living world.</p></div>
      <div className="subject-grid">
        {subjects.map(subject => <Link key={subject.id} href={`/explore/${subject.id}`} className={`subject-card tone-${subject.id}`}>
          <span className="subject-icon"><SubjectIcon subject={subject.id} /></span>
          <div><h3>{subject.name}</h3><p>{subject.description}</p></div>
          <ArrowUpRight size={19} className="subject-arrow" aria-hidden="true" />
        </Link>)}
      </div>
    </section>

    <section className="home-section" id="field-notes" aria-labelledby="notes-title">
      <div className="section-heading"><div><p className="kicker">The journal</p><h2 id="notes-title">Latest field notes</h2></div>
        <Link href="/explore" className="button button-outline section-link">View all articles <ArrowUpRight size={16} /></Link></div>
      {articles.length ? <div className="entry-grid">{articles.map(entry => <EntryCard key={entryKey(entry)} entry={entry} />)}</div> : <EmptyCatalog text="The first field notes will appear here when they’re published." />}
    </section>

    <section className="home-section video-section" aria-labelledby="videos-title">
      <div className="section-heading"><div><p className="kicker">Life in motion</p><h2 id="videos-title">The video library</h2></div>
        <Link href="/videos" className="button button-outline section-link">View all videos <ArrowUpRight size={16} /></Link></div>
      {videos.length ? <div className="entry-grid">{videos.map(entry => <EntryCard key={entryKey(entry)} entry={entry} />)}</div> : <EmptyCatalog text="New video lessons will appear here when they’re published." />}
    </section>

    <section className="home-note"><span className="home-note-icon"><Compass size={29} strokeWidth={1.45} /></span><div><p className="kicker">A place to start</p><h2>What makes you curious?</h2><p>Pick a field note, keep a question in mind, and ask Guru Jee when you get stuck.</p></div><Link href="#subjects-title" className="button button-outline">Find your subject <ArrowDown size={17} /></Link></section>
  </main>;
}

export function BrowsePage({ kind, subject }: { kind?: Kind; subject?: Subject }) {
  const chosen = subject ? getSubject(subject) : undefined;
  const { entries } = useCatalog();
  const [videoFilter, setVideoFilter] = useState<Subject | 'all'>('all');
  const [subjectKind, setSubjectKind] = useState<Kind | 'all'>('all');
  const [limit, setLimit] = useState(12);
  const type = kind || (subjectKind === 'all' ? undefined : subjectKind);
  const filter = subject || (videoFilter === 'all' ? undefined : videoFilter);
  const result = useMemo(() => entries.filter(entry => (!type || entry.kind === type) && (!filter || entry.subject === filter)), [entries, type, filter]);
  const isVideo = kind === 'video';
  return <main id="main-content" className="site-width browse-page">
    <Link className="breadcrumb" href="/">Home <span aria-hidden="true">/</span></Link>
    <header className={`browse-banner ${chosen ? `tone-${chosen.id}` : ''}`}>
      <div><p className="kicker">{chosen ? 'Study collection' : isVideo ? 'Life in motion' : 'The Cellula journal'}</p>
        <h1>{chosen?.name || (isVideo ? 'Video library' : 'Field notes')}</h1>
        <p>{chosen?.intro || (isVideo ? 'Watch life science in action. Pause, replay, and mark a lesson as watched when you’re done.' : 'Short, thoughtful reads for looking a little closer at the world around you.')}</p></div>
      <span className="browse-decoration" aria-hidden="true">{chosen ? <SubjectIcon subject={chosen.id} size={84} /> : isVideo ? <Play size={76} strokeWidth={1.1} /> : <BookOpen size={80} strokeWidth={1.15} />}</span>
    </header>
    <div className="browse-tools">
      <div className="filter-row" aria-label={isVideo ? 'Filter videos by subject' : 'Filter field notes'}>
        {isVideo ? <><button className="filter-pill" type="button" aria-pressed={videoFilter === 'all'} onClick={() => { setVideoFilter('all'); setLimit(12); }}>All subjects</button>{subjects.map(item => <button key={item.id} className="filter-pill" type="button" aria-pressed={videoFilter === item.id} onClick={() => { setVideoFilter(item.id); setLimit(12); }}>{item.name}</button>)}</> : chosen ?
          <>{([['all', 'All learning'], ['article', 'Field notes'], ['video', 'Videos']] as const).map(([value, text]) => <button key={value} className="filter-pill" type="button" aria-pressed={subjectKind === value} onClick={() => { setSubjectKind(value); setLimit(12); }}>{text}</button>)}</> :
          <><Link className="filter-pill is-active" href="/explore" aria-current="page">All subjects</Link>{subjects.map(item => <Link key={item.id} className="filter-pill" href={`/explore/${item.id}`}>{item.name}</Link>)}</>}
      </div>
      <p className="result-count" aria-live="polite">{result.length} {result.length === 1 ? 'result' : 'results'}</p>
    </div>
    {result.length ? <div className="entry-grid">{result.slice(0, limit).map(entry => <EntryCard key={entryKey(entry)} entry={entry} />)}</div> : <EmptyCatalog />}
    {result.length > limit && <div className="load-more"><button className="button button-outline" type="button" onClick={() => setLimit(limit + 12)}>Show more <ArrowDown size={17} /></button></div>}
  </main>;
}
