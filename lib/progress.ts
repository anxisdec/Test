export type ItemProgress = { saved: boolean; completed: boolean; changed: number };
export type Progress = Record<string, ItemProgress>;
export const guestProgressKey = 'cellula.progress.v1.guest';

export function mergeProgress(a: Progress, b: Progress): Progress {
  const result = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (!result[key] || result[key].changed <= value.changed) result[key] = value;
  }
  return result;
}

export function progressStats(data: Progress) {
  return Object.entries(data).reduce((total, [key, item]) => {
    if (item.saved) total.saved++;
    if (item.completed && key.startsWith('article:')) total.read++;
    if (item.completed && key.startsWith('video:')) total.watched++;
    return total;
  }, { saved: 0, read: 0, watched: 0 });
}
