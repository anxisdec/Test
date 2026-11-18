import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CatalogProvider } from '@/components/catalog';
import { Footer, GlobalPanels, Header, TvNavigation } from '@/components/chrome';
import { GuruWidget } from '@/components/guru';
import { StudentProvider } from '@/components/student';
import { getEntries } from '@/lib/entries-server';
import { localPreview } from '@/lib/config';
import './styles.css';

const theme = `try{const t=localStorage.getItem('cellula.theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){}`;
const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://cellula.in';
const index = !localPreview && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production');
export const revalidate = 300;
export const metadata: Metadata = {
  title: { default: 'Cellula — The Life Science Field Guide', template: '%s | Cellula' },
  description: 'Explore zoology, botany, and environmental science through thoughtful field notes, video lessons, and a study tutor.',
  metadataBase: new URL(site),
  icons: { icon: '/icon.svg' },
  robots: { index, follow: index },
  openGraph: { type: 'website', siteName: 'Cellula', images: [{ url: '/images/hero-fern.webp', width: 1792, height: 592 }] },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const catalog = await getEntries().catch(() => []);
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: theme }} /></head>
    <body><StudentProvider><CatalogProvider initial={catalog}>
      <Header />{children}<Footer /><GuruWidget /><GlobalPanels /><TvNavigation />
    </CatalogProvider></StudentProvider></body>
  </html>;
}
