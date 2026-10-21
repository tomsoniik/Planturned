import NewProjectButton from '@/components/NewProjectButton';
import { getDict } from '@/lib/i18n-server';
import styles from './FinalCta.module.css';

/** Końcowe CTA przed stopką: ten sam przycisk "Nowy projekt" co w hero (jedna intencja, jedna nazwa). */
export default async function FinalCta() {
  const { home } = await getDict();
  return (
    <section className={styles.section} aria-labelledby="cta-title">
      <div className="wrap">
        <div className={styles.inner}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/logo-mark.png" alt="" width={44} height={47} className={styles.mark} loading="lazy" />
          <h2 id="cta-title" className={styles.title}>{home.cta.title}</h2>
          <NewProjectButton size="lg" />
        </div>
      </div>
    </section>
  );
}
