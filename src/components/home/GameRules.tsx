import { getDict, getLang } from '@/lib/i18n-server';
import styles from './GameRules.module.css';

/** Podglądy map z plików gry (public/maps/<mapa>/overview.jpg, zmniejszone do public/home/maps). */
const MAPS = [
  { slug: 'washington', name: 'Washington' },
  { slug: 'russia', name: 'Russia' },
  { slug: 'pei', name: 'PEI' },
  { slug: 'germany', name: 'Germany' },
  { slug: 'yukon', name: 'Yukon' },
  { slug: 'alpha-valley', name: 'Alpha Valley' },
];

/** Limity z public/maps/<mapa>/meta.json: heightLimit 1024 m na wszystkich mapach, oxygenLine Washington 524,8 m. */
const HEIGHT_LIMIT = 1024;
const OXYGEN_LINE = 524.8;

/** Sekcja "Zasady z gry": nierówna siatka 4 kafelków (duży z mapami + 3 mniejsze). */
export default async function GameRules() {
  const [{ home }, lang] = await Promise.all([getDict(), getLang()]);
  const r = home.rules;
  return (
    <section className={styles.section} aria-labelledby="rules-title">
      <div className="wrap">
        <h2 id="rules-title" className={styles.title}>{r.title}</h2>

        <div className={styles.bento}>
          <article className={`${styles.tile} ${styles.maps}`}>
            <ul className={styles.mapGrid}>
              {MAPS.map((m) => (
                <li key={m.slug}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/home/maps/${m.slug}.webp`} alt="" width={320} height={320} loading="lazy" decoding="async" />
                  <span>{m.name}</span>
                </li>
              ))}
            </ul>
            <div className={styles.copy}>
              <h3>{r.maps.title}</h3>
              <p>{r.maps.text}</p>
            </div>
          </article>

          <article className={`${styles.tile} ${styles.limits}`}>
            {/* Skala wysokości: liczby z plików map, położenie linii w proporcji do limitu */}
            <div className={styles.scale} aria-hidden>
              <div className={styles.line} data-kind="ceiling" style={{ bottom: '100%' }}>
                <span>{r.limits.ceiling}</span>
                <b>{HEIGHT_LIMIT} m</b>
              </div>
              <div className={styles.line} data-kind="oxygen" style={{ bottom: `${(OXYGEN_LINE / HEIGHT_LIMIT) * 100}%` }}>
                <span>{r.limits.oxygen}</span>
                <b>{OXYGEN_LINE.toLocaleString(lang)} m</b>
              </div>
              <div className={styles.line} data-kind="ground" style={{ bottom: 0 }}>
                <span>{r.limits.ground}</span>
              </div>
            </div>
            <div className={styles.copy}>
              <h3>{r.limits.title}</h3>
              <p>{r.limits.text}</p>
            </div>
          </article>

          <article className={`${styles.tile} ${styles.bed}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/home/bed-claim.webp" alt={r.bed.alt} width={640} height={640} loading="lazy" decoding="async" className={styles.bedShot} />
            <div className={styles.copy}>
              <h3>{r.bed.title}</h3>
              <p>{r.bed.text}</p>
            </div>
          </article>

          <article className={`${styles.tile} ${styles.controls}`}>
            <div className={styles.keys} aria-hidden>
              <div className={styles.keyGroup}>
                <div className={styles.keyRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <kbd key={n}>{n}</kbd>
                  ))}
                </div>
                <span>{r.controls.hotbar}</span>
              </div>
              <div className={styles.keyGroup}>
                <kbd>E</kbd>
                <span>{r.controls.inventory}</span>
              </div>
              <div className={styles.keyGroup}>
                <div className={styles.keyRow}>
                  <kbd>T</kbd>
                  <code className={styles.command}>/time night</code>
                </div>
                <span>{r.controls.chat}</span>
              </div>
            </div>
            <div className={styles.copy}>
              <h3>{r.controls.title}</h3>
              <p>{r.controls.text}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
