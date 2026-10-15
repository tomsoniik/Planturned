import Link from 'next/link';
import SiteNav, { BrandMark } from '@/components/SiteNav';
import NewProjectButton from '@/components/NewProjectButton';
import HeroPreview from '@/components/HeroPreview';
import PlanThumbnail from '@/components/PlanThumbnail';
import Reveal from '@/components/Reveal';
import ScrollWords from '@/components/ScrollWords';
import { computeMaterials, MATERIAL_LABELS } from '@/lib/builder';
import { SAMPLE_BASE } from '@/lib/sampleBase';
import styles from './page.module.css';

const SAMPLE_COSTS = Object.entries(computeMaterials(SAMPLE_BASE));

const SHORTCUTS_2D: { keys: string[]; label: string }[] = [
  { keys: ['LPM'], label: 'postaw klocek lub zaznacz' },
  { keys: ['PPM'], label: 'przesuń widok' },
  { keys: ['R'], label: 'obróć klocek' },
  { keys: ['Shift', 'Klik'], label: 'zaznacz kilka' },
  { keys: ['Ctrl', 'C'], label: 'kopiuj, Ctrl V wkleja' },
  { keys: ['Ctrl', 'Z'], label: 'cofnij, Ctrl Y ponawia' },
];

const SHORTCUTS_3D: { keys: string[]; label: string }[] = [
  { keys: ['Klik'], label: 'przejmij kamerę' },
  { keys: ['W', 'A', 'S', 'D'], label: 'ruch' },
  { keys: ['Q', 'E'], label: 'w dół i w górę' },
  { keys: ['LPM'], label: 'postaw w celowniku' },
  { keys: ['1', '7'], label: 'wybór z paska' },
  { keys: ['Esc'], label: 'oddaj kursor' },
];

function ShortcutGroup({ title, items }: { title: string; items: typeof SHORTCUTS_2D }) {
  return (
    <div className={styles.shortcutGroup}>
      <h3 className={styles.shortcutTitle}>{title}</h3>
      <ul className={styles.shortcutGrid}>
        {items.map((s) => (
          <li key={s.label} className={styles.shortcut}>
            <span className={styles.keys}>
              {s.keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className={styles.main}>
        <section className={`wrap ${styles.hero}`}>
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
        </section>

        <section id="funkcje" className={`wrap ${styles.section}`}>
          <Reveal>
            <h2 className={styles.sectionTitle}>Budujesz jak w grze. Widzisz więcej niż w grze.</h2>
          </Reveal>

          <div className={styles.bento}>
            <Reveal className={`${styles.cell} ${styles.cellPlan}`}>
              <div className={styles.blueprint}>
                <PlanThumbnail items={SAMPLE_BASE} className={styles.planSvg} padding={30} />
              </div>
              <div className={styles.cellText}>
                <h3>Wszystkie struktury z gry</h3>
                <p>
                  84 elementy z plików gry, z oryginalnymi modelami 3D. Ściany i filary przyklejają się do
                  krawędzi i narożników, kolizję widać od razu.
                </p>
              </div>
            </Reveal>

            <Reveal className={`${styles.cell} ${styles.cellWalk}`}>
              <div className={styles.keyCluster} aria-hidden>
                <kbd className={styles.keyW}>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
              </div>
              <div className={styles.cellText}>
                <h3>Spacer po bazie w 3D</h3>
                <p>Kamera jak w grze. Stawiasz i wyburzasz z celownika, bez wychodzenia z widoku.</p>
              </div>
            </Reveal>

            <Reveal className={`${styles.cell} ${styles.cellCost}`}>
              <dl className={styles.costList}>
                {SAMPLE_COSTS.map(([mat, qty]) => (
                  <div key={mat}>
                    <dt>{MATERIAL_LABELS[mat] || mat}</dt>
                    <dd>{qty}</dd>
                  </div>
                ))}
              </dl>
              <div className={styles.cellText}>
                <h3>Koszt w surowcach</h3>
                <p>Tyle kosztuje baza z podglądu, według receptur z gry. Licznik rośnie z każdym elementem.</p>
              </div>
            </Reveal>

            <Reveal className={`${styles.cell} ${styles.cellClaim}`}>
              <div className={styles.cellText}>
                <h3>Piętra i zasięg claimu</h3>
                <p>
                  Do czterech poziomów, niższe widać jako tło. Okrąg wokół łóżka pokazuje, gdzie nikt spoza grupy nic
                  nie postawi.
                </p>
              </div>
              <div className={styles.claimVisual}>
                <PlanThumbnail items={SAMPLE_BASE} showClaim className={styles.planSvg} padding={10} />
              </div>
            </Reveal>
          </div>
        </section>

        <section className={`wrap ${styles.manifesto}`}>
          <ScrollWords
            className={styles.manifestoText}
            text="Bez konta i bez logowania. Projekty zostają w twojej przeglądarce, a plik z bazą wysyłasz ekipie na Discordzie."
          />
        </section>

        <section id="skroty" className={`wrap ${styles.section}`}>
          <Reveal>
            <h2 className={styles.sectionTitle}>Ręce zostają na klawiaturze.</h2>
          </Reveal>
          <Reveal className={styles.shortcuts}>
            <ShortcutGroup title="Plan 2D" items={SHORTCUTS_2D} />
            <ShortcutGroup title="Widok 3D" items={SHORTCUTS_3D} />
          </Reveal>
        </section>

        <section className={`wrap ${styles.final}`}>
          <Reveal className={styles.finalInner}>
            <h2 className={styles.finalTitle}>Pierwszy fundament czeka.</h2>
            <NewProjectButton size="lg" />
          </Reveal>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`wrap ${styles.footerInner}`}>
          <BrandMark />
          <p>Projekt fanowski. Unturned należy do Smartly Dressed Games.</p>
          <Link href="/builder">Moje projekty</Link>
        </div>
      </footer>
    </>
  );
}
