import type { Metadata } from 'next';
import SiteNav from '@/components/SiteNav';
import { CHANGELOG } from '@/lib/changelog';
import { getDict, getLang } from '@/lib/i18n-server';
import styles from './changelog.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return { title: `${t.changelog.title} - Untmatica` };
}

export default async function ChangelogPage() {
  const lang = await getLang();
  const t = await getDict();
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <SiteNav />
      <main className={`wrap ${styles.page}`}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t.changelog.title}</h1>
          <p className={styles.sub}>{t.changelog.sub}</p>
        </header>

        <ol className={styles.releases}>
          {CHANGELOG.map((r) => (
            <li key={r.version} className={styles.release}>
              <div className={styles.meta}>
                <span className={styles.version}>{r.version}</span>
                <time dateTime={r.date}>{date.format(new Date(`${r.date}T12:00:00`))}</time>
              </div>
              <div className={styles.body}>
                <h2>{r.title[lang]}</h2>
                <ul>
                  {r.changes.map((c) => (
                    <li key={c.en}>{c[lang]}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
