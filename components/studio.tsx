'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Bold, BookOpen, Eye, Heading, ImagePlus, Link2, PencilLine, Play, Plus, Save, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { localPreview } from '@/lib/config';
import { getSubject, isPublished, makeSlug, subjects, validCover, validateEntry, youtubeThumbnail, type Entry, type Kind, type Subject } from '@/lib/content';
import { listenForStudio, localEntries, storeLocalEntries } from '@/lib/browser-store';
import { seedEntries } from '@/lib/seed';
import { browserDatabase, useStudent } from './student';
import { EntryBody } from './article';
import { SubjectTag } from './catalog';

const fresh = (kind: Kind): Entry => ({ kind, slug: '', title: '', subject: 'zoology', excerpt: '', body: '', image_url: '', image_alt: '', video_url: '', duration: '', published_at: null });
type Action = 'draft' | 'publish' | 'unpublish';

async function convertImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 5_242_880) throw new Error('Choose a JPG, PNG, WebP, or AVIF image under 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('This file isn’t a supported image.');
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image resizing is unavailable on this device.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.83));
    if (!blob || blob.type !== 'image/webp') throw new Error('Couldn’t resize that image. Try a newer browser or paste a public image URL.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

export function Studio() {
  const { user, ready, isEditor, setPanel } = useStudent();
  const router = useRouter();
  const [form, setForm] = useState<Entry>(() => fresh('article'));
  const [editing, setEditing] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(!localPreview);
  const [slugChanged, setSlugChanged] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const writeArea = useRef<HTMLTextAreaElement>(null);
  const imageArea = useRef<HTMLInputElement>(null);
  const canEdit = localPreview || isEditor;
  useEffect(() => {
    if (localPreview) {
      const sync = () => setEntries(localEntries());
      sync();
      return listenForStudio(sync);
    }
    if (!isEditor || !user) return;
    let active = true;
    setLoadingEntries(true);
    void browserDatabase()?.from('entries').select('*').order('published_at', { ascending: false, nullsFirst: true }).limit(1000).then(({ data, error }) => {
      if (!active) return;
      if (error) setError('The editor couldn’t load saved entries.');
      else setEntries((data || []) as Entry[]);
      setLoadingEntries(false);
    });
    return () => { active = false; };
  }, [isEditor, user]);

  function patch<K extends keyof Entry>(key: K, value: Entry[K]) {
    setForm(before => ({ ...before, [key]: value }));
  }

  function start(kind: Kind) {
    setForm(fresh(kind)); setEditing(null); setSlugChanged(false); setPreview(false); setError(''); setSuccess('');
  }

  function open(item: Entry) {
    setForm(item); setEditing(item.slug); setSlugChanged(true); setPreview(false); setError(''); setSuccess('');
  }

  function insertIntoBody(before: string, defaultText: string, after: string) {
    const textarea = writeArea.current;
    const start = textarea?.selectionStart ?? form.body.length;
    const end = textarea?.selectionEnd ?? start;
    const value = form.body.slice(start, end) || defaultText;
    patch('body', form.body.slice(0, start) + before + value + after + form.body.slice(end));
    requestAnimationFrame(() => { textarea?.focus(); textarea?.setSelectionRange(start + before.length, start + before.length + value.length); });
  }

  async function addImage(file: File, inline: boolean) {
    setError(''); setSuccess(''); setBusy('Uploading image…');
    try {
      const blob = await convertImage(file);
      let image: string;
      if (localPreview) {
        if (blob.size > 650_000) throw new Error('This image is too large for browser preview. Try a smaller image.');
        image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const db = browserDatabase();
        if (!db || !user || !isEditor) throw new Error('Only editors can upload images.');
        const path = `${user.id}/${crypto.randomUUID()}.webp`;
        const { error } = await db.storage.from('entry-images').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' });
        if (error) throw new Error('Couldn’t upload the image. Check your connection and Storage setup.');
        image = db.storage.from('entry-images').getPublicUrl(path).data.publicUrl;
      }
      if (inline) insertIntoBody('\n\n![', 'Describe the image', `](${image})\n\n`);
      else patch('image_url', image);
      setSuccess(inline ? 'Image inserted. Replace the placeholder with a short description.' : 'Cover added. Describe what students should notice in the alt text.');
    } catch (fault) { setError(fault instanceof Error ? fault.message : 'Couldn’t read this image.'); }
    finally { setBusy(''); }
  }

  async function save(action: Action) {
    if (busy) return;
    setError(''); setSuccess('');
    setBusy(action === 'publish' ? 'Publishing…' : 'Saving…');
    try {
      let item = validateEntry(form, action === 'publish', localPreview);
      if (localPreview) {
        const current = localEntries();
        if (!editing && (current.some(entry => entry.slug === item.slug) || seedEntries.some(entry => entry.slug === item.slug))) throw new Error('That URL slug is used. Change it under Entry options.');
        if (action === 'publish' && form.published_at) item = { ...item, published_at: form.published_at };
        if (!storeLocalEntries([item, ...current.filter(entry => entry.slug !== item.slug)])) throw new Error('Browser storage is full or unavailable. Try a smaller image or set up Supabase for publishing.');
      } else {
        const response = await fetch('/api/studio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry: form, action, editing }) });
        const result = await response.json();
        if (!response.ok || !result.entry) throw new Error(result.error || 'Couldn’t save this entry.');
        item = result.entry;
        setEntries(previous => [item, ...previous.filter(entry => entry.slug !== item.slug)]);
        router.refresh();
      }
      setForm(item);
      setEditing(item.slug);
      setSlugChanged(true);
      setSuccess(action === 'publish' ? (localPreview ? 'Published in this browser. Open the library to see it.' : 'Published to the Cellula library.') : action === 'unpublish' ? 'Unpublished and saved as a draft.' : 'Draft saved.');
    } catch (fault) { setError(fault instanceof Error ? fault.message : 'Something went wrong while saving.'); }
    finally { setBusy(''); }
  }

  const published = isPublished(form);
  const autoThumbnail = form.kind === 'video' ? youtubeThumbnail(form.video_url) : '';
  const cover = validCover(form.image_url, localPreview) && form.image_url ? form.image_url : autoThumbnail;
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void save('publish'); };
  return <main id="main-content" className="site-width studio-page">
    <Link className="breadcrumb" href="/"><ArrowLeft size={16} /> Back to Cellula</Link>
    <div className="studio-heading"><div><p className="kicker">The writing desk</p><h1>Editor studio</h1><p>Write field notes, add images, and share YouTube lessons without editing code.</p></div></div>
    {localPreview && <p className="info-box studio-info"><PencilLine size={19} /><span><strong>Browser-only preview.</strong> Drafts and published changes are visible only on this device. Connect Supabase and grant your account the editor role to publish publicly.</span></p>}
    {!canEdit ? <div className="empty-state studio-gate"><BookOpen size={28} />
      <h2>{!ready ? 'Checking your account…' : 'Editor access only'}</h2><p>{!ready ? 'Checking your sign-in and editor permissions.' : user ? 'This account doesn’t have permission to publish. Ask the site owner to add your account as an editor.' : 'Sign in with your editor account to manage the library.'}</p>
      {ready && !user && <button className="button button-primary" type="button" onClick={() => setPanel('sign-in')}>Sign in</button>}
    </div> : <div className="studio-grid">
      <aside className="studio-side">
        <div className="studio-add"><button className="button button-primary" type="button" disabled={!!busy} onClick={() => start('article')}><Plus size={17} /> New article</button><button className="button button-outline" type="button" disabled={!!busy} onClick={() => start('video')}><Plus size={17} /> New video</button></div>
        <h2>Your entries</h2>
        {loadingEntries && <p className="form-hint">Loading entries…</p>}
        {!loadingEntries && !entries.length && <p className="form-hint">No drafts here yet. Write an article or paste a video link to get started.</p>}
        <div className="studio-list">{entries.map(item => <button key={item.slug} disabled={!!busy} className="studio-list-item" type="button" aria-pressed={item.slug === editing} onClick={() => open(item)}>
          {item.kind === 'article' ? <BookOpen size={17} /> : <Play size={17} />}<span><strong>{item.title}</strong><small>{isPublished(item) ? 'Published' : 'Draft'} · {getSubject(item.subject)?.name}</small></span></button>)}</div>
      </aside>
      <form className="studio-editor" onSubmit={submit}>
        <div className="studio-editor-top"><div><p className="kicker">{form.kind === 'article' ? 'Field note' : 'Video lesson'} · {published ? 'Published' : 'Draft'}</p><h2>{editing ? 'Edit entry' : form.kind === 'article' ? 'Write an article' : 'Add a YouTube video'}</h2></div>{published && <Link className="text-link" href={form.kind === 'article' ? `/articles/${form.slug}` : '/videos'}>View {form.kind === 'article' ? 'article' : 'library'} <ArrowUpRight size={15} /></Link>}</div>
        <fieldset disabled={!!busy}>
          <div className="studio-fields">
            <label>Title <input value={form.title} maxLength={140} placeholder={form.kind === 'article' ? 'Give your field note a title' : 'Give the lesson a title'} onChange={event => {
              const title = event.target.value;
              setForm(previous => ({ ...previous, title, slug: slugChanged ? previous.slug : makeSlug(title) }));
            }} required /></label>
            <div className="studio-field"><label htmlFor="entry-subject">Subject</label><select id="entry-subject" value={form.subject} onChange={event => patch('subject', event.target.value as Subject)}>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
          </div>
          {form.kind === 'video' && <div className="studio-fields">
            <label>YouTube video link <input placeholder="https://www.youtube.com/watch?v=…" value={form.video_url} onChange={event => patch('video_url', event.target.value)} maxLength={500} inputMode="url" /></label>
            <label>Duration (optional) <input placeholder="e.g. 8:42" value={form.duration} onChange={event => patch('duration', event.target.value)} maxLength={16} /></label>
          </div>}
          <label>Short summary <textarea rows={2} value={form.excerpt} onChange={event => patch('excerpt', event.target.value)} placeholder="What will students learn?" maxLength={280} /></label>
          <div className="studio-asset">
            {cover && <div className="studio-thumb"><img src={cover} alt={form.image_alt || 'Cover preview'} onError={event => { if (!event.currentTarget.src.endsWith('/images/hero-fern.webp')) event.currentTarget.src = '/images/hero-fern.webp'; }} /></div>}
            <div><label className="upload-label button button-outline"><Upload size={16} /> {form.kind === 'video' ? 'Upload custom thumbnail' : 'Upload cover image'}<input aria-label="Upload cover image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; if (file) void addImage(file, false); event.currentTarget.value = ''; }} /></label>
              <p className="form-hint">{form.kind === 'video' ? 'A YouTube thumbnail appears automatically when you paste a link.' : 'JPG, PNG, WebP, or AVIF. Up to 5 MB.'}</p>
              {form.image_url && <button className="text-link" type="button" onClick={() => { patch('image_url', ''); patch('image_alt', ''); }}>Remove cover</button>}
            </div>
          </div>
          {form.image_url && <label>Cover description (alt text) <input value={form.image_alt} placeholder="Briefly describe what the image shows" maxLength={240} onChange={event => patch('image_alt', event.target.value)} /></label>}
          {form.kind === 'article' && <div className="studio-writing">
            <div className="studio-writing-top"><span>Article text</span><div><button className="filter-pill" type="button" aria-pressed={!preview} onClick={() => setPreview(false)}><PencilLine size={14} /> Write</button><button className="filter-pill" type="button" aria-pressed={preview} onClick={() => setPreview(true)}><Eye size={15} /> Preview</button></div></div>
            {preview ? <div className="studio-preview prose"><SubjectTag subject={form.subject} /><h3>{form.title || 'Untitled field note'}</h3><p>{form.excerpt}</p><EntryBody body={form.body} /></div> : <>
              <div className="editor-toolbar"><button type="button" className="icon-button" aria-label="Bold" title="Bold" onClick={() => insertIntoBody('**', 'bold text', '**')}><Bold size={17} /></button><button type="button" className="icon-button" aria-label="Subheading" title="Subheading" onClick={() => insertIntoBody('\n\n## ', 'Section title', '\n\n')}><Heading size={19} /></button><button type="button" className="icon-button" aria-label="Insert link" title="Insert link" onClick={() => insertIntoBody('[', 'link title', '](https://example.com)')}><Link2 size={18} /></button><button type="button" className="icon-button" aria-label="Insert image into article" title="Insert image" onClick={() => imageArea.current?.click()}><ImagePlus size={18} /></button>
                <input ref={imageArea} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void addImage(file, true); event.currentTarget.value = ''; }} /></div>
              <textarea className="writing-area" ref={writeArea} aria-label="Article text" rows={10} value={form.body} placeholder="Start with a question, an observation, or a surprising fact…" onChange={event => patch('body', event.target.value)} />
              <p className="form-hint">Use the toolbar to format your note. Switch to Preview to check it before publishing.</p>
            </>}
          </div>}
          <details className="entry-options"><summary>Entry options</summary><label>URL slug <input maxLength={80} value={form.slug} readOnly={!!editing} onChange={event => { setSlugChanged(true); patch('slug', event.target.value); }} /></label>
            {!form.image_url.startsWith('data:') && <label>Public cover image URL (optional) <input inputMode="url" placeholder="https://…" value={form.image_url} maxLength={2048} onChange={event => patch('image_url', event.target.value)} /></label>}</details>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="success-box" role="status">{success}</p>}
        <div className="studio-actions"><button className="button button-primary" type="submit" disabled={!!busy}><ArrowUpRight size={17} /> {busy || (published ? 'Update published entry' : 'Publish entry')}</button>
          <button className="button button-outline" type="button" disabled={!!busy} onClick={() => void save(published ? 'unpublish' : 'draft')}><Save size={16} /> {published ? 'Unpublish' : 'Save draft'}</button></div>
      </form>
    </div>}
  </main>;
}
