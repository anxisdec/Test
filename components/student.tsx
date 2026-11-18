'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { accountsEnabled, supabaseKey, supabaseUrl } from '@/lib/config';
import { readLocal, writeLocal } from '@/lib/browser-store';
import { guestProgressKey, mergeProgress, progressStats, type ItemProgress, type Progress } from '@/lib/progress';

let client: SupabaseClient | undefined;
export function browserDatabase() {
  return accountsEnabled ? client ||= createBrowserClient(supabaseUrl, supabaseKey) : null;
}

type Panel = 'sign-in' | 'saved' | 'search' | null;
type Student = {
  user: User | null;
  ready: boolean;
  isEditor: boolean;
  progress: Progress;
  mark: (key: string, field: 'saved' | 'completed') => void;
  importGuest: () => void;
  guestHasProgress: boolean;
  notify: (text: string) => void;
  panel: Panel;
  setPanel: (panel: Panel) => void;
};

const StudentContext = createContext<Student | null>(null);
export function useStudent() {
  const value = useContext(StudentContext);
  if (!value) throw new Error('Missing student provider');
  return value;
}

function getProgress(key: string): Progress {
  const value = readLocal<Progress>(key, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function pushProgress(userId: string, items: Progress) {
  const database = browserDatabase();
  if (!database) return;
  const rows = Object.entries(items).map(([key, value]) => ({ item_key: key, ...value }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await database.rpc('merge_student_progress', { p_user: userId, p_items: rows.slice(i, i + 100) });
    if (error) throw new Error('Progress sync failed');
  }
}

export function StudentProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!accountsEnabled);
  const [editorId, setEditor] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({});
  const [guestHasProgress, setGuestHasProgress] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const progressRef = useRef<Progress>({});
  const userId = user?.id;
  const storageKey = userId ? `cellula.progress.v1.${userId}` : guestProgressKey;
  const identity = useRef('');

  const notify = useCallback((text: string) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 3600);
  }, []);

  useEffect(() => {
    const database = browserDatabase();
    if (database) {
      const { data } = database.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setReady(true);
      });
      return () => data.subscription.unsubscribe();
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('auth') === 'link-error') {
      notify('That sign-in link couldn’t be verified. Please request a new one.');
      url.searchParams.delete('auth');
      window.history.replaceState(null, '', url);
    }
    return () => clearTimeout(timer.current);
  }, [notify]);

  useEffect(() => {
    if (!ready) return;
    identity.current = storageKey;
    let active = true;
    const local = getProgress(storageKey);
    progressRef.current = local;
    setProgress(local);
    setEditor(null);
    const database = browserDatabase();
    const guest = progressStats(getProgress(guestProgressKey));
    setGuestHasProgress(Boolean(guest.saved || guest.read || guest.watched));
    if (database && userId) {
      void database.from('editor_accounts').select('user_id').eq('user_id', userId).maybeSingle().then(({ data }) => { if (active) setEditor(data ? userId : null); });
      void database.from('student_progress').select('item_key, saved, completed, changed').eq('user_id', userId).limit(3000).then(({ data, error }) => {
        if (!active || error || !data) return;
        const cloud = Object.fromEntries(data.map(({ item_key, ...item }) => [item_key, item])) as Progress;
        const current = progressRef.current;
        const merged = mergeProgress(current, cloud);
        progressRef.current = merged;
        setProgress(merged);
        writeLocal(storageKey, merged);
        const dirty = Object.fromEntries(Object.entries(current).filter(([key, item]) => !cloud[key] || item.changed > cloud[key].changed));
        void pushProgress(userId, dirty).catch(() => { if (active) notify('Progress is on this device. Cloud sync will retry on your next visit.'); });
      });
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) {
        progressRef.current = getProgress(storageKey);
        setProgress(progressRef.current);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { active = false; window.removeEventListener('storage', onStorage); };
  }, [ready, storageKey, userId, notify]);

  const mark = (key: string, field: 'saved' | 'completed') => {
    if (!ready || identity.current !== storageKey) return;
    const latest = mergeProgress(progressRef.current, getProgress(storageKey));
    const before: ItemProgress = latest[key] || { saved: false, completed: false, changed: 0 };
    const item = { ...before, [field]: !before[field], changed: Math.max(Date.now(), before.changed + 1) };
    const next = { ...latest, [key]: item };
    progressRef.current = next;
    setProgress(next);
    const stored = writeLocal(storageKey, next);
    if (!stored && !userId) notify('Browser storage is unavailable; this change is only saved until you leave.');
    else if (field === 'saved') notify(item.saved ? 'Saved to your field bag' : 'Removed from your field bag');
    if (userId) void pushProgress(userId, { [key]: item }).catch(() => {
      if (identity.current === storageKey) notify(stored ? 'Progress is on this device. Cloud sync will retry later.' : 'Couldn’t save this change to your device or account.');
    });
  };

  const importGuest = () => {
    if (!userId || identity.current !== storageKey) return;
    const guest = getProgress(guestProgressKey);
    const changed: Progress = {};
    const merged = { ...progressRef.current };
    Object.entries(guest).forEach(([key, item]) => {
      const previous = merged[key];
      if ((item.saved && !previous?.saved) || (item.completed && !previous?.completed)) {
        merged[key] = changed[key] = { saved: item.saved || !!previous?.saved, completed: item.completed || !!previous?.completed, changed: Date.now() };
      }
    });
    progressRef.current = merged;
    setProgress(merged);
    writeLocal(storageKey, merged);
    void pushProgress(userId, changed).then(() => notify('Guest progress copied to your account')).catch(() => notify('Guest progress copied on this device. Cloud sync will retry later.'));
  };

  return <StudentContext.Provider value={{ user, ready, isEditor: !!userId && editorId === userId, progress, mark, importGuest, guestHasProgress, notify, panel, setPanel }}>
    {children}
    <div className={`app-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
  </StudentContext.Provider>;
}
