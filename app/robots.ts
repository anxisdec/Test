import type { MetadataRoute } from 'next';
import { localPreview } from '@/lib/config';
export default function robots(): MetadataRoute.Robots {
  if (localPreview || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/studio', '/api/', '/auth/'] }], sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://cellula.in'}/sitemap.xml` };
}
