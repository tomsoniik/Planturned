"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DICTS, LANG_COOKIE, type Dict, type Lang } from '@/lib/i18n';

type Ctx = { lang: Lang; t: Dict; setLang: (lang: Lang) => void };

const I18nContext = createContext<Ctx | null>(null);

export default function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState(initialLang);
  const router = useRouter();

  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      setLangState(next);
      // komponenty serwerowe (strona główna, tytuł) czytają cookie przy renderze
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ lang, t: DICTS[lang], setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n poza I18nProvider');
  return ctx;
}

export const useT = () => useI18n().t;
