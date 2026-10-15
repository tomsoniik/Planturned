import Link from 'next/link';
import NewProjectButton from './NewProjectButton';
import styles from './SiteNav.module.css';

export function BrandMark() {
  return (
    <span className={styles.brand}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/zombie.png" alt="" width={22} height={23} className={styles.mark} />
      Planturned
    </span>
  );
}

/** overlay: przezroczysty pasek nad grafiką hero (strona główna). */
export default function SiteNav({ overlay }: { overlay?: boolean }) {
  return (
    <header className={styles.nav} data-overlay={overlay || undefined}>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/" aria-label="Strona główna">
          <BrandMark />
        </Link>
        <nav className={styles.links}>
          <Link href="/#funkcje">Funkcje</Link>
          <Link href="/#skroty">Skróty</Link>
          <Link href="/builder">Moje projekty</Link>
        </nav>
        <NewProjectButton />
      </div>
    </header>
  );
}
