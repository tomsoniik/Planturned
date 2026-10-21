"use client";

/*
  Przybornik 2D jako okno nad planem (E). Pasek po lewej filtruje po rodzaju (podłogi, ściany...) i po materiale,
  filtry się łączą. Każdy klocek to osobny kafelek w swoim materiale, jak przedmioty w ekwipunku gry.
  Na dole planu zostaje pasek slotów 1-9 (BuildBar).
*/
import { useState, type ReactNode } from 'react';
import {
  Bed,
  Buildings,
  Columns,
  Cube,
  DoorOpen,
  GridFour,
  Hammer,
  HouseLine,
  Keyboard,
  Leaf,
  MagnifyingGlass,
  Nut,
  PaintBucket,
  Rows,
  SquaresFour,
  Stairs,
  Tree,
  TreeEvergreen,
  Wall,
  X,
  type Icon,
} from '@phosphor-icons/react';
import { BED, MATERIALS, REMOVER, findDef, type BuildItem, type Hotbar, type MaterialId, type PartId } from '@/lib/builder';
import { itemFullLabel, itemLabel, type SidebarTabId } from '@/lib/i18n';
import { SLOT_ACTIONS, keyLabel, useKeybinds } from '@/lib/keybinds';
import { useT } from './I18nProvider';
import styles from './BuildWindow.module.css';

type CategoryId = 'floors' | 'walls' | 'roofs' | 'pillars' | 'stairs' | 'hatches' | 'bed';
export type WindowTab = Exclude<SidebarTabId, 'map'>;

const CATEGORIES: { id: CategoryId; Icon: Icon; parts: PartId[] }[] = [
  { id: 'floors', Icon: GridFour, parts: ['floor', 'tri_floor'] },
  { id: 'walls', Icon: Wall, parts: ['wall', 'doorway', 'window', 'garage', 'rampart', 'ramp_wall'] },
  { id: 'roofs', Icon: HouseLine, parts: ['roof', 'tri_roof', 'hole', 'tri_hole'] },
  { id: 'pillars', Icon: Columns, parts: ['pillar', 'post'] },
  { id: 'stairs', Icon: Stairs, parts: ['stairs', 'ramp'] },
  { id: 'hatches', Icon: DoorOpen, parts: ['hatch'] },
  { id: 'bed', Icon: Bed, parts: [] },
];

const TABS: { id: WindowTab; Icon: Icon }[] = [
  { id: 'blocks', Icon: Cube },
  { id: 'bases', Icon: Buildings },
  { id: 'color', Icon: PaintBucket },
  { id: 'hotkeys', Icon: Keyboard },
];

const MATERIAL_ICON: Record<MaterialId, Icon> = { maple: Leaf, birch: Tree, pine: TreeEvergreen, metal: Nut, brick: Rows };

const variant = (part: PartId, m: MaterialId) => findDef(`${m}_${part}`);

function useKeyName() {
  const t = useT();
  return (code: string) => keyLabel(code, { space: t.keys.space, shift: t.keys.shift });
}

export function BuildWindow({
  tab,
  activeItem,
  hotbar,
  panels,
  onTab,
  onPick,
  onClose,
}: {
  tab: WindowTab;
  activeItem: string | null;
  hotbar: Hotbar;
  /** Zawartość pozostałych zakładek (budowle, kolor, skróty). */
  panels: Record<Exclude<WindowTab, 'blocks'>, ReactNode>;
  onTab: (tab: WindowTab) => void;
  /** Wybór klocka z siatki: page wkłada go do slotu i zamyka okno. */
  onPick: (itemId: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const binds = useKeybinds((s) => s.binds);
  const keyName = useKeyName();
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [material, setMaterial] = useState<MaterialId | null>(null);
  const [query, setQuery] = useState('');

  const activeDef = activeItem ? findDef(activeItem) : undefined;
  const slotKey = (id: string) => {
    const i = hotbar.indexOf(id);
    return i >= 0 ? keyName(binds[SLOT_ACTIONS[i]]) : null;
  };

  // Szukanie po nazwie części i po materiale ("metal" pokazuje wszystkie metalowe)
  const q = query.trim().toLowerCase();
  const matches = (part: PartId, m: MaterialId) =>
    !q || t.parts[part].toLowerCase().includes(q) || t.materials[m].toLowerCase().includes(q);
  const bedMatches = !q || itemLabel(BED, t).toLowerCase().includes(q);

  /** Sekcje do pokazania: rodzaj, w nim rzędy części, w rzędzie warianty materiałów (filtrowane). */
  const mats = material ? MATERIALS.filter((m) => m.id === material) : MATERIALS;
  const sections = CATEGORIES.filter((c) => !category || c.id === category)
    .map((c) => {
      if (c.id === 'bed') return { cat: c, rows: [], bed: !material && bedMatches };
      const rows = c.parts
        .map((part) => ({ part, cells: mats.map((m) => (matches(part, m.id) ? variant(part, m.id) ?? null : undefined)) }))
        .filter((r) => r.cells.some((x) => x));
      return { cat: c, rows, bed: false };
    })
    .filter((s) => s.rows.length > 0 || s.bed);
  const count = sections.reduce((n, s) => n + (s.bed ? 1 : 0) + s.rows.reduce((k, r) => k + r.cells.filter(Boolean).length, 0), 0);
  const columns = material ? 1 : MATERIALS.length;

  const tile = (def: BuildItem) => {
    const key = slotKey(def.id);
    const mat = def.material;
    const MatGlyph = mat ? MATERIAL_ICON[mat] : null;
    const name = def.part ? t.parts[def.part] : itemLabel(def, t);
    return (
      <button
        key={def.id}
        className={styles.tile}
        data-on={activeItem === def.id || undefined}
        onClick={() => onPick(def.id)}
        title={def.health ? `${itemFullLabel(def, t)}, ${def.health} HP` : itemFullLabel(def, t)}
      >
        {key && <span className={styles.tileKey}>{key}</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={def.icon} alt="" />
        <span className={styles.tileName}>{name}</span>
        {mat && MatGlyph && (
          <span className={styles.tileMeta}>
            <MatGlyph size={12} weight="duotone" />
            {t.materials[mat]}
            {def.health ? ` · ${def.health}` : ''}
          </span>
        )}
      </button>
    );
  };

  const railButton = (key: string, Glyph: Icon, label: string, on: boolean, onClick: () => void) => (
    <button
      key={key}
      className={styles.railBtn}
      aria-label={label}
      aria-pressed={on}
      title={label}
      data-on={on || undefined}
      onClick={onClick}
    >
      <Glyph size={22} weight="duotone" />
    </button>
  );

  const title = [category ? t.toolbox.category[category] : null, material ? t.materials[material] : null]
    .filter(Boolean)
    .join(' · ') || (q ? t.editor.results : t.toolbox.category.all);

  return (
    <>
      <div className={styles.backdrop} onPointerDown={onClose} aria-hidden />
      <section className={styles.window} role="dialog" aria-label={t.toolbox.title}>
        <header className={styles.head}>
          <div className={styles.tabs} role="tablist">
            {TABS.map(({ id, Icon: Glyph }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                aria-label={t.editor.tabs[id]}
                title={t.editor.tabs[id]}
                data-on={tab === id || undefined}
                onClick={() => onTab(id)}
              >
                <Glyph size={19} weight="duotone" />
              </button>
            ))}
          </div>
          {tab === 'blocks' ? (
            <label className={styles.search}>
              <MagnifyingGlass size={15} weight="duotone" />
              <input
                autoFocus
                type="text"
                placeholder={t.editor.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    if (query) setQuery('');
                    else onClose();
                  }
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label={t.editor.clearSearch}>
                  <X size={12} weight="bold" />
                </button>
              )}
            </label>
          ) : (
            <strong className={styles.headTitle}>{t.editor.tabs[tab]}</strong>
          )}
          <button className={styles.close} onClick={onClose} aria-label={t.toolbox.close} title={t.toolbox.close}>
            <X size={18} weight="bold" />
          </button>
        </header>

        {tab === 'blocks' ? (
          <>
            <div className={styles.body}>
              <nav className={styles.rail} aria-label={t.toolbox.categories}>
                {railButton('all', SquaresFour, t.toolbox.category.all, !category && !material, () => {
                  setCategory(null);
                  setMaterial(null);
                  setQuery('');
                })}
                <span className={styles.railRule} aria-hidden />
                {CATEGORIES.map((c) =>
                  railButton(c.id, c.Icon, t.toolbox.category[c.id], category === c.id, () => {
                    setCategory(category === c.id ? null : c.id);
                    if (c.id === 'bed') setMaterial(null);
                  }),
                )}
                <span className={styles.railRule} aria-hidden />
                {MATERIALS.map((m) =>
                  railButton(m.id, MATERIAL_ICON[m.id], t.materials[m.id], material === m.id, () => {
                    setMaterial(material === m.id ? null : m.id);
                    if (category === 'bed') setCategory(null);
                  }),
                )}
              </nav>

              <div className={styles.content}>
                <h3 className={styles.title}>
                  {title}
                  <span>{count}</span>
                  {category === 'walls' && <em>{t.toolbox.wallsNote}</em>}
                </h3>
                {sections.map(({ cat, rows, bed }) => (
                  <section key={cat.id} className={styles.section}>
                    {!category && (
                      <h4>
                        <cat.Icon size={14} weight="duotone" />
                        {t.toolbox.category[cat.id]}
                      </h4>
                    )}
                    {bed ? (
                      <div className={styles.grid}>{tile(BED)}</div>
                    ) : material ? (
                      <div className={styles.grid}>{rows.map((r) => r.cells.map((d) => d && tile(d)))}</div>
                    ) : (
                      <div className={styles.matrix} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                        {rows.flatMap((r) =>
                          r.cells.map((d, i) =>
                            d ? tile(d) : <span key={`${r.part}-${i}`} className={styles.gap} aria-hidden />,
                          ),
                        )}
                      </div>
                    )}
                    {cat.id === 'hatches' && !material && <p className={styles.muted}>{t.editor.brickNoHatch}</p>}
                  </section>
                ))}
                {count === 0 && <p className={styles.muted}>{t.editor.noMatch(query)}</p>}
              </div>
            </div>

            {activeDef && activeDef.shape !== 'remover' && (
              <footer className={styles.dock}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeDef.icon} alt="" />
                <span className={styles.held}>
                  <strong>{itemFullLabel(activeDef, t)}</strong>
                  <em>
                    {[activeDef.health ? `${activeDef.health} HP` : null, slotKey(activeDef.id) ? t.toolbox.slot(slotKey(activeDef.id)!) : t.toolbox.noSlot]
                      .filter(Boolean)
                      .join(' · ')}
                  </em>
                </span>
                <span className={styles.rotate}>
                  <kbd>{keyName(binds.rotate)}</kbd> {t.editor.rotate}
                </span>
              </footer>
            )}
          </>
        ) : (
          <div className={styles.panel}>{panels[tab]}</div>
        )}
      </section>
    </>
  );
}

/** Pasek na dole planu 2D: okno klocków, sloty 1-9, wyburzanie, aktywne malowanie. */
export function BuildBar({
  open,
  hotbar,
  selected,
  activeItem,
  paint,
  onOpen,
  onSlot,
  onClearSlot,
  onDemolish,
  onPaintOff,
}: {
  open: boolean;
  hotbar: Hotbar;
  selected: number | null;
  activeItem: string | null;
  /** Kolor malowania ('' = wyłączone). */
  paint: string;
  onOpen: () => void;
  onSlot: (i: number) => void;
  onClearSlot: (i: number) => void;
  onDemolish: () => void;
  onPaintOff: () => void;
}) {
  const t = useT();
  const binds = useKeybinds((s) => s.binds);
  const keyName = useKeyName();
  const paintLabel = paint === 'clear' ? t.editor.colorDefault : paint;

  return (
    <div className={styles.bar}>
      <button
        className={styles.barAll}
        data-on={open || undefined}
        aria-expanded={open}
        aria-label={t.toolbox.open(keyName(binds.inventory))}
        title={t.toolbox.open(keyName(binds.inventory))}
        onClick={onOpen}
      >
        <SquaresFour size={20} weight="duotone" />
        <kbd>{keyName(binds.inventory)}</kbd>
      </button>
      <span className={styles.barRule} aria-hidden />
      <div className={styles.slots}>
        {hotbar.map((id, i) => {
          const def = id ? findDef(id) : undefined;
          const key = keyName(binds[SLOT_ACTIONS[i]]);
          const name = def ? itemFullLabel(def, t) : null;
          return (
            <button
              key={i}
              className={styles.slot}
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
              <span className={styles.slotKey}>{key}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {def && <img src={def.icon} alt="" />}
            </button>
          );
        })}
      </div>
      <span className={styles.barRule} aria-hidden />
      {paint && (
        <button className={styles.barPaint} onClick={onPaintOff} aria-label={t.toolbox.paintOff} title={t.toolbox.paintOff}>
          <span className={styles.paintSwatch} style={paint === 'clear' ? undefined : { background: paint }} data-clear={paint === 'clear' || undefined} />
          <span>{t.toolbox.paint(paintLabel)}</span>
          <X size={12} weight="bold" />
        </button>
      )}
      <button
        className={styles.barDemolish}
        data-on={activeItem === REMOVER.id || undefined}
        onClick={onDemolish}
        aria-label={`${itemLabel(REMOVER, t)} (${keyName(binds.demolish)})`}
        title={`${itemLabel(REMOVER, t)} (${keyName(binds.demolish)})`}
      >
        <Hammer size={21} weight="duotone" />
      </button>
    </div>
  );
}
