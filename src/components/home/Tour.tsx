import { getDict, getLang } from '@/lib/i18n-server';
import TourClient, { type TourSlide } from './TourClient';
import styles from './Tour.module.css';

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

/** Zrzut z aplikacji w języku strony (public/home/<lang>/), 16:10. */
function Shot({ lang, file, alt, width, height }: { lang: string; file: string; alt: string; width: number; height: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/home/${lang}/${file}`} alt={alt} width={width} height={height} loading="lazy" decoding="async" className={styles.shot} />
  );
}

/**
 * "Jak to działa" jako jedno okno: 7 funkcji (3 kroki + 4 zasady z gry), obraz i opis zmieniają się
 * w miejscu zamiast długiego przewijania. Treść i obrazy składa serwer, przełączanie robi TourClient.
 */
export default async function Tour() {
  const [{ home }, lang] = await Promise.all([getDict(), getLang()]);
  const [draw, walk, share] = home.how.steps;
  const r = home.rules;

  const slides: TourSlide[] = [
    { id: 'draw', title: draw.title, text: draw.text, media: <Shot lang={lang} file="plan.webp" alt={draw.alt} width={1280} height={800} /> },
    { id: 'walk', title: walk.title, text: walk.text, media: <Shot lang={lang} file="sandbox.webp" alt={walk.alt} width={1280} height={800} /> },
    { id: 'share', title: share.title, text: share.text, media: <Shot lang={lang} file="export.webp" alt={share.alt} width={960} height={600} /> },
    {
      id: 'maps',
      title: r.maps.title,
      text: r.maps.text,
      media: (
        <ul className={styles.maps} aria-label={home.tour.mapsAlt}>
          {MAPS.map((m) => (
            <li key={m.slug}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/home/maps/${m.slug}.webp`} alt="" width={320} height={320} loading="lazy" decoding="async" />
              <span>{m.name}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'limits',
      title: r.limits.title,
      text: r.limits.text,
      media: (
        <div className={styles.scale} role="img" aria-label={`${r.limits.ceiling} ${HEIGHT_LIMIT} m, ${r.limits.oxygen} ${OXYGEN_LINE.toLocaleString(lang)} m`}>
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
      ),
    },
    { id: 'bed', title: r.bed.title, text: r.bed.text, media: <Shot lang={lang} file="bed.webp" alt={r.bed.alt} width={970} height={606} /> },
    {
      id: 'controls',
      title: r.controls.title,
      text: r.controls.text,
      media: (
        <div className={styles.keys} aria-hidden>
          <div className={styles.keyGroup}>
            <div className={styles.keyRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </div>
            <span>{r.controls.hotbar}</span>
          </div>
          <div className={styles.keyLine}>
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
        </div>
      ),
    },
  ];

  return (
    <TourClient
      title={home.how.title}
      sub={home.how.sub}
      label={home.tour.label}
      prev={home.tour.prev}
      next={home.tour.next}
      slides={slides}
    />
  );
}
