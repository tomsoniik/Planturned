"use client";

import Link from 'next/link';
import NewProjectButton from './NewProjectButton';
import LangSwitch from './LangSwitch';
import { useT } from './I18nProvider';
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
  const t = useT();
  return (
    <header className={styles.nav} data-overlay={overlay || undefined}>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/" aria-label={t.common.home}>
          <BrandMark />
        </Link>
        <nav className={styles.links}>
          <Link href="/builder">{t.common.myProjects}</Link>
          <Link href="/changelog">{t.changelog.nav}</Link>
        </nav>
        <LangSwitch />
        <NewProjectButton />
      </div>
    </header>
  );
}
