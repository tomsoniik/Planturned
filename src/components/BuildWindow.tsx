"use client";

/*
  Przybornik 2D jako okno nad planem (E). Pasek po lewej filtruje po rodzaju (podłogi, ściany...) i po materiale,
  filtry się łączą. Każdy klocek to osobny kafelek w swoim materiale, jak przedmioty w ekwipunku gry.
  Sloty 1-9 są w dolnym panelu edytora (editor/Dock).
*/
import { useState, type ReactNode } from 'react';
import {
  Bed,
  Buildings,
  Columns,
  Cube,
  DoorOpen,
  GridFour,
  HouseLine,
  Keyboard,
  Leaf,
  MagnifyingGlass,
  Nut,
  Package,
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
import { BED, MATERIALS, findDef, type BuildItem, type Hotbar, type MaterialId } from '@/lib/builder';
import { BLOCK_CATEGORIES, blockSections, type CategoryId } from '@/lib/catalog';
import ItemIcon from './ItemIcon';
import { itemFullLabel, itemLabel, type SidebarTabId } from '@/lib/i18n';
import { SLOT_ACTIONS, keyLabel, useKeybinds } from '@/lib/keybinds';
import { useT } from './I18nProvider';
import styles from './BuildWindow.module.css';

export type WindowTab = Exclude<SidebarTabId, 'map'>;

// kategorie i ich kolejność są wspólne z ekwipunkiem 3D (lib/catalog), tu tylko ikony
const CATEGORY_ICON: Record<CategoryId, Icon> = { floors: GridFour, walls: Wall, roofs: HouseLine, pillars: Columns, stairs: Stairs, hatches: DoorOpen, bed: Bed };

const TABS: { id: WindowTab; Icon: Icon }[] = [
  { id: 'blocks', Icon: Cube },
  { id: 'bases', Icon: Buildings },
  { id: 'materials', Icon: Package },
  { id: 'color', Icon: PaintBucket },
  { id: 'hotkeys', Icon: Keyboard },
];

const MATERIAL_ICON: Record<MaterialId, Icon> = { maple: Leaf, birch: Tree, pine: TreeEvergreen, metal: Nut, brick: Rows };

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
  /** Zawartość pozostałych zakładek (budowle, materiały, kolor, skróty). */
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

  // Ten sam układ i wyszukiwanie co w ekwipunku 3D: nazwy części i materiałów po polsku i po angielsku
  const q = query.trim();
  const { sections, count, columns } = blockSections(category, material, query);

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
        <ItemIcon src={def.icon} name={name} size={56} />
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
                {BLOCK_CATEGORIES.map((c) =>
                  railButton(c.id, CATEGORY_ICON[c.id], t.toolbox.category[c.id], category === c.id, () => {
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
                {sections.map(({ id: catId, rows, bed }) => {
                  const CatIcon = CATEGORY_ICON[catId];
                  return (
                  <section key={catId} className={styles.section}>
                    {!category && (
                      <h4>
                        <CatIcon size={14} weight="duotone" />
                        {t.toolbox.category[catId]}
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
                    {catId === 'hatches' && !material && <p className={styles.muted}>{t.editor.brickNoHatch}</p>}
                  </section>
                  );
                })}
                {count === 0 && <p className={styles.muted}>{t.editor.noMatch(query)}</p>}
              </div>
            </div>

            {activeDef && activeDef.shape !== 'remover' && (
              <footer className={styles.dock}>
                <ItemIcon src={activeDef.icon} name={itemFullLabel(activeDef, t)} size={40} eager />
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
