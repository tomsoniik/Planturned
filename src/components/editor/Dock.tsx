"use client";

/*
  Dolny panel edytora. Pasek: Pasek / Klocki, akcja po lewej, sterowanie piętrami na środku, zoom po prawej.
  Pod nim lista warstw (w 2D piętra, w 3D budowle) i ścieżka: sloty 1-9 albo katalog klocków do przewijania.
*/
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CaretDown, CaretLeft, CaretRight, CaretUp, Hammer, Plus, SkipBack, SkipForward, SquaresFour } from '@phosphor-icons/react';
import { BED, findDef, type BuildItem, type Hotbar } from '@/lib/builder';
import { BLOCK_CATEGORIES, blockSections, type CategoryId } from '@/lib/catalog';
import { itemFullLabel, itemLabel } from '@/lib/i18n';
import { SLOT_ACTIONS, keyLabel, useKeybinds } from '@/lib/keybinds';
import ItemIcon from '../ItemIcon';
import { useT } from '../I18nProvider';
import s from './EditorShell.module.css';

export type DockView = 'bar' | 'catalog';

export interface LayerRow {
  id: string;
  label: string;
  icon: ReactNode;
  count?: number;
  on?: boolean;
  title?: string;
  onClick?: () => void;
  /** Przyciski po prawej stronie wiersza (np. teleport do bazy). */
  tools?: ReactNode;
}

/** Sterowanie piętrami jak odtwarzaczem: najniższe, niżej, bieżące, wyżej, najwyższe. */
export function Transport({
  label,
  meta,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: {
  label: string;
  meta?: string;
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
      {meta && <span className={s.transportMeta}>{meta}</span>}
    </div>
  );
}

export default function Dock({
  view,
  onView,
  collapsed,
  onCollapse,
  action,
  center,
  right,
  layersTitle,
  layersTool,
  layers,
  hotbar,
  selected,
  activeItem,
  demolishOn,
  onSlot,
  onClearSlot,
  onDemolish,
  onAll,
  onPick,
}: {
  view: DockView;
  onView: (v: DockView) => void;
  collapsed: boolean;
  onCollapse: (c: boolean) => void;
  /** Akcja obok przełącznika (Dodaj piętro). */
  action?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  layersTitle: string;
  layersTool?: ReactNode;
  layers: LayerRow[];
  hotbar: Hotbar;
  selected: number | null;
  activeItem: string | null;
  demolishOn: boolean;
  onSlot: (i: number) => void;
  onClearSlot: (i: number) => void;
  onDemolish: () => void;
  /** Okno wszystkich klocków (2D) albo ekwipunek (3D). */
  onAll: () => void;
  /** Wybór klocka z katalogu: trafia do slotu i do ręki. */
  onPick: (itemId: string) => void;
}) {
  const t = useT();
  const binds = useKeybinds((st) => st.binds);
  const key = (code: string) => keyLabel(code, { space: t.keys.space, shift: t.keys.shift });
  const [category, setCategory] = useState<CategoryId | null>(null);
  // bieżące piętro zawsze widoczne na liście (wysokie skybase'y mają kilkanaście pozycji)
  const listRef = useRef<HTMLDivElement>(null);
  const activeLayer = layers.find((l) => l.on)?.id;
  useEffect(() => {
    listRef.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' });
  }, [activeLayer, collapsed]);

  const catalog: BuildItem[] =
    view === 'catalog'
      ? blockSections(category, null, '').sections.flatMap((sec) =>
          sec.bed ? [BED] : sec.rows.flatMap((r) => r.cells.filter((d): d is BuildItem => !!d)),
        )
      : [];

  return (
    <section className={s.dock} data-collapsed={collapsed || undefined} aria-label={t.shell.dock}>
      <div className={s.dockBar}>
        <div className={s.dockLeft}>
          <div className={s.dockSeg} role="tablist">
            {(['bar', 'catalog'] as DockView[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                data-on={view === v || undefined}
                onClick={() => {
                  onView(v);
                  if (collapsed) onCollapse(false);
                }}
              >
                {v === 'bar' ? t.shell.bar : t.shell.catalog}
              </button>
            ))}
          </div>
          {action}
        </div>
        <div>{center}</div>
        <div className={s.dockRight}>
          {right}
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

      <div className={s.dockBody}>
        <div className={s.layers}>
          <div className={s.layersHead}>
            <span>{layersTitle}</span>
            {layersTool}
          </div>
          <div className={s.layerList} ref={listRef}>
            {layers.map((l) => (
              <div key={l.id} className={s.layerRow}>
                <button className={s.layer} data-on={l.on || undefined} onClick={l.onClick} title={l.title ?? l.label} aria-current={l.on || undefined}>
                  {l.icon}
                  <span>{l.label}</span>
                  {l.count !== undefined && <em>{l.count}</em>}
                </button>
                {l.tools}
              </div>
            ))}
          </div>
        </div>

        <div className={s.track}>
          <div className={s.trackHead}>
            {view === 'bar' ? (
              <>
                <span>{t.shell.bar}</span>
                <em>{t.shell.slotsHint}</em>
              </>
            ) : (
              <>
                <div className={s.chips} role="tablist" aria-label={t.toolbox.categories}>
                  <button role="tab" aria-selected={!category} data-on={!category || undefined} onClick={() => setCategory(null)}>
                    {t.toolbox.category.all}
                  </button>
                  {BLOCK_CATEGORIES.map((c) => (
                    <button key={c.id} role="tab" aria-selected={category === c.id} data-on={category === c.id || undefined} onClick={() => setCategory(c.id)}>
                      {t.toolbox.category[c.id]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className={s.trackBody}>
            {view === 'bar' ? (
              <>
                <div className={s.slots}>
                  {hotbar.map((id, i) => {
                    const def = id ? findDef(id) : undefined;
                    const name = def ? itemFullLabel(def, t) : null;
                    return (
                      <button
                        key={i}
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
                    );
                  })}
                </div>
                <span className={s.trackRule} aria-hidden />
                <button className={s.bigTool} onClick={onAll} title={t.toolbox.open(key(binds.inventory))}>
                  <SquaresFour size={22} weight="duotone" />
                  {t.shell.allBlocks}
                  <kbd>{key(binds.inventory)}</kbd>
                </button>
                <button
                  className={s.bigTool}
                  data-on={demolishOn || undefined}
                  onClick={onDemolish}
                  title={`${t.tools.remover} (${key(binds.demolish)})`}
                >
                  <Hammer size={22} weight="duotone" />
                  {t.tools.remover}
                  <kbd>{key(binds.demolish)}</kbd>
                </button>
              </>
            ) : (
              <div className={s.tiles}>
                {catalog.map((def) => {
                  const name = itemFullLabel(def, t);
                  return (
                    <button
                      key={def.id}
                      className={`${s.slot} ${s.tile}`}
                      data-on={activeItem === def.id || undefined}
                      onClick={() => onPick(def.id)}
                      title={def.health ? `${name}, ${def.health} HP` : name}
                    >
                      <ItemIcon src={def.icon} name={name} size={36} />
                      <span className={s.slotName}>{def.part ? t.parts[def.part] : itemLabel(def, t)}</span>
                      {def.material && <span className={s.slotName}>{t.materials[def.material]}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Przycisk "+" w nagłówku listy warstw. */
export function LayersAdd({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className={s.layerTool} onClick={onClick} title={label} aria-label={label}>
      <Plus size={13} weight="bold" />
    </button>
  );
}
