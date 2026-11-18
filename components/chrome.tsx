'use client';

import Link from 'next/link';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { ArrowRight, ArrowUpRight, BookOpen, Bookmark, ChevronRight, CircleUserRound, Leaf, LogOut, Menu, Moon, Play, Search, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { entryKey, getSubject, subjects, type Entry } from '@/lib/content';
import { accountsEnabled } from '@/lib/config';
import { progressStats } from '@/lib/progress';
import { Brand } from './icons';
import { CoverImage, useCatalog } from './catalog';
import { browserDatabase, useStudent } from './student';
import { Modal } from './modal';

const nav = [{ label: 'Home', href: '/' }, { label: 'Zoology', href: '/explore/zoology' }, { label: 'Botany', href: '/explore/botany' }, { label: 'Environment', href: '/explore/environment' }, { label: 'Videos', href: '/videos' }];

function ThemeButton() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || 'light');
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event: MediaQueryListEvent) => {
      try { if (localStorage.getItem('cellula.theme')) return; } catch { /* follow system defaults */ }
      const next = event.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const dark = theme === 'dark';
  return <button className="icon-button theme-toggle" type="button" title={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => {
    const next = dark ? 'light' : 'dark';
    try { localStorage.setItem('cellula.theme', next); } catch { /* current page still updates */ }
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }}><Moon size={18} className="moon" /><Sun size={19} className="sun" /></button>;
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { setPanel, user } = useStudent();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        setOpen(false);
        setPanel('search');
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [setPanel]);
  const links = nav.map(({ label, href }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</Link>);
  return <header className="site-header">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="site-width header-inner">
      <Brand />
      <nav className="main-nav" aria-label="Primary navigation">{links}</nav>
      <div className="header-tools">
        <button className="icon-button header-search" type="button" title="Search the library (Ctrl+K)" aria-label="Search the library" onClick={() => { setOpen(false); setPanel('search'); }}><Search size={19} /></button>
        <button className="icon-button header-saved" type="button" title="Field bag: saved items and progress" aria-label="Open field bag" onClick={() => { setOpen(false); setPanel('saved'); }}><Bookmark size={18} /></button>
        <ThemeButton />
        <button className="header-login button button-primary" type="button" onClick={() => { setOpen(false); setPanel(user ? 'saved' : 'sign-in'); }}>{user ? <CircleUserRound size={17} /> : null}{user ? 'My field bag' : 'Sign in'}{!user && <ArrowUpRight size={14} />}</button>
        <button className="icon-button mobile-menu-toggle" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
    </div>
    {open && <div className="mobile-menu" id="mobile-nav">
      <nav className="site-width" aria-label="Mobile navigation">{links}
        <button type="button" onClick={() => { setOpen(false); setPanel('saved'); }}><Bookmark size={17} /> My field bag</button>
        <button type="button" onClick={() => { setOpen(false); setPanel(user ? 'saved' : 'sign-in'); }}><CircleUserRound size={17} /> {user ? 'My account' : 'Sign in'}</button>
      </nav>
    </div>}
  </header>;
}

export function Footer() {
  const { setPanel } = useStudent();
  return <footer className="site-footer">
    <div className="site-width footer-main">
      <div className="footer-about"><Brand /><p>A field guide for curious minds.<br />Look closer. Learn for life.</p></div>
      <div><h2>Study collections</h2>{subjects.map(subject => <Link key={subject.id} href={`/explore/${subject.id}`}>{subject.name}</Link>)}</div>
      <div><h2>Your library</h2><Link href="/explore">Field notes</Link><Link href="/videos">Video library</Link><button type="button" onClick={() => setPanel('saved')}>Your field bag</button></div>
      <div><h2>Cellula</h2><Link href="/privacy">Privacy & learning</Link><Link href="/studio">Editor studio <ArrowUpRight size={13} /></Link></div>
    </div>
    <div className="site-width footer-end"><span>© {new Date().getFullYear()} Cellula</span><span><Leaf size={13} /> A little closer to the living world.</span></div>
  </footer>;
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
type Turnstile = {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void; size: 'flexible' }) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

function SignInPanel() {
  const { setPanel } = useStudent();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [challengeReady, setChallengeReady] = useState(false);
  const [challenge, setChallenge] = useState('');
  const widget = useRef<HTMLDivElement>(null);
  const resetChallenge = useRef<() => void>(() => {});
  useEffect(() => {
    const turnstile = (window as Window & { turnstile?: Turnstile }).turnstile;
    if (!siteKey || !challengeReady || !widget.current || !turnstile || sent) return;
    const id = turnstile.render(widget.current, { sitekey: siteKey, size: 'flexible', callback: setChallenge,
      'expired-callback': () => setChallenge(''),
      'error-callback': () => { setChallenge(''); setMessage('The verification check did not load. Close and reopen sign-in to try again.'); },
    });
    resetChallenge.current = () => { setChallenge(''); turnstile.reset(id); };
    return () => { turnstile.remove(id); resetChallenge.current = () => {}; };
  }, [challengeReady, sent]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = browserDatabase();
    if (!db || (siteKey && !challenge)) return;
    setBusy(true);
    setMessage('');
    try {
      const redirect = new URL('/auth/callback', window.location.origin);
      const { error } = await db.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect.toString(), captchaToken: siteKey ? challenge : undefined } });
      if (error) { resetChallenge.current(); setMessage(error.status === 429 ? 'Please wait a moment before requesting another link.' : 'We couldn’t send a sign-in link. Check the address or try again shortly.'); }
      else { setChallenge(''); setSent(true); }
    } catch { resetChallenge.current(); setMessage('Couldn’t reach the sign-in service. Try again shortly.'); }
    finally { setBusy(false); }
  }
  return <Modal title={sent ? 'Check your inbox' : 'Sign in to Cellula'} onClose={() => setPanel(null)}>
    {sent ? <><p className="dialog-text">If the address can receive mail, you’ll get a one-time link at <strong>{email}</strong>. Open it in this browser to return to Cellula.</p><div className="dialog-actions"><button className="button button-outline" onClick={() => setSent(false)}>Use a different email</button></div></>
      : <><p className="dialog-text">Keep your field bag across devices and continue studying with Guru Jee after your guest messages.</p>
        {accountsEnabled ? <form className="sign-in-form" onSubmit={submit}>
          <label htmlFor="sign-in-email">Email address</label><input id="sign-in-email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
          {siteKey && <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setChallengeReady(true)} onError={() => setMessage('The verification check failed to load. Try again on another connection.')} /><div ref={widget} /></>}
          <button className="button button-primary" type="submit" disabled={busy || !!(siteKey && !challenge)}>{busy ? 'Sending…' : 'Send my sign-in link'} <ArrowRight size={17} /></button>
          <p className="form-hint">No password to remember. We’ll email you a one-time link.</p>
          {message && <p className="form-error" role="alert">{message}</p>}
        </form> : <p className="info-box"><strong>Preview mode</strong><br />Email sign-in isn’t connected yet. You can still save notes and track progress in this browser.</p>}
        <button className="text-link" type="button" onClick={() => setPanel(null)}>Continue as a guest <ChevronRight size={16} /></button></>}
  </Modal>;
}

function EntryResult({ entry, onChoose }: { entry: Entry; onChoose: () => void }) {
  const { play } = useCatalog();
  const body = <>
    <span className="result-image"><CoverImage entry={entry} /></span>
    <span className="result-text"><small>{getSubject(entry.subject)?.name} · {entry.kind === 'video' ? 'Video' : 'Field note'}</small><strong>{entry.title}</strong></span>
    {entry.kind === 'video' ? <Play size={17} /> : <ArrowUpRight size={17} />}
  </>;
  return entry.kind === 'video' ? <button className="entry-result" type="button" onClick={() => { onChoose(); play(entry); }}>{body}</button>
    : <Link className="entry-result" href={`/articles/${entry.slug}`} onClick={onChoose}>{body}</Link>;
}

function SearchPanel() {
  const { entries } = useCatalog();
  const { setPanel } = useStudent();
  const [query, setQuery] = useState('');
  const keywords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = (keywords.length ? entries.filter(entry => {
    const haystack = `${entry.title} ${entry.excerpt} ${getSubject(entry.subject)?.name} ${entry.kind}`.toLowerCase();
    return keywords.every(word => haystack.includes(word));
  }) : entries).slice(0, keywords.length ? 18 : 5);
  return <Modal title="Search Cellula" className="search-dialog" onClose={() => setPanel(null)}>
    <label className="search-input"><Search size={19} /><input aria-label="Search field notes and videos" placeholder="Try ‘ferns’ or ‘migration’" type="search" autoFocus value={query} onChange={event => setQuery(event.target.value)} /></label>
    <p className="kicker results-label">{keywords.length ? 'Search results' : 'From the library'}</p>
    {results.length ? <div className="result-list">{results.map(entry => <EntryResult key={entryKey(entry)} entry={entry} onChoose={() => setPanel(null)} />)}</div> : <p className="dialog-text" role="status">{keywords.length ? 'No matches. Try a different topic or keyword.' : 'No field notes have been published yet.'}</p>}
  </Modal>;
}

function SavedPanel() {
  const { entries } = useCatalog();
  const { setPanel, user, isEditor, progress, guestHasProgress, importGuest, notify } = useStudent();
  const { read, watched, saved } = progressStats(progress);
  const savedEntries = entries.filter(entry => progress[entryKey(entry)]?.saved);
  return <Modal title="Your field bag" className="saved-dialog" onClose={() => setPanel(null)}>
    <p className="dialog-text">{user ? <>Signed in as <strong>{user.email}</strong>.</> : 'Your saved notes and study progress are kept in this browser.'}</p>
    <div className="stats-grid">
      <div><Bookmark size={17} /><strong>{saved}</strong><span>Saved</span></div><div><BookOpen size={17} /><strong>{read}</strong><span>Notes read</span></div><div><Play size={17} /><strong>{watched}</strong><span>Videos watched</span></div>
    </div>
    <p className="kicker results-label">Saved for later</p>
    {savedEntries.length ? <div className="result-list">{savedEntries.map(entry => <EntryResult key={entryKey(entry)} entry={entry} onChoose={() => setPanel(null)} />)}</div>
      : <p className="dialog-text">Tap the bookmark on any article or video to keep it here.</p>}
    <div className="dialog-actions">
      {guestHasProgress && user && <button className="button button-outline" type="button" onClick={importGuest}>Copy guest progress</button>}
      {isEditor && <Link className="button button-outline" href="/studio" onClick={() => setPanel(null)}>Editor studio <ArrowUpRight size={15} /></Link>}
      {user ? <button className="text-link" type="button" onClick={async () => {
        try { const result = await browserDatabase()?.auth.signOut(); if (result?.error) throw result.error; setPanel(null); notify('Signed out'); }
        catch { notify('Couldn’t sign out. Try again shortly.'); }
      }}><LogOut size={16} /> Sign out</button> : <button className="text-link" type="button" onClick={() => setPanel('sign-in')}>Sign in to sync <ArrowRight size={16} /></button>}
    </div>
  </Modal>;
}

export function GlobalPanels() {
  const { panel } = useStudent();
  return panel === 'sign-in' ? <SignInPanel /> : panel === 'search' ? <SearchPanel /> : panel === 'saved' ? <SavedPanel /> : null;
}

export function TvNavigation() {
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1700px) and (hover: none)');
    const listener = (event: KeyboardEvent) => {
      if ((!media.matches && !/SmartTV|Tizen|Web0S|HbbTV/i.test(navigator.userAgent)) || !['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) return;
      const focused = document.activeElement;
      if (focused?.matches('input, textarea, select, [contenteditable], iframe')) return;
      const scope = document.querySelector('dialog[open]') || document;
      const targets = [...scope.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select, textarea, summary, [tabindex="0"]')].filter(node => node.offsetWidth > 0 && node.offsetHeight > 0 && !node.closest('[inert]') && !node.classList.contains('skip-link'));
      if (!focused || focused === document.body) { targets[0]?.focus(); event.preventDefault(); return; }
      const source = focused.getBoundingClientRect();
      const horizontal = ['ArrowLeft', 'ArrowRight'].includes(event.key);
      const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      let best: HTMLElement | undefined;
      let score = Infinity;
      targets.forEach(target => {
        if (target === focused) return;
        const rect = target.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - source.left - source.width / 2;
        const dy = rect.top + rect.height / 2 - source.top - source.height / 2;
        const forward = direction * (horizontal ? dx : dy);
        const sideways = Math.abs(horizontal ? dy : dx);
        if (forward > 5 && forward + sideways * 2.2 < score) { score = forward + sideways * 2.2; best = target; }
      });
      if (best) { event.preventDefault(); best.focus(); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  return null;
}
