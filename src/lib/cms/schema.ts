/*
  Treści edytowane w panelu /admin. Każdy klucz to jeden JSON w Redisie.
  Bez bazy (albo bez zapisanego klucza) strona używa wartości domyślnych z tego pliku.
  Walidacja tutaj, bo zapis przychodzi z formularza: wszystko z zewnątrz jest niezaufane.
*/
import { CHANGELOG, type Release } from '../changelog';
import { DICTS, LANGS, type Lang } from '../i18n';

export type Text = Record<Lang, string>;

export interface Media {
  /** ID filmu z YouTube (11 znaków) */
  videoId: string;
  /** Pętla od-do w sekundach; end 0 = do końca filmu */
  start: number;
  end: number;
  /** Własny obrazek przed startem filmu; pusty = miniatura z YouTube */
  poster: string;
  /** Obracana baza 3D na stronie głównej */
  preview3d: boolean;
}

export type LinkIcon = 'github' | 'steam' | 'discord' | 'youtube' | 'link';
export const LINK_ICONS: LinkIcon[] = ['github', 'steam', 'discord', 'youtube', 'link'];

export interface FooterLink {
  label: Text;
  href: string;
  icon: LinkIcon;
}

export interface Seo {
  title: Text;
  description: Text;
  /** Obrazek do udostępniania (Open Graph); pusty = brak */
  ogImage: string;
}

export interface CmsContent {
  changelog: Release[];
  media: Media;
  links: FooterLink[];
  seo: Seo;
}

export type CmsKey = keyof CmsContent;

export const CMS_DEFAULTS: CmsContent = {
  changelog: CHANGELOG,
  media: { videoId: 'tPyg-Nm6bfg', start: 5, end: 68, poster: '', preview3d: true },
  links: [
    { label: { pl: 'GitHub', en: 'GitHub' }, href: 'https://github.com/tomsoniik/Planturned', icon: 'github' },
    { label: { pl: 'Unturned na Steam', en: 'Unturned on Steam' }, href: 'https://store.steampowered.com/app/304930/Unturned/', icon: 'steam' },
  ],
  seo: {
    title: { pl: DICTS.pl.meta.title, en: DICTS.en.meta.title },
    description: { pl: DICTS.pl.meta.description, en: DICTS.en.meta.description },
    ogImage: '',
  },
};

export class CmsError extends Error {}

const fail = (msg: string): never => {
  throw new CmsError(msg);
};

const str = (v: unknown, max: number, field: string): string => {
  if (typeof v !== 'string') fail(`${field}: oczekiwano tekstu`);
  const s = (v as string).trim();
  if (s.length > max) fail(`${field}: maksymalnie ${max} znaków`);
  return s;
};

const text = (v: unknown, max: number, field: string, required = true): Text => {
  const o = (v ?? {}) as Record<string, unknown>;
  const out = {} as Text;
  for (const l of LANGS) {
    out[l] = str(o[l] ?? '', max, `${field} (${l.toUpperCase()})`);
    if (required && !out[l]) fail(`${field} (${l.toUpperCase()}): pole jest wymagane`);
  }
  return out;
};

/** Tylko http(s); pusty dozwolony, gdy optional. Chroni przed javascript: w linkach. */
const url = (v: unknown, field: string, optional = false): string => {
  const s = str(v ?? '', 500, field);
  if (!s && optional) return '';
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return fail(`${field}: niepoprawny adres`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') fail(`${field}: tylko adresy http(s)`);
  return u.toString();
};

const int = (v: unknown, min: number, max: number, field: string): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(`${field}: liczba całkowita od ${min} do ${max}`);
  return n;
};

export function parseMedia(v: unknown): Media {
  const o = (v ?? {}) as Record<string, unknown>;
  const videoId = str(o.videoId, 11, 'ID filmu');
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) fail('ID filmu: 11 znaków z adresu YouTube (po v=)');
  const start = int(o.start, 0, 36000, 'Start');
  const end = int(o.end, 0, 36000, 'Koniec');
  if (end !== 0 && end <= start) fail('Koniec musi być większy niż start (albo 0 = do końca filmu)');
  return { videoId, start, end, poster: url(o.poster, 'Poster', true), preview3d: o.preview3d === true };
}

export function parseLinks(v: unknown): FooterLink[] {
  if (!Array.isArray(v)) fail('Linki: oczekiwano listy');
  const list = v as unknown[];
  if (list.length > 12) fail('Linki: maksymalnie 12');
  return list.map((raw, i) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const icon = LINK_ICONS.includes(o.icon as LinkIcon) ? (o.icon as LinkIcon) : 'link';
    return { label: text(o.label, 40, `Link ${i + 1}: nazwa`), href: url(o.href, `Link ${i + 1}: adres`), icon };
  });
}

export function parseSeo(v: unknown): Seo {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    title: text(o.title, 70, 'Tytuł strony'),
    description: text(o.description, 200, 'Opis strony'),
    ogImage: url(o.ogImage, 'Obrazek do udostępniania', true),
  };
}

export function parseChangelog(v: unknown): Release[] {
  if (!Array.isArray(v)) fail('Changelog: oczekiwano listy');
  const list = v as unknown[];
  if (list.length > 200) fail('Changelog: maksymalnie 200 wersji');
  const seen = new Set<string>();
  return list.map((raw, i) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const field = `Wersja ${i + 1}`;
    const version = str(o.version, 20, `${field}: numer`);
    if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`${field}: numer w formacie 1.2.3`);
    if (seen.has(version)) fail(`${field}: wersja ${version} jest już na liście`);
    seen.add(version);
    const date = str(o.date, 10, `${field}: data`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) fail(`${field}: data RRRR-MM-DD`);
    if (!Array.isArray(o.changes) || o.changes.length === 0) fail(`${field}: dodaj co najmniej jedną zmianę`);
    const changes = (o.changes as unknown[]).slice(0, 40).map((c, j) => text(c, 600, `${field}, zmiana ${j + 1}`));
    return { version, date, title: text(o.title, 80, `${field}: tytuł`), changes };
  });
}

export const CMS_PARSERS: { [K in CmsKey]: (v: unknown) => CmsContent[K] } = {
  changelog: parseChangelog,
  media: parseMedia,
  links: parseLinks,
  seo: parseSeo,
};
