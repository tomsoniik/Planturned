"use client";

/*
  Zakładka Skróty (okno 2D i menu 3D): karty z grupami klawiszy, sloty jak pasek w grze,
  ruch jako układ WASD. Klik na klawisz czeka na nowy, pasek u góry mówi, na co czeka.
*/
import { useEffect, useState } from 'react';
import {
  ArrowCounterClockwise,
  GridFour,
  Hammer,
  LockSimple,
  Monitor,
  PersonSimpleWalk,
  SquaresFour,
  type Icon,
} from '@phosphor-icons/react';
import {
  DEFAULT_KEYBINDS,
  KEYBIND_ACTIONS,
  RESERVED_CODES,
  SLOT_ACTIONS,
  keyLabel,
  useKeybinds,
  type KeybindAction,
} from '@/lib/keybinds';
import { useAppStore } from '@/store/useAppStore';
import { useT } from './I18nProvider';
import styles from './KeybindsPanel.module.css';

type GroupId = 'build' | 'plan' | 'move' | 'view3d';

const GROUPS: { id: GroupId; Icon: Icon; actions: KeybindAction[] }[] = [
  { id: 'build', Icon: Hammer, actions: ['demolish', 'bed', 'rotate', 'deleteSelected'] },
  { id: 'plan', Icon: GridFour, actions: ['floorUp', 'floorDown'] },
  { id: 'move', Icon: PersonSimpleWalk, actions: ['up', 'down', 'sprint', 'crouch', 'prone', 'toggleFly'] },
  { id: 'view3d', Icon: Monitor, actions: ['inventory', 'map', 'chat', 'grab'] },
];

/** Układ WASD: [akcja, kolumna, rząd]. */
const CLUSTER: [KeybindAction, number, number][] = [
  ['forward', 2, 1],
  ['left', 1, 2],
  ['back', 2, 2],
  ['right', 3, 2],
];

export default function KeybindsPanel() {
  const t = useT();
  const { binds, assign, reset } = useKeybinds();
  const { addNotification } = useAppStore();
  const [capturing, setCapturing] = useState<KeybindAction | null>(null);

  const names = { space: t.keys.space, shift: t.keys.shift };
  const actionName = (a: KeybindAction) => {
    const slot = SLOT_ACTIONS.indexOf(a);
    return slot >= 0 ? t.keys.slot(slot + 1) : t.keys.actions[a as keyof typeof t.keys.actions];
  };
  const changed = (a: KeybindAction) => binds[a] !== DEFAULT_KEYBINDS[a];

  // Czekanie na klawisz: nasłuch w fazie capture zatrzymuje zdarzenie, więc edytor go nie dostaje
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') {
        setCapturing(null);
        return;
      }
      if (RESERVED_CODES.has(e.code) || e.ctrlKey || e.metaKey || e.altKey) {
        addNotification(t.keys.reserved, 'error');
        return;
      }
      const swapped = assign(capturing, e.code);
      if (swapped) addNotification(t.keys.swapped(actionName(swapped)), 'success');
      setCapturing(null);
      // bez fokusu: puszczenie Spacji/Entera nie kliknie przycisku drugi raz
      (document.activeElement as HTMLElement | null)?.blur();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }); // nasłuch odnawiany co render: zawsze aktualne binds i tłumaczenia

  const keyCap = (a: KeybindAction, variant?: 'slot' | 'cluster') => {
    const label = keyLabel(binds[a], names);
    const active = capturing === a;
    return (
      <button
        key={a}
        className={styles.cap}
        data-variant={variant}
        data-active={active || undefined}
        data-changed={changed(a) || undefined}
        onClick={() => setCapturing(active ? null : a)}
        onBlur={() => active && setCapturing(null)}
        aria-label={t.keys.changeAria(actionName(a), label)}
        title={active ? t.keys.cancelHint : actionName(a)}
      >
        {active ? '…' : label}
      </button>
    );
  };

  const resetButton = (a: KeybindAction) =>
    changed(a) && (
      <button className={styles.resetOne} onClick={() => reset(a)} title={t.keys.resetOne} aria-label={t.keys.resetOne}>
        <ArrowCounterClockwise size={13} weight="bold" />
      </button>
    );

  const row = (a: KeybindAction) => (
    <li key={a} data-active={capturing === a || undefined}>
      <span className={styles.name}>{actionName(a)}</span>
      {resetButton(a)}
      {keyCap(a)}
    </li>
  );

  const changedCount = KEYBIND_ACTIONS.filter(changed).length;

  return (
    <div className={styles.panel}>
      <header className={styles.top} data-capturing={capturing ? true : undefined} aria-live="polite">
        {capturing ? (
          <>
            <span className={styles.pulse} aria-hidden />
            <p>
              {t.keys.waiting} <strong>{actionName(capturing)}</strong>
            </p>
            <button className={styles.topBtn} onClick={() => setCapturing(null)}>
              {t.keys.cancelHint}
            </button>
          </>
        ) : (
          <>
            <p>{t.keys.hint}</p>
            <button className={styles.topBtn} onClick={() => reset()} disabled={changedCount === 0}>
              <ArrowCounterClockwise size={14} weight="bold" />
              {t.keys.resetAll}
              {changedCount > 0 && <span className={styles.count}>{changedCount}</span>}
            </button>
          </>
        )}
      </header>

      <section className={styles.card}>
        <h3>
          <SquaresFour size={16} weight="duotone" />
          {t.keys.slots}
        </h3>
        <div className={styles.slots}>
          {SLOT_ACTIONS.map((a) => keyCap(a, 'slot'))}
        </div>
      </section>

      <div className={styles.cards}>
        {GROUPS.map((g) => (
          <section key={g.id} className={styles.card}>
            <h3>
              <g.Icon size={16} weight="duotone" />
              {t.keys.groups[g.id]}
            </h3>
            {g.id === 'move' && (
              <div className={styles.cluster}>
                {CLUSTER.map(([a, col, r]) => (
                  <div key={a} className={styles.clusterKey} style={{ gridColumn: col, gridRow: r }}>
                    {keyCap(a, 'cluster')}
                    <span>{t.keys.short[a as keyof typeof t.keys.short]}</span>
                  </div>
                ))}
              </div>
            )}
            <ul className={styles.rows}>{g.actions.map(row)}</ul>
          </section>
        ))}

        <section className={styles.card} data-fixed>
          <h3>
            <LockSimple size={16} weight="duotone" />
            {t.keys.groups.fixed}
          </h3>
          <ul className={styles.rows}>
            {t.keys.fixed.map(([keys, label]) => (
              <li key={label}>
                <span className={styles.name}>{label}</span>
                <span className={styles.combo}>
                  {keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
