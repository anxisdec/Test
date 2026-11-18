export const subjects = [
  { id: 'zoology', name: 'Zoology', description: 'Animals, anatomy & behavior', intro: 'From the smallest invertebrates to far-traveling animals, discover how animals live, adapt, and interact.' },
  { id: 'botany', name: 'Botany', description: 'Plants, fungi & their worlds', intro: 'Look beneath the leaf and into the soil to understand how plants grow, reproduce, and shape their habitats.' },
  { id: 'environment', name: 'Environmental Science', description: 'Ecosystems, climate & conservation', intro: 'Follow the connections between living things, a changing planet, and the choices we make to protect it.' },
] as const;

export type Subject = typeof subjects[number]['id'];
export type Kind = 'article' | 'video';
export type Entry = {
  slug: string;
  kind: Kind;
  subject: Subject;
  title: string;
  excerpt: string;
  body: string;
  image_url: string;
  image_alt: string;
  video_url: string;
  duration: string;
  published_at: string | null;
  read_minutes?: number;
};

export const getSubject = (id: string) => subjects.find(subject => subject.id === id);
export const entryKey = (entry: Pick<Entry, 'kind' | 'slug'>) => `${entry.kind}:${entry.slug}`;
export const isPublished = (entry: Entry) => !!entry.published_at && new Date(entry.published_at).getTime() <= Date.now();
export const newestFirst = (a: Entry, b: Entry) => (b.published_at || '').localeCompare(a.published_at || '');
export const makeSlug = (title: string) => title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/g, '');

const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com']);
export function youtubeId(link: string): string | null {
  try {
    const value = link.trim();
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.port || url.username || url.password || !youtubeHosts.has(url.hostname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const id = url.hostname.endsWith('youtu.be') ? parts[0] : parts[0] === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function youtubeThumbnail(link: string) {
  const id = youtubeId(link);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

export function coverSource(entry: Entry) {
  return entry.image_url || (entry.kind === 'video' ? youtubeThumbnail(entry.video_url) : '') || '/images/hero-fern.webp';
}

export function readingTime(body: string) {
  return Math.max(1, Math.ceil(body.trim().split(/\s+/).filter(Boolean).length / 165));
}

export function formattedDate(date: string | null) {
  return date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date)) : '';
}

export function validCover(value: string, local = false) {
  if (!value) return true;
  if (value.startsWith('/images/')) return /^\/images\/[a-z0-9._-]+$/i.test(value);
  if (local && /^data:image\/webp;base64,[a-z0-9+/=]+$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return value.length <= 2048 && url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

function field(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function validateEntry(input: unknown, publishing: boolean, local = false): Entry {
  if (!input || typeof input !== 'object') throw new Error('Add a title and choose a subject.');
  const value = input as Record<string, unknown>;
  const title = field(value.title, 140);
  const slug = field(value.slug, 80) || makeSlug(title);
  const subject = getSubject(field(value.subject, 24));
  const kind = value.kind;
  const excerpt = field(value.excerpt, 280);
  const body = field(value.body, local ? 1_500_000 : 75_000);
  const image_url = field(value.image_url, local ? 1_500_000 : 2049);
  const image_alt = field(value.image_alt, 240);
  const video_url = field(value.video_url, 500);
  const id = youtubeId(video_url);
  if (!title || !subject || (kind !== 'article' && kind !== 'video') || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Add a title, a subject, and a valid URL slug using letters a–z, numbers, and dashes.');
  if (!validCover(image_url, local)) throw new Error('Upload a cover image or use a public HTTPS image URL.');
  if (image_url && publishing && !image_alt) throw new Error('Describe the cover image for students using screen readers.');
  if (kind === 'video' && ((video_url && !id) || (publishing && !id))) throw new Error('Paste a valid YouTube video link before publishing.');
  if (publishing && (!excerpt || (kind === 'article' && !body))) throw new Error('Add a short summary and, for articles, the text of your field note.');
  return {
    title, slug, subject: subject.id, kind, excerpt, body: kind === 'article' ? body : '', image_url, image_alt,
    video_url: kind === 'video' && id ? `https://www.youtube.com/watch?v=${id}` : '',
    duration: kind === 'video' ? field(value.duration, 16) : '',
    published_at: publishing ? new Date().toISOString() : null,
  };
}
