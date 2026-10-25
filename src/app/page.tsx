import type { Metadata } from 'next';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import NewProjectButton from '@/components/NewProjectButton';
import HeroPreview from '@/components/HeroPreview';
import HeroVideo from '@/components/HeroVideo';
import Tour from '@/components/home/Tour';
import NoAccount from '@/components/home/NoAccount';
import FinalCta from '@/components/home/FinalCta';
import { getContent } from '@/lib/cms/store';
import { getDict } from '@/lib/i18n-server';
import styles from './page.module.css';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function Home() {
  const [t, media] = await Promise.all([getDict(), getContent('media')]);
  return (
    <>
      <SiteNav overlay />
      <div className={styles.page}>
        <HeroVideo media={media} />
        <main className={`wrap ${styles.hero}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/logo-mark.png" alt="" width={56} height={60} className={`${styles.mark} ${styles.enter}`} />
          <h1 className={`${styles.heroTitle} ${styles.enter}`} style={{ animationDelay: '60ms' }}>
            {t.home.title}
          </h1>
          <p className={`${styles.heroSub} ${styles.enter}`} style={{ animationDelay: '120ms' }}>
            {t.home.sub}
          </p>
          <div className={`${styles.heroCtas} ${styles.enter}`} style={{ animationDelay: '180ms' }}>
            <NewProjectButton size="lg" />
            <Link href="/builder" className="btn btn-ghost btn-lg">
              {t.common.myProjects}
            </Link>
          </div>
        </main>

        {media.preview3d && (
          <section className={`wrap ${styles.stageWrap}`}>
            <div className={`${styles.stage} ${styles.stageEnter}`}>
              <HeroPreview />
            </div>
            <p className={styles.previewCaption}>{t.home.previewCaption}</p>
          </section>
        )}

        <Tour />
        <NoAccount />
        <FinalCta />

        <SiteFooter />
      </div>
    </>
  );
}
