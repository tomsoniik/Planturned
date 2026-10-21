import { getDict } from '@/lib/i18n-server';
import styles from './HowItWorks.module.css';

/** Zrzuty z aplikacji w kolejności kroków (public/home, 1280x800 i 810x425). */
const SHOTS = [
  { src: '/home/plan-2d.webp', width: 1280, height: 800 },
  { src: '/home/sandbox-3d.webp', width: 1280, height: 800 },
  { src: '/home/share-file.webp', width: 810, height: 425 },
];

/** Sekcja "Jak to działa": tytuł przyklejony po lewej, trzy kroki ze zrzutami po prawej. */
export default async function HowItWorks() {
  const { home } = await getDict();
  return (
    <section className={styles.section} aria-labelledby="how-title">
      <div className={`wrap ${styles.grid}`}>
        <header className={styles.head}>
          <h2 id="how-title" className={styles.title}>{home.how.title}</h2>
          <p className={styles.sub}>{home.how.sub}</p>
        </header>

        <ol className={styles.steps}>
          {home.how.steps.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <div className={styles.copy}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
              <figure className={styles.shot}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SHOTS[i].src} alt={step.alt} width={SHOTS[i].width} height={SHOTS[i].height} loading="lazy" decoding="async" />
              </figure>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
