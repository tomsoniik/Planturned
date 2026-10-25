import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import HeroVideo from '@/components/HeroVideo';
import { getContent } from '@/lib/cms/store';
import { getDict, getLang } from '@/lib/i18n-server';
import styles from './changelog.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return { title: `${t.changelog.title} - Untmatica`, alternates: { canonical: '/changelog' } };
}

/** Adres wersji: parametr ?v= (da się go wysłać ekipie). */
const versionHref = (version: string) => `/changelog?v=${encodeURIComponent(version)}`;
/** Z listy na dole: przewinięcie do posta u góry. */
const listHref = (version: string) => `${versionHref(version)}#post`;

/**
 * U góry jeden post (wybrana wersja, domyślnie najnowsza), pod nim lista wszystkich wersji.
 * Kliknięcie w wiersz listy otwiera tę wersję u góry.
 */
export default async function ChangelogPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const [{ v }, lang, t, releases, media] = await Promise.all([
    searchParams,
    getLang(),
    getDict(),
    getContent('changelog'),
    getContent('media'),
  ]);
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  const fmt = (d: string) => date.format(new Date(`${d}T12:00:00`));

  const index = Math.max(0, releases.findIndex((r) => r.version === v));
  const post = releases[index];
  const newer = releases[index - 1];
  const older = releases[index + 1];

  return (
    <>
      <SiteNav overlay />
      <div className={styles.shell}>
        <HeroVideo media={media} still />
        <main className={`wrap ${styles.page}`}>
          <header className={styles.header}>
            <h1 className={styles.title}>{t.changelog.title}</h1>
            <p className={styles.sub}>{t.changelog.sub}</p>
          </header>

          {post && (
            <article id="post" className={styles.release} data-latest={index === 0 || undefined}>
              <div className={styles.meta}>
                <span className={styles.version}>{post.version}</span>
                <time dateTime={post.date}>{fmt(post.date)}</time>
                {index === 0 && <span className={styles.latest}>{t.changelog.latest}</span>}
              </div>
              <div className={styles.body}>
                <h2>{post.title[lang]}</h2>
                <ul>
                  {post.changes.map((c, j) => (
                    <li key={j}>{c[lang]}</li>
                  ))}
                </ul>
                {/* Bez przewijania: strona zostaje w miejscu, zmienia się tylko post */}
                {(newer || older) && (
                  <nav className={styles.pager} aria-label={t.changelog.all}>
                    {newer ? (
                      <Link href={versionHref(newer.version)} scroll={false}>
                        <ArrowLeft size={16} weight="bold" />
                        {t.changelog.newer}
                      </Link>
                    ) : <span />}
                    {older && (
                      <Link href={versionHref(older.version)} scroll={false}>
                        {t.changelog.older}
                        <ArrowRight size={16} weight="bold" />
                      </Link>
                    )}
                  </nav>
                )}
              </div>
            </article>
          )}

          {releases.length > 1 && (
            <section className={styles.all} aria-labelledby="all-heading">
              <h2 id="all-heading" className={styles.allTitle}>
                {t.changelog.all}
              </h2>
              <ol className={styles.list}>
                {releases.map((r, i) => (
                  <li key={r.version}>
                    <Link href={listHref(r.version)} className={styles.row} aria-current={i === index ? 'true' : undefined}>
                      <span className={styles.version}>{r.version}</span>
                      <span className={styles.rowTitle}>{r.title[lang]}</span>
                      <time dateTime={r.date}>{fmt(r.date)}</time>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
