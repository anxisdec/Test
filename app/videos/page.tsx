import { BrowsePage } from '@/components/landing';
export const metadata = { title: 'Video library', alternates: { canonical: '/videos' } };
export default function Page() { return <BrowsePage kind="video" />; }
