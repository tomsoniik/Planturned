import 'server-only';
import { cache } from 'react';
import { Redis } from '@upstash/redis';
import { CMS_DEFAULTS, CMS_PARSERS, CmsError, type CmsContent, type CmsKey } from './schema';

/*
  Treści CMS w Upstash Redis. Integracja z Vercel Marketplace ustawia KV_REST_API_*,
  ręczna konfiguracja UPSTASH_REDIS_REST_*; działają obie.
*/
const KEY_PREFIX = 'cms:';

let client: Redis | null | undefined;

function redis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

export const cmsConfigured = () => redis() !== null;

/**
 * Treść z bazy albo domyślna. Uszkodzony lub stary JSON w bazie nie wywala strony:
 * wtedy też wracają wartości domyślne. Jeden odczyt na klucz w obrębie żądania.
 */
export const getContent = cache(async <K extends CmsKey>(key: K): Promise<CmsContent[K]> => {
  const db = redis();
  if (!db) return CMS_DEFAULTS[key];
  try {
    const raw = await db.get(KEY_PREFIX + key);
    return raw == null ? CMS_DEFAULTS[key] : CMS_PARSERS[key](raw);
  } catch (e) {
    console.error(`[cms] odczyt "${key}" nie powiódł się, używam domyślnych`, e);
    return CMS_DEFAULTS[key];
  }
});

/** Waliduje i zapisuje. Rzuca CmsError z komunikatem dla admina. */
export async function setContent<K extends CmsKey>(key: K, value: unknown): Promise<CmsContent[K]> {
  const db = redis();
  if (!db) throw new CmsError('Baza nie jest podłączona (brak zmiennych Upstash Redis).');
  const parsed = CMS_PARSERS[key](value);
  await db.set(KEY_PREFIX + key, parsed);
  return parsed;
}

/** Usuwa zapis, strona wraca do wartości domyślnych z kodu. */
export async function resetContent(key: CmsKey) {
  const db = redis();
  if (!db) throw new CmsError('Baza nie jest podłączona (brak zmiennych Upstash Redis).');
  await db.del(KEY_PREFIX + key);
}
