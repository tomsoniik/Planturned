"use client";

import { useEffect, useState } from 'react';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
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

const GROUPS: { id: 'build' | 'plan' | 'view3d'; actions: KeybindAction[] }[] = [
  { id: 'build', actions: ['demolish', 'bed', 'rotate', 'deleteSelected'] },
  { id: 'plan', actions: ['floorUp', 'floorDown'] },
  { id: 'view3d', actions: ['forward', 'back', 'left', 'right', 'up', 'down', 'sprint', 'crouch', 'prone', 'toggleFly', 'map', 'inventory', 'chat', 'grab'] },
];

/** Zakładka Skróty: klawisze do zmiany i lista stałych skrótów. */
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

  const keyButton = (a: KeybindAction, compact = false) => {
    const label = keyLabel(binds[a], names);
    const active = capturing === a;
    return (
      <button
        key={a}
        className={styles.key}
        data-compact={compact || undefined}
        data-active={active || undefined}
        data-changed={binds[a] !== DEFAULT_KEYBINDS[a] || undefined}
        onClick={() => setCapturing(active ? null : a)}
        onBlur={() => active && setCapturing(null)}
        aria-label={t.keys.changeAria(actionName(a), label)}
        title={active ? t.keys.cancelHint : undefined}
      >
        {active ? t.keys.press : label}
      </button>
    );
  };

  const changedCount = KEYBIND_ACTIONS.filter((a) => binds[a] !== DEFAULT_KEYBINDS[a]).length;

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>{t.keys.hint}</p>

      <section className={styles.group}>
        <h3>{t.keys.slots}</h3>
        <div className={styles.slots}>{SLOT_ACTIONS.map((a) => keyButton(a, true))}</div>
      </section>

      {GROUPS.map((g) => (
        <section key={g.id} className={styles.group}>
          <h3>{t.keys.groups[g.id]}</h3>
          <ul className={styles.rows}>
            {g.actions.map((a) => (
              <li key={a}>
                <span className={styles.name}>{actionName(a)}</span>
                {binds[a] !== DEFAULT_KEYBINDS[a] && (
                  <button className={styles.resetOne} onClick={() => reset(a)} title={t.keys.resetOne} aria-label={t.keys.resetOne}>
                    <ArrowCounterClockwise size={12} weight="bold" />
                  </button>
                )}
                {keyButton(a)}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className={styles.group}>
        <h3>{t.keys.groups.fixed}</h3>
        <ul className={styles.rows} data-fixed>
          {t.keys.fixed.map(([keys, label]) => (
            <li key={label}>
              <span className={styles.name}>{label}</span>
              <span className={styles.fixedKeys}>
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <button className={`btn btn-ghost ${styles.resetAll}`} onClick={() => reset()} disabled={changedCount === 0}>
        <ArrowCounterClockwise size={14} weight="bold" />
        {t.keys.resetAll}
      </button>
    </div>
  );
}
