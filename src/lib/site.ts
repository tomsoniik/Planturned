/** Adres produkcji na Vercelu; lokalnie localhost. Potrzebny dla OG, canonical, robots i sitemap. */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000';
