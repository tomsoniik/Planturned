import Link from 'next/link';
import NewProjectButton from './NewProjectButton';
import styles from './SiteNav.module.css';

export function BrandMark() {
  return (
    <span className={styles.brand}>
      <span className={styles.mark} aria-hidden />
      Base Planner
    </span>
  );
}

export default function SiteNav() {
  return (
    <header className={styles.nav}>
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
