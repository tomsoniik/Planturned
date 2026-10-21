import type { Metadata } from 'next';
import { createHash } from 'node:crypto';
import Link from 'next/link';
import { GithubLogo, SignOut, Warning } from '@phosphor-icons/react/dist/ssr';
import { BrandMark } from '@/components/SiteNav';
import { authConfig, getAdmin } from '@/lib/cms/auth';
import { cmsConfigured, getContent } from '@/lib/cms/store';
import { ChangelogEditor, LinksEditor, MediaEditor, SeoEditor } from './editors';
import styles from './admin.module.css';

export const metadata: Metadata = {
  title: 'Panel - Untmatica',
  robots: { index: false, follow: false },
};

/** Klucz edytora z treści: po zapisie lub przywróceniu domyślnych edytor startuje od nowa z danymi z bazy. */
const withKey = <T,>(initial: T) => ({ key: createHash('sha1').update(JSON.stringify(initial)).digest('hex'), initial });

const TABS = [
  { id: 'changelog', label: 'Changelog' },
  { id: 'media', label: 'Tło i media' },
  { id: 'links', label: 'Linki i SEO' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const ERRORS: Record<string, string> = {
  config: 'Logowanie nie jest skonfigurowane. Ustaw zmienne środowiskowe opisane niżej.',
  state: 'Sesja logowania wygasła albo jest niepoprawna. Spróbuj jeszcze raz.',
  github: 'GitHub nie potwierdził logowania. Spróbuj jeszcze raz.',
  denied: 'To konto GitHub nie ma dostępu do panelu.',
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string }> }) {
  const { tab, error } = await searchParams;
  const admin = await getAdmin();

  if (!admin) {
    const configured = authConfig() !== null;
    return (
      <main className={styles.loginWrap}>
        <div className={styles.loginCard}>
          <BrandMark />
          <h1>Panel administratora</h1>
          <p>Zaloguj się kontem GitHub, żeby edytować changelog, tło i linki na stronie.</p>
          {error && ERRORS[error] && <p className={styles.error}>{ERRORS[error]}</p>}
          {configured ? (
            <a href="/api/auth/github" className="btn btn-primary btn-lg">
              <GithubLogo size={18} weight="bold" />
              Zaloguj przez GitHub
            </a>
          ) : (
            <div className={styles.setup}>
              <p>Brakuje konfiguracji. Ustaw w Vercelu (Settings, Environment Variables):</p>
              <ul>
                <li><code>GITHUB_CLIENT_ID</code> i <code>GITHUB_CLIENT_SECRET</code> z aplikacji OAuth na GitHubie</li>
                <li><code>AUTH_SECRET</code>: losowy ciąg, min. 32 znaki</li>
                <li><code>ADMIN_GITHUB_LOGIN</code>: Twój login na GitHubie</li>
              </ul>
            </div>
          )}
          <Link href="/" className={styles.back}>Wróć na stronę</Link>
        </div>
      </main>
    );
  }

  const active: TabId = TABS.some((t) => t.id === tab) ? (tab as TabId) : 'changelog';

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Link href="/" aria-label="Strona główna">
            <BrandMark />
          </Link>
          <span className={styles.barTitle}>Panel</span>
          <nav className={styles.tabs}>
            {TABS.map((t) => (
              <Link key={t.id} href={`/admin?tab=${t.id}`} className={styles.tab} data-active={t.id === active || undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
          <form action="/api/auth/logout" method="post" className={styles.logout}>
            <span>{admin}</span>
            <button className="icon-btn" title="Wyloguj" aria-label="Wyloguj">
              <SignOut size={16} weight="bold" />
            </button>
          </form>
        </div>
      </header>

      <main className={styles.main}>
        {!cmsConfigured() && (
          <p className={styles.warn}>
            <Warning size={18} weight="bold" />
            Baza nie jest podłączona: strona pokazuje treści domyślne, a zapis nie zadziała. Dodaj integrację Upstash Redis w Vercelu.
          </p>
        )}

        {active === 'changelog' && <ChangelogEditor {...withKey(await getContent('changelog'))} />}
        {active === 'media' && <MediaEditor {...withKey(await getContent('media'))} />}
        {active === 'links' && (
          <>
            <LinksEditor {...withKey(await getContent('links'))} />
            <SeoEditor {...withKey(await getContent('seo'))} />
          </>
        )}
      </main>
    </div>
  );
}
