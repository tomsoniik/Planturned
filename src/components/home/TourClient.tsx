"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useReducedMotion } from 'framer-motion';
import styles from './Tour.module.css';

export interface TourSlide {
  id: string;
  title: string;
  text: string;
  media: ReactNode;
}

/** Ile trwa jeden slajd przy automatycznym przełączaniu (ms). Ta sama wartość steruje paskiem postępu w CSS. */
const SLIDE_MS = 7000;

/**
 * Okno z funkcjami: lista zakładek + duży podgląd z opisem.
 * Przełączanie: klik, strzałki, klawiatura (strzałki, Home, End), przesunięcie palcem po oknie.
 * Samo przełącza się co SLIDE_MS (pasek postępu w aktywnej zakładce), ale tylko gdy okno jest widoczne,
 * nie jest pod kursorem ani w fokusie. Pierwsza ręczna zmiana wyłącza automat. Bez automatu przy ograniczonych animacjach.
 */
export default function TourClient({ title, sub, label, prev, next, slides }: {
  title: string;
  sub: string;
  label: string;
  prev: string;
  next: string;
  slides: TourSlide[];
}) {
  const reduce = useReducedMotion();
  const uid = useId();
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hold, setHold] = useState(false);
  const root = useRef<HTMLElement>(null);
  const tabList = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const swipeX = useRef<number | null>(null);

  const count = slides.length;
  // reduce jest null przed odczytem ustawienia: automat dopiero, gdy wiadomo, że animacje są dozwolone
  const motionOk = reduce === false;
  const playing = auto && motionOk && visible && !hold;

  // Automat działa tylko, gdy sekcja jest na ekranie
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Aktywna zakładka widoczna w poziomym pasku (telefon), bez przewijania całej strony
  useEffect(() => {
    const list = tabList.current;
    const tab = tabs.current[index];
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [index, reduce]);

  const go = (i: number, manual = true) => {
    if (manual) setAuto(false);
    setIndex(((i % count) + count) % count);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: count - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const target = ((keys[e.key] % count) + count) % count;
    go(target);
    tabs.current[target]?.focus();
  };

  const onPointerDown = (e: PointerEvent) => {
    swipeX.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (swipeX.current === null) return;
    const dx = e.clientX - swipeX.current;
    swipeX.current = null;
    if (Math.abs(dx) > 48) go(index + (dx < 0 ? 1 : -1));
  };

  const active = slides[index];

  return (
    <section
      ref={root}
      className={styles.section}
      aria-labelledby={`${uid}-title`}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHold(false);
      }}
    >
      <div className={`wrap ${styles.grid}`}>
        <header className={styles.head}>
          <h2 id={`${uid}-title`} className={styles.title}>{title}</h2>
          <p className={styles.sub}>{sub}</p>

          <div ref={tabList} className={styles.tabs} role="tablist" aria-label={label} aria-orientation="vertical">
            {slides.map((s, i) => (
              <button
                key={s.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${s.id}`}
                aria-selected={i === index}
                aria-controls={`${uid}-panel`}
                tabIndex={i === index ? 0 : -1}
                className={styles.tab}
                onClick={() => go(i)}
                onKeyDown={onTabKey}
              >
                {s.title}
                {/* Pasek postępu automatu: koniec animacji przełącza na następny slajd */}
                {i === index && auto && motionOk && (
                  <span
                    key={index}
                    className={styles.progress}
                    style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: playing ? 'running' : 'paused' }}
                    onAnimationEnd={() => go(index + 1, false)}
                    aria-hidden
                  />
                )}
              </button>
            ))}
          </div>
        </header>

        <div className={styles.stage}>
          <div
            id={`${uid}-panel`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-${active.id}`}
            className={styles.window}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipeX.current = null)}
          >
            {slides.map((s, i) => (
              <div key={s.id} className={styles.slide} data-active={i === index || undefined} aria-hidden={i !== index}>
                {s.media}
              </div>
            ))}
          </div>

          <div className={styles.caption}>
            <div className={styles.captionText} aria-live="polite">
              <h3>{active.title}</h3>
              <p>{active.text}</p>
            </div>
            <div className={styles.arrows}>
              <button type="button" className="icon-btn" aria-label={prev} title={prev} onClick={() => go(index - 1)}>
                <CaretLeft size={18} weight="bold" />
              </button>
              <button type="button" className="icon-btn" aria-label={next} title={next} onClick={() => go(index + 1)}>
                <CaretRight size={18} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
