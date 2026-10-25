import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** Panel i logowanie poza indeksem; reszta otwarta. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
