import Link from 'next/link';
import type { Icon } from '@phosphor-icons/react';
import { DiscordLogo, GithubLogo, LinkSimple, SteamLogo, YoutubeLogo } from '@phosphor-icons/react/dist/ssr';
import { BrandMark } from './SiteNav';
import { getContent } from '@/lib/cms/store';
import type { LinkIcon } from '@/lib/cms/schema';
import { getDict, getLang } from '@/lib/i18n-server';
import styles from './SiteFooter.module.css';

const ICONS: Record<LinkIcon, Icon> = {
  github: GithubLogo,
  steam: SteamLogo,
  discord: DiscordLogo,
  youtube: YoutubeLogo,
  link: LinkSimple,
};

/** Stopka: stałe linki do stron + linki z panelu /admin, drobny druk z autorem filmu w tle. */
export default async function SiteFooter() {
  const [t, lang, links, media] = await Promise.all([getDict(), getLang(), getContent('links'), getContent('media')]);
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.top}`}>
        <div className={styles.brand}>
          <BrandMark />
          <p>{t.home.tagline}</p>
        </div>
        <nav className={styles.links}>
          <Link href="/builder">{t.common.myProjects}</Link>
          <Link href="/changelog">{t.changelog.nav}</Link>
          {links.map((l) => {
            const IconFor = ICONS[l.icon];
            return (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                <IconFor size={16} weight="bold" />
                {l.label[lang]}
              </a>
            );
          })}
        </nav>
      </div>
      <div className={`wrap ${styles.bottom}`}>
        <p>© 2026 tomson</p>
        <p>
          {t.home.legal}{' '}
          <a href={`https://www.youtube.com/watch?v=${media.videoId}`} target="_blank" rel="noopener noreferrer">
            {t.home.videoCredit}
          </a>
        </p>
      </div>
    </footer>
  );
}
