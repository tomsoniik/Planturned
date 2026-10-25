import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** Publiczne strony. Projekty (/builder/[id]) żyją w przeglądarce użytkownika, więc ich tu nie ma. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/builder`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/changelog`, changeFrequency: 'weekly', priority: 0.7 },
  ];
}
