'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children, leading, className = '' }: { title: string; onClose: () => void; children: ReactNode; leading?: ReactNode; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} className={`app-dialog ${className}`}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-inner">
      <div className="dialog-top"><div className="dialog-heading">{leading}<h2 id={titleId}>{title}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21} /></button></div>
      {children}
    </div>
  </dialog>;
}
