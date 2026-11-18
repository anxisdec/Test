import Link from 'next/link';
import { Earth, PawPrint, Sprout } from 'lucide-react';
import type { Subject } from '@/lib/content';

export function Brand() {
  return <Link href="/" className="brand" aria-label="Cellula home">
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <path d="M20 29V19m0 2c-6.2 0-10-3.7-10-9.7 5.7.5 10 3.2 10 9.7Zm0 3c0-7 3.8-11.2 10.4-12.1 0 6.7-3.7 11-10.4 12.1Z" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.2 29.5h9.6M20 8.3v3.4m-1.7-1.7h3.4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    </span>
    <span className="brand-type">cellula<span>.</span></span>
  </Link>;
}

export function SubjectIcon({ subject, size = 24 }: { subject: Subject; size?: number }) {
  const Icon = subject === 'zoology' ? PawPrint : subject === 'botany' ? Sprout : Earth;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}

export type Expression = 'calm' | 'happy' | 'thinking' | 'aware';
export function GuruFace({ expression = 'calm' }: { expression?: Expression }) {
  return <span className={`guru-face guru-${expression}`} aria-hidden="true">
    <svg viewBox="0 0 44 44" fill="none">
      <path d="M21.8 15.1v-3.5m0 1.1c-.2-3-2.3-4.2-4.9-4.4.6 2.8 2.2 4.3 4.9 4.4Zm0 .2c.7-3.4 2.6-5.5 6-5.3-.4 3.2-2.6 5.2-6 5.3Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" strokeLinecap="round"/>
      <rect x="10" y="15" width="24" height="19" rx="7" fill="#fbffed" stroke="currentColor" strokeWidth="1.55"/>
      <path d="M8 22v5m28-5v5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round"/>
      {expression === 'happy' ? <path d="M15.7 24.2q1.5-2.8 3 0m6.6 0q1.5-2.8 3 0M19 27.3q3 5 6 0Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round"/> : <>
        <g className="guru-eyes" fill="currentColor"><ellipse cx="17.4" cy="23.4" rx="1.25" ry={expression === 'aware' ? '1.9' : '1.5'}/><ellipse cx="26.6" cy="23.4" rx="1.25" ry={expression === 'aware' ? '1.9' : '1.5'}/></g>
        {expression === 'thinking' ? <circle cx="22" cy="28" r="1.1" fill="currentColor"/> : <path d="M19.7 27.4q2.3 2.8 4.6 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>}
      </>}
    </svg>
  </span>;
}
