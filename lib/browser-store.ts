import { isPublished, newestFirst, type Entry } from './content';

const studioKey = 'cellula.studio.v1';
export const studioEvent = 'cellula:studio';

export function readLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(window.localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

export function writeLocal<T>(key: string, value: T) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function localEntries(): Entry[] {
  const items = readLocal<Entry[]>(studioKey, []);
  return Array.isArray(items) ? items.filter(item => item && typeof item.slug === 'string' && typeof item.title === 'string') : [];
}

export function storeLocalEntries(entries: Entry[]) {
  const saved = writeLocal(studioKey, entries);
  if (saved) window.dispatchEvent(new Event(studioEvent));
  return saved;
}

export function listenForStudio(callback: () => void) {
  const crossTab = (event: StorageEvent) => { if (event.key === studioKey) callback(); };
  window.addEventListener(studioEvent, callback);
  window.addEventListener('storage', crossTab);
  return () => {
    window.removeEventListener(studioEvent, callback);
    window.removeEventListener('storage', crossTab);
  };
}

export function mergeEntries(publicEntries: Entry[], local: Entry[]) {
  const result = new Map(publicEntries.map(item => [item.slug, item]));
  for (const item of local) {
    if (isPublished(item)) result.set(item.slug, item);
    else result.delete(item.slug);
  }
  return Array.from(result.values()).sort(newestFirst);
}
