'use client';
import Link from 'next/link';
import { Compass } from 'lucide-react';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main-content" className="site-width short-page"><div className="empty-state"><Compass size={35} /><h1>We lost the trail for a moment</h1><p>This page couldn’t load. Try again or return to the field guide.</p><button type="button" className="button button-primary" onClick={reset}>Try again</button><Link className="text-link" href="/">Back to Cellula</Link></div></main>; }
