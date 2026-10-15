"use client";

import { LANGS } from '@/lib/i18n';
import { useI18n } from './I18nProvider';
import styles from './LangSwitch.module.css';

/** PL | EN. Wybór zapisuje się w cookie i działa na całej stronie. */
export default function LangSwitch() {
  const { lang, t, setLang } = useI18n();
  return (
    <div className={styles.switch} role="radiogroup" aria-label={t.common.language}>
      {LANGS.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={lang === l}
          data-on={lang === l || undefined}
          onClick={() => lang !== l && setLang(l)}
          lang={l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
