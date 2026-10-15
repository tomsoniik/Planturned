import Link from 'next/link';
import SiteNav, { BrandMark } from '@/components/SiteNav';
import NewProjectButton from '@/components/NewProjectButton';
import HeroPreview from '@/components/HeroPreview';
import styles from './page.module.css';

export default function Home() {
  return (
    <>
      <SiteNav overlay />
      <div className={styles.heroBand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/washington.jpg" alt="" className={styles.heroArt} fetchPriority="high" />
        <main className={`wrap ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <h1 className={`${styles.heroTitle} ${styles.enter}`}>Zaplanuj bazę, zanim ją postawisz.</h1>
            <p className={`${styles.heroSub} ${styles.enter}`} style={{ animationDelay: '80ms' }}>
              Planer baz do Unturned. Rysujesz w 2D, potem chodzisz po bazie w 3D na prawdziwej mapie z gry.
            </p>
            <div className={`${styles.heroCtas} ${styles.enter}`} style={{ animationDelay: '160ms' }}>
              <NewProjectButton size="lg" />
              <Link href="/builder" className="btn btn-ghost btn-lg">
                Moje projekty
              </Link>
            </div>
          </div>

          <div className={`${styles.heroVisual} ${styles.enter}`} style={{ animationDelay: '120ms' }}>
            <div className={styles.previewFrame}>
              <HeroPreview />
            </div>
            <p className={styles.previewCaption}>Przykładowa baza 4x3. Przeciągnij, żeby obrócić.</p>
          </div>
        </main>

        <footer className={`wrap ${styles.footer}`}>
          <BrandMark />
          <p>Projekt fanowski. Unturned należy do Smartly Dressed Games. Tło: Washington Landscape (Phobia), ekran ładowania z gry.</p>
        </footer>
      </div>
    </>
  );
}
