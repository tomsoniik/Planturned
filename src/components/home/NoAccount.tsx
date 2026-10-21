import Link from 'next/link';
import type { Icon } from '@phosphor-icons/react';
import { ArrowRight, Globe, HardDrives, Translate, UserCircleDashed } from '@phosphor-icons/react/dist/ssr';
import { getContent } from '@/lib/cms/store';
import { getDict, getLang } from '@/lib/i18n-server';
import styles from './NoAccount.module.css';

/** Ikony w kolejności faktów z t.home.trust.facts. */
const ICONS: Icon[] = [Globe, UserCircleDashed, HardDrives, Translate];

/** Pas "Bez konta": fakty w jednym rzędzie + najnowsza wersja z changelogu (z CMS, nie na sztywno). */
export default async function NoAccount() {
  const [{ home }, lang, releases] = await Promise.all([getDict(), getLang(), getContent('changelog')]);
  const latest = releases[0];
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <section className={styles.section} aria-label={home.trust.facts.join(', ')}>
      <div className={`wrap ${styles.inner}`}>
        <ul className={styles.facts}>
          {home.trust.facts.map((fact, i) => {
            const IconFor = ICONS[i];
            return (
              <li key={fact}>
                <IconFor size={18} weight="bold" aria-hidden />
                {fact}
              </li>
            );
          })}
        </ul>

        {latest && (
          <Link href={`/changelog?v=${encodeURIComponent(latest.version)}`} className={styles.release}>
            <span className={styles.label}>{home.trust.latest}</span>
            <span className={styles.version}>{latest.version}</span>
            <span className={styles.meta}>
              {latest.title[lang]}, {date.format(new Date(`${latest.date}T12:00:00`))}
            </span>
            <span className={styles.more}>
              {home.trust.changelog}
              <ArrowRight size={14} weight="bold" aria-hidden />
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}
