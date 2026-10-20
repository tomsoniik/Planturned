"use client";

/*
  Przybornik 2D: kategorie elementów w pionowym pasku (ikony z gry), po prawej lista elementów kategorii.
  Materiał wybiera się przy elemencie (ikony kłody, blachy, cegieł z gry), nie osobnymi kolorowymi próbkami.
*/
import { useMemo, useState } from 'react';
import { Hammer, MagnifyingGlass, X } from '@phosphor-icons/react';
import { BED, MATERIALS, REMOVER, findDef, iconUrl, type BuildItem, type MaterialId, type PartId } from '@/lib/builder';
import { itemLabel } from '@/lib/i18n';
import { SLOT_ACTIONS, keyLabel, useKeybinds } from '@/lib/keybinds';
import { useT } from './I18nProvider';
import styles from './Toolbox.module.css';

type CategoryId = 'floors' | 'roofs' | 'walls' | 'pillars' | 'stairs' | 'hatches' | 'tools';

const CATEGORIES: { id: CategoryId; parts: PartId[] }[] = [
  { id: 'floors', parts: ['floor', 'tri_floor'] },
  { id: 'walls', parts: ['wall', 'doorway', 'window', 'garage', 'rampart', 'ramp_wall'] },
  { id: 'roofs', parts: ['roof', 'tri_roof', 'hole', 'tri_hole'] },
  { id: 'pillars', parts: ['pillar', 'post'] },
  { id: 'stairs', parts: ['stairs', 'ramp'] },
  { id: 'hatches', parts: ['hatch'] },
  { id: 'tools', parts: [] },
];

/** Ikona kategorii: element z gry (klon), narzędzia: młotek. */
const CATEGORY_ICON: Partial<Record<CategoryId, string>> = {
  floors: 'maple_floor',
  walls: 'maple_wall',
  roofs: 'maple_roof',
  pillars: 'maple_pillar',
  stairs: 'maple_stairs',
  hatches: 'maple_hatch',
};

/** Ikony materiałów: przedmioty z gry (Bundles/Items/Supplies). */
const MATERIAL_ICON: Record<MaterialId, number> = { maple: 39, birch: 37, pine: 41, metal: 68, brick: 74 };

const variant = (part: PartId, m: MaterialId) => findDef(`${m}_${part}`);

export default function Toolbox({
  activeItem,
  material,
  counts,
  hotbar,
  onMaterial,
  onSelect,
}: {
  activeItem: string | null;
  material: MaterialId;
  /** Ile sztuk danego elementu stoi w projekcie. */
  counts: Record<string, number>;
  hotbar: (string | null)[];
  onMaterial: (m: MaterialId) => void;
  onSelect: (itemId: string) => void;
}) {
  const t = useT();
  const binds = useKeybinds((s) => s.binds);
  const [category, setCategory] = useState<CategoryId>('floors');
  const [query, setQuery] = useState('');
  const keyName = (code: string) => keyLabel(code, { space: t.keys.space, shift: t.keys.shift });

  // wyszukiwanie: po wszystkich częściach (nazwa bez materiału) i narzędziach
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const parts = CATEGORIES.flatMap((c) => c.parts).filter((p) => t.parts[p].toLowerCase().includes(q));
    const tools = [REMOVER, BED].filter((d) => itemLabel(d, t).toLowerCase().includes(q));
    return { parts, tools };
  }, [query, t]);

  const activeDef = activeItem ? findDef(activeItem) : undefined;

  const slotKey = (id: string) => {
    const i = hotbar.indexOf(id);
    return i >= 0 ? keyName(binds[SLOT_ACTIONS[i]]) : null;
  };

  const partRow = (part: PartId) => {
    const own = variant(part, material);
    const def = own ?? MATERIALS.map((m) => variant(part, m.id)).find(Boolean)!;
    const on = activeDef?.part === part;
    const key = slotKey(def.id);
    const count = MATERIALS.reduce((n, m) => n + (counts[`${m.id}_${part}`] || 0), 0);
    return (
      <div key={part} className={styles.row} data-on={on || undefined}>
        <button className={styles.main} onClick={() => onSelect(def.id)} title={def.health ? `${itemLabel(def, t)}, ${def.health} HP` : itemLabel(def, t)}>
          <span className={styles.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={def.icon} alt="" />
            {key && <kbd className={styles.key}>{key}</kbd>}
          </span>
          <span className={styles.text}>
            <strong>{t.parts[part]}</strong>
            <span>
              {def.health ? `${def.health} HP` : ''}
              {count > 0 && <em>{t.toolbox.placed(count)}</em>}
            </span>
          </span>
        </button>
        <div className={styles.materials} role="radiogroup" aria-label={t.editor.material}>
          {MATERIALS.map((m) => {
            const v = variant(part, m.id);
            const picked = on ? activeDef?.material === m.id : material === m.id;
            return (
              <button
                key={m.id}
                role="radio"
                aria-checked={picked}
                aria-label={t.materials[m.id]}
                title={v ? `${t.materials[m.id]}${v.health ? `, ${v.health} HP` : ''}` : t.toolbox.noVariant(t.materials[m.id])}
                data-on={picked || undefined}
                disabled={!v}
                onClick={() => {
                  if (!v) return;
                  onMaterial(m.id);
                  onSelect(v.id);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconUrl(MATERIAL_ICON[m.id])} alt="" />
                <span>{t.materials[m.id]}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const toolRow = (def: BuildItem) => {
    const key = slotKey(def.id);
    return (
      <div key={def.id} className={styles.row} data-on={activeItem === def.id || undefined} data-remover={def.shape === 'remover' || undefined}>
        <button className={styles.main} onClick={() => onSelect(def.id)}>
          <span className={styles.thumb}>
            {def.shape === 'remover' ? (
              <Hammer size={22} weight="bold" className={styles.remover} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={def.icon} alt="" />
            )}
            {key && <kbd className={styles.key}>{key}</kbd>}
          </span>
          <span className={styles.text}>
            <strong>{itemLabel(def, t)}</strong>
            <span>
              <kbd>{keyName(def.shape === 'remover' ? binds.demolish : binds.bed)}</kbd>
            </span>
          </span>
        </button>
      </div>
    );
  };

  const current = CATEGORIES.find((c) => c.id === category)!;

  return (
    <div className={styles.toolbox}>
      <label className={styles.search}>
        <MagnifyingGlass size={14} weight="bold" />
        <input type="text" placeholder={t.editor.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button onClick={() => setQuery('')} aria-label={t.editor.clearSearch}>
            <X size={12} weight="bold" />
          </button>
        )}
      </label>

      <div className={styles.body}>
        <nav className={styles.rail} aria-label={t.toolbox.categories}>
          {CATEGORIES.map((c) => {
            const icon = CATEGORY_ICON[c.id];
            return (
              <button
                key={c.id}
                data-on={(!results && category === c.id) || undefined}
                onClick={() => {
                  setCategory(c.id);
                  setQuery('');
                }}
                title={t.toolbox.category[c.id]}
              >
                {icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={findDef(icon)!.icon} alt="" />
                ) : (
                  <Hammer size={20} weight="bold" />
                )}
                <span>{t.toolbox.category[c.id]}</span>
              </button>
            );
          })}
        </nav>

        <section className={styles.list}>
          {results ? (
            <>
              <h3>{t.editor.results}</h3>
              {results.parts.map(partRow)}
              {results.tools.map(toolRow)}
              {results.parts.length + results.tools.length === 0 && <p className={styles.muted}>{t.editor.noMatch(query)}</p>}
            </>
          ) : (
            <>
              <h3>{t.toolbox.category[current.id]}</h3>
              {current.id === 'tools' ? [REMOVER, BED].map(toolRow) : current.parts.map(partRow)}
              {current.id === 'hatches' && <p className={styles.muted}>{t.editor.brickNoHatch}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
