import { cookies, headers } from 'next/headers';
import { DICTS, LANG_COOKIE, isLang, langFromAcceptLanguage, type Lang } from './i18n';

/** Język żądania: cookie z przełącznika, a bez niego Accept-Language przeglądarki. */
export async function getLang(): Promise<Lang> {
  const fromCookie = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(fromCookie)) return fromCookie;
  return langFromAcceptLanguage((await headers()).get('accept-language'));
}

export async function getDict() {
  return DICTS[await getLang()];
}
