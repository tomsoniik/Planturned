"use client";

/*
  Przybornik 2D jako okno nad planem (E): pasek kategorii z ikonami (Wszystko, potem filtry),
  siatka klocków i dok materiałów. Na dole planu zostaje pasek slotów 1-9 (BuildBar).
*/
import { useMemo, useState, type ReactNode } from 'react';
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
import { itemLabel, type SidebarTabId } from '@/lib/i18n';
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

export const MATERIAL_ICON: Record<MaterialId, Icon> = { maple: Leaf, birch: Tree, pine: TreeEvergreen, metal: Nut, brick: Rows };

const variant = (part: PartId, m: MaterialId) => findDef(`${m}_${part}`);
/** Klocek części w wybranym materiale, a gdy go nie ma (cegła nie ma klapy), w pierwszym, który go ma. */
const pieceOf = (part: PartId, m: MaterialId) => variant(part, m) ?? MATERIALS.map((x) => variant(part, x.id)).find(Boolean)!;
const ALL_COUNT = CATEGORIES.reduce((n, c) => n + (c.id === 'bed' ? 1 : c.parts.length), 0);

function useKeyName() {
  const t = useT();
  return (code: string) => keyLabel(code, { space: t.keys.space, shift: t.keys.shift });
}

export function BuildWindow({
  tab,
  activeItem,
  material,
  hotbar,
  panels,
  onTab,
  onPick,
  onMaterial,
  onClose,
}: {
  tab: WindowTab;
  activeItem: string | null;
  material: MaterialId;
  hotbar: Hotbar;
  /** Zawartość pozostałych zakładek (budowle, kolor, skróty). */
  panels: Record<Exclude<WindowTab, 'blocks'>, ReactNode>;
  onTab: (tab: WindowTab) => void;
  /** Wybór klocka z siatki: page wkłada go do slotu i zamyka okno. */
  onPick: (itemId: string) => void;
  onMaterial: (m: MaterialId) => void;
  onClose: () => void;
}) {
  const t = useT();
  const binds = useKeybinds((s) => s.binds);
  const keyName = useKeyName();
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [query, setQuery] = useState('');

  const activeDef = activeItem ? findDef(activeItem) : undefined;
  const slotKey = (id: string) => {
    const i = hotbar.indexOf(id);
    return i >= 0 ? keyName(binds[SLOT_ACTIONS[i]]) : null;
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const parts = CATEGORIES.flatMap((c) => c.parts).filter((p) => t.parts[p].toLowerCase().includes(q));
    return { parts, bed: itemLabel(BED, t).toLowerCase().includes(q) };
  }, [query, t]);

  const tile = (def: BuildItem, label: string) => {
    const on = def.part ? activeDef?.part === def.part : activeItem === def.id;
    const key = slotKey(def.id);
    return (
      <button
        key={def.id}
        className={styles.tile}
        data-on={on || undefined}
        onClick={() => onPick(def.id)}
        title={def.health ? `${itemLabel(def, t)}, ${def.health} HP` : itemLabel(def, t)}
      >
        {key && <span className={styles.tileKey}>{key}</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={def.icon} alt="" />
        <span className={styles.tileName}>{label}</span>
      </button>
    );
  };
  const partTile = (part: PartId) => tile(pieceOf(part, material), t.parts[part]);
  const bedTile = () => tile(BED, itemLabel(BED, t));
  const tilesOf = (c: (typeof CATEGORIES)[number]) => (c.id === 'bed' ? [bedTile()] : c.parts.map(partTile));

  const current = category ? CATEGORIES.find((c) => c.id === category)! : null;
  const railButton = (id: CategoryId | null, Glyph: Icon, label: string) => (
    <button
      key={id ?? 'all'}
      className={styles.railBtn}
      aria-label={label}
      title={label}
      aria-current={(!results && category === id) || undefined}
      data-on={(!results && category === id) || undefined}
      onClick={() => {
        setCategory(id);
        setQuery('');
      }}
    >
      <Glyph size={22} weight="duotone" />
    </button>
  );

  // Dok: HP każdego materiału dla trzymanej części; bez części tylko nazwa materiału
  const dockPart = activeDef?.part;
  const dockMaterial = activeDef?.material ?? material;

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
                {railButton(null, SquaresFour, t.toolbox.category.all)}
                <span className={styles.railRule} aria-hidden />
                {CATEGORIES.map((c) => railButton(c.id, c.Icon, t.toolbox.category[c.id]))}
                <button
                  className={styles.railBtn}
                  data-remover
                  data-on={activeItem === REMOVER.id || undefined}
                  aria-label={`${itemLabel(REMOVER, t)} (${keyName(binds.demolish)})`}
                  title={`${itemLabel(REMOVER, t)} (${keyName(binds.demolish)})`}
                  onClick={() => onPick(REMOVER.id)}
                >
                  <Hammer size={22} weight="duotone" />
                </button>
              </nav>

              <div className={styles.content}>
                {results ? (
                  <>
                    <h3 className={styles.title}>
                      {t.editor.results}
                      <span>{results.parts.length + (results.bed ? 1 : 0)}</span>
                    </h3>
                    <div className={styles.grid}>
                      {results.parts.map(partTile)}
                      {results.bed && bedTile()}
                    </div>
                    {results.parts.length === 0 && !results.bed && <p className={styles.muted}>{t.editor.noMatch(query)}</p>}
                  </>
                ) : current ? (
                  <>
                    <h3 className={styles.title}>
                      {t.toolbox.category[current.id]}
                      <span>{current.id === 'bed' ? 1 : current.parts.length}</span>
                      {current.id === 'walls' && <em>{t.toolbox.wallsNote}</em>}
                    </h3>
                    <div className={styles.grid} data-big>
                      {tilesOf(current)}
                    </div>
                    {current.id === 'hatches' && <p className={styles.muted}>{t.editor.brickNoHatch}</p>}
                  </>
                ) : (
                  <>
                    <h3 className={styles.title}>
                      {t.toolbox.category.all}
                      <span>{ALL_COUNT}</span>
                    </h3>
                    {CATEGORIES.map((c) => (
                      <section key={c.id} className={styles.section}>
                        <h4>
                          <c.Icon size={14} weight="duotone" />
                          {t.toolbox.category[c.id]}
                        </h4>
                        <div className={styles.grid}>{tilesOf(c)}</div>
                      </section>
                    ))}
                  </>
                )}
              </div>
            </div>

            <footer className={styles.dock}>
              <div className={styles.held}>
                {activeDef && activeDef.shape !== 'remover' ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeDef.icon} alt="" />
                    <span>
                      <strong>{activeDef.part ? t.parts[activeDef.part] : itemLabel(activeDef, t)}</strong>
                      <em>{slotKey(activeDef.id) ? t.toolbox.slot(slotKey(activeDef.id)!) : t.toolbox.noSlot}</em>
                    </span>
                  </>
                ) : (
                  <span>
                    <strong>{t.toolbox.materialOf(t.materials[material])}</strong>
                  </span>
                )}
              </div>
              <div className={styles.materials} role="radiogroup" aria-label={t.editor.material}>
                {MATERIALS.map((m) => {
                  const v = dockPart ? variant(dockPart, m.id) : undefined;
                  const Glyph = MATERIAL_ICON[m.id];
                  const missing = !!dockPart && !v;
                  const label = missing
                    ? t.toolbox.noVariant(t.materials[m.id])
                    : v?.health ? `${t.materials[m.id]}, ${v.health} HP` : t.materials[m.id];
                  return (
                    <button
                      key={m.id}
                      role="radio"
                      aria-checked={dockMaterial === m.id}
                      aria-label={label}
                      title={label}
                      data-on={dockMaterial === m.id || undefined}
                      disabled={missing}
                      onClick={() => onMaterial(m.id)}
                    >
                      <Glyph size={19} weight="duotone" />
                      <span>{v?.health ?? t.materials[m.id]}</span>
                    </button>
                  );
                })}
              </div>
            </footer>
          </>
        ) : (
          <div className={styles.panel}>{panels[tab]}</div>
        )}
      </section>
    </>
  );
}

/** Pasek na dole planu 2D: okno klocków, sloty 1-9, materiał, wyburzanie, aktywne malowanie. */
export function BuildBar({
  open,
  hotbar,
  selected,
  activeItem,
  material,
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
  material: MaterialId;
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
  const activeDef = activeItem ? findDef(activeItem) : undefined;
  const mat = activeDef?.material ?? material;
  const MatGlyph = MATERIAL_ICON[mat];
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
          const name = def ? itemLabel(def, t) : null;
          return (
            <button
              key={i}
              className={styles.slot}
              data-on={selected === i || undefined}
              data-empty={!def || undefined}
              aria-label={t.hud.slotAria(i + 1, name)}
              title={name ?? undefined}
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
      {paint ? (
        <button className={styles.barPaint} onClick={onPaintOff} aria-label={t.toolbox.paintOff} title={t.toolbox.paintOff}>
          <span className={styles.paintSwatch} style={paint === 'clear' ? undefined : { background: paint }} data-clear={paint === 'clear' || undefined} />
          <span>{t.toolbox.paint(paintLabel)}</span>
          <X size={12} weight="bold" />
        </button>
      ) : (
        <button
          className={styles.barMaterial}
          onClick={onOpen}
          aria-label={t.toolbox.materialOf(t.materials[mat])}
          title={t.toolbox.materialOf(t.materials[mat])}
        >
          <MatGlyph size={20} weight="duotone" />
          {activeDef?.health && <span>{activeDef.health} HP</span>}
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
