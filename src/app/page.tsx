import Link from 'next/link';
import SiteNav, { BrandMark } from '@/components/SiteNav';
import NewProjectButton from '@/components/NewProjectButton';
import HeroPreview from '@/components/HeroPreview';
import { getDict } from '@/lib/i18n-server';
import styles from './page.module.css';

export default async function Home() {
  const t = await getDict();
  return (
    <>
      <SiteNav overlay />
      <div className={styles.heroBand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/washington.jpg" alt="" className={styles.heroArt} fetchPriority="high" />
        <main className={`wrap ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <h1 className={`${styles.heroTitle} ${styles.enter}`}>{t.home.title}</h1>
            <p className={`${styles.heroSub} ${styles.enter}`} style={{ animationDelay: '80ms' }}>
              {t.home.sub}
            </p>
            <div className={`${styles.heroCtas} ${styles.enter}`} style={{ animationDelay: '160ms' }}>
              <NewProjectButton size="lg" />
              <Link href="/builder" className="btn btn-ghost btn-lg">
                {t.common.myProjects}
              </Link>
            </div>
          </div>

          <div className={`${styles.heroVisual} ${styles.enter}`} style={{ animationDelay: '120ms' }}>
            <div className={styles.previewFrame}>
              <HeroPreview />
            </div>
            <p className={styles.previewCaption}>{t.home.previewCaption}</p>
          </div>
        </main>

        <footer className={`wrap ${styles.footer}`}>
          <BrandMark />
          <p>{t.home.footer}</p>
        </footer>
      </div>
    </>
  );
}
