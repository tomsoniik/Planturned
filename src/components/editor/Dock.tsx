"use client";

/*
  Dolny panel edytora: pasek slotów 1-9 i w Plannerze piętra (lista po lewej, przyciski na środku paska).
  Katalog klocków jest w oknie E (narzędzie Wstaw), wyburzanie w railu narzędzi, zoom na pasku widoku.
*/
import { useEffect, useRef, type ReactNode } from 'react';
import { CaretDown, CaretLeft, CaretRight, CaretUp, Plus, SkipBack, SkipForward, X } from '@phosphor-icons/react';
import { findDef, type Hotbar } from '@/lib/builder';
import { itemFullLabel, itemLabel } from '@/lib/i18n';
import { SLOT_ACTIONS, keyLabel, useKeybinds } from '@/lib/keybinds';
import ItemIcon from '../ItemIcon';
import { useT } from '../I18nProvider';
import s from './EditorShell.module.css';

export interface LayerRow {
  id: string;
  label: string;
  icon: ReactNode;
  count?: number;
  on?: boolean;
  title?: string;
  onClick?: () => void;
}

/** Sterowanie piętrami jak odtwarzaczem: najniższe, niżej, bieżące, wyżej, najwyższe. */
export function Transport({
  label,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: {
  label: string;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
}) {
  const t = useT();
  const binds = useKeybinds((st) => st.binds);
  const key = (code: string) => keyLabel(code, { space: t.keys.space, shift: t.keys.shift });
  return (
    <div className={s.transport}>
      <button className={s.iconBtn} onClick={onFirst} title={t.shell.lowest} aria-label={t.shell.lowest}>
        <SkipBack size={15} weight="fill" />
      </button>
      <button className={s.iconBtn} onClick={onPrev} title={`${t.shell.floorDown} (${key(binds.floorDown)})`} aria-label={t.shell.floorDown}>
        <CaretLeft size={15} weight="bold" />
      </button>
      <span className={s.transportNow}>{label}</span>
      <button className={s.iconBtn} onClick={onNext} title={`${t.shell.floorUp} (${key(binds.floorUp)})`} aria-label={t.shell.floorUp}>
        <CaretRight size={15} weight="bold" />
      </button>
      <button className={s.iconBtn} onClick={onLast} title={t.shell.highest} aria-label={t.shell.highest}>
        <SkipForward size={15} weight="fill" />
      </button>
    </div>
  );
}

export default function Dock({
  collapsed,
  onCollapse,
  center,
  layers,
  onAddLayer,
  hotbar,
  selected,
  onSlot,
  onClearSlot,
}: {
  collapsed: boolean;
  onCollapse: (c: boolean) => void;
  center?: ReactNode;
  /** Piętra (Planner); bez nich sloty zajmują całą szerokość (Sandbox). */
  layers?: LayerRow[];
  onAddLayer?: () => void;
  hotbar: Hotbar;
  selected: number | null;
  onSlot: (i: number) => void;
  onClearSlot: (i: number) => void;
}) {
  const t = useT();
  const binds = useKeybinds((st) => st.binds);
  const key = (code: string) => keyLabel(code, { space: t.keys.space, shift: t.keys.shift });
  // bieżące piętro zawsze widoczne na liście (wysokie skybase'y mają kilkanaście pozycji)
  const listRef = useRef<HTMLDivElement>(null);
  const activeLayer = layers?.find((l) => l.on)?.id;
  useEffect(() => {
    listRef.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' });
  }, [activeLayer, collapsed]);

  return (
    <section className={s.dock} data-collapsed={collapsed || undefined} aria-label={t.shell.dock}>
      <div className={s.dockBar}>
        <div className={s.dockLeft}>
          <strong className={s.dockTitle}>{t.shell.bar}</strong>
          <span className={s.dockHint}>{t.shell.slotsHint}</span>
        </div>
        <div>{center}</div>
        <div className={s.dockRight}>
          <button
            className={s.iconBtn}
            onClick={() => onCollapse(!collapsed)}
            title={collapsed ? t.shell.expand : t.shell.collapse}
            aria-label={collapsed ? t.shell.expand : t.shell.collapse}
            aria-expanded={!collapsed}
          >
            {collapsed ? <CaretUp size={15} weight="bold" /> : <CaretDown size={15} weight="bold" />}
          </button>
        </div>
      </div>

      <div className={s.dockBody} data-full={!layers || undefined}>
        {layers && (
          <div className={s.layers}>
            <div className={s.layersHead}>
              <span>{t.shell.floors}</span>
              {onAddLayer && (
                <button className={s.layerTool} onClick={onAddLayer} title={t.shell.addFloor} aria-label={t.shell.addFloor}>
                  <Plus size={13} weight="bold" />
                </button>
              )}
            </div>
            <div className={s.layerList} ref={listRef}>
              {layers.map((l) => (
                <button key={l.id} className={s.layer} data-on={l.on || undefined} onClick={l.onClick} title={l.title ?? l.label} aria-current={l.on || undefined}>
                  {l.icon}
                  <span>{l.label}</span>
                  {l.count !== undefined && <em>{l.count}</em>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={s.trackBody}>
          <div className={s.slots}>
            {hotbar.map((id, i) => {
              const def = id ? findDef(id) : undefined;
              const name = def ? itemFullLabel(def, t) : null;
              return (
                // x obok przycisku slotu, nie w nim (przycisk w przycisku to niepoprawny HTML)
                <div key={i} className={s.slotCell}>
                  <button
                    className={s.slot}
                    data-on={selected === i || undefined}
                    data-empty={!def || undefined}
                    aria-label={t.hud.slotAria(i + 1, name)}
                    title={name ? `${name}${def?.health ? `, ${def.health} HP` : ''}` : undefined}
                    onClick={() => onSlot(i)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (def) onClearSlot(i);
                    }}
                  >
                    <span className={s.slotKey}>{key(binds[SLOT_ACTIONS[i]])}</span>
                    {def && <ItemIcon src={def.icon} name={name ?? ''} size={36} eager />}
                    {def && <span className={s.slotName}>{def.part ? t.parts[def.part] : itemLabel(def, t)}</span>}
                  </button>
                  {def && (
                    <button className={s.slotClear} onClick={() => onClearSlot(i)} title={t.shell.clearSlot} aria-label={`${t.shell.clearSlot} ${i + 1}`}>
                      <X size={10} weight="bold" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
