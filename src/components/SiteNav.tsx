"use client";

import { useState } from 'react';
import Link from 'next/link';
import { List, X } from '@phosphor-icons/react';
import NewProjectButton from './NewProjectButton';
import LangSwitch from './LangSwitch';
import { useT } from './I18nProvider';
import styles from './SiteNav.module.css';

export function BrandMark() {
  return (
    <span className={styles.brand}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/logo-mark.png" alt="" width={22} height={24} className={styles.mark} />
      Untmatica
    </span>
  );
}

/**
 * overlay: przezroczysty pasek nad grafiką hero (strona główna).
 * Na telefonie linki i język chowają się w panelu pod przyciskiem menu.
 */
export default function SiteNav({ overlay }: { overlay?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className={styles.nav} data-overlay={overlay || undefined} data-open={open || undefined}>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/" aria-label={t.common.home} onClick={close}>
          <BrandMark />
        </Link>
        <div id="site-menu" className={styles.menu}>
          <nav className={styles.links}>
            <Link href="/builder" onClick={close}>{t.common.myProjects}</Link>
            <Link href="/changelog" onClick={close}>{t.changelog.nav}</Link>
          </nav>
          <LangSwitch />
        </div>
        <div className={styles.end}>
          <NewProjectButton />
          <button
            type="button"
            className={`icon-btn ${styles.menuBtn}`}
            aria-label={t.common.menu}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
          </button>
        </div>
      </div>
    </header>
  );
}
