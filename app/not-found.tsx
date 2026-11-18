import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
export default function NotFound() { return <main id="main-content" className="site-width short-page"><div className="empty-state"><Compass size={35} /><h1>Off the trail</h1><p>That page isn’t in the field guide. Try the library instead.</p><Link className="button button-primary" href="/explore">Explore field notes <ArrowRight size={17} /></Link></div></main>; }
