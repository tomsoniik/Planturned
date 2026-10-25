"use client";

/*
  Interfejs widoku 3D w stylu gry: pasek 9 slotów, ekwipunek (E), czat z komendami (T, /) i menu pauzy (Esc).
  Stan (pasek, wiadomości, ustawienia sceny) trzyma edytor; tu jest tylko wygląd i obsługa myszy/klawiszy w nakładkach.
*/
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Hammer, Lightbulb, MagnifyingGlass, X } from '@phosphor-icons/react';
import { BED, HOTBAR_SIZE, MATERIALS, REMOVER, findDef, type BuildItem, type Hotbar, type MaterialId } from '@/lib/builder';
import { loadProps, usePropsStore } from '@/lib/props';
import { BLOCK_CATEGORIES, PROP_GROUP_ORDER, blockSections, matchesProp, type CategoryId } from '@/lib/catalog';
import { itemFullLabel, itemLabel } from '@/lib/i18n';
import { SLOT_ACTIONS, keyLabel, useKeybinds } from '@/lib/keybinds';
import { suggest } from '@/lib/commands';
import type { MapMeta, Site } from '@/lib/terrain';
import { useT } from './I18nProvider';
import MapView from './MapView';
import ItemIcon from './ItemIcon';
import styles from './Hud3D.module.css';

function useKeyName() {
  const t = useT();
  return (code: string) => keyLabel(code, { space: t.keys.space, shift: t.keys.shift });
}

/** Ikona z gry (wspólny komponent); wyburzanie to narzędzie planera, więc ma symbol młotka. */
function DefIcon({ def, size }: { def: BuildItem; size: number }) {
  const t = useT();
  if (def.shape === 'remover') return <Hammer size={26} weight="bold" className={styles.toolIcon} data-remover />;
  return <ItemIcon src={def.icon} name={itemLabel(def, t)} size={size} eager />;
}

// --- Ekwipunek ---

type DragData = { from: 'item'; id: string } | { from: 'slot'; index: number };
const DRAG_TYPE = 'application/x-untmatica';

export function Inventory({
  hotbar,
  selected,
  material,
  onMaterial,
  onAssign,
  onSwap,
  onSelectSlot,
  onClose,
}: {
  hotbar: Hotbar;
  selected: number | null;
  material: MaterialId;
  onMaterial: (m: MaterialId) => void;
  /** Wkłada element do slotu (null czyści slot). */
  onAssign: (slot: number, itemId: string | null) => void;
  onSwap: (a: number, b: number) => void;
  /** itemId: przedmiot właśnie włożony do slotu (rodzic ma jeszcze stary pasek). */
  onSelectSlot: (slot: number, itemId?: string | null) => void;
  onClose: () => void;
}) {
  const t = useT();
  const binds = useKeybinds((s) => s.binds);
  const keyName = useKeyName();
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  // Budowle (struktury z materiałami) albo rekwizyty (barykady z gry); start na rekwizytach, gdy taki jest w wybranym slocie
  const [tab, setTab] = useState<'structures' | 'props'>(() =>
    selected !== null && hotbar[selected] && findDef(hotbar[selected]!)?.shape === 'prop' ? 'props' : 'structures',
  );
  const props = usePropsStore((s) => s.items);
  const propsReady = usePropsStore((s) => s.ready);
  useEffect(() => {
    loadProps();
  }, []);
  // Filtry jak w oknie klocków 2D: kategoria i materiał się łączą (null = wszystkie)
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [matFilter, setMatFilter] = useState<MaterialId | null>(null);
  void material;

  // Klocki: ten sam układ co w 2D (wiersz = część, kolumna = materiał), wspólny z lib/catalog
  const blocks = useMemo(() => blockSections(category, matFilter, query), [category, matFilter, query]);

  // Rekwizyty: stała kolejność grup, w grupie kolejność katalogu (propCatalog); wyniki szukania w tej samej kolejności
  const propGroups = useMemo(() => {
    const groups = PROP_GROUP_ORDER.map((c) => ({ id: c, items: props.filter((p) => p.category === c && matchesProp(p, query)) })).filter(
      (g) => g.items.length > 0,
    );
    return query.trim() ? [{ id: 'results' as const, items: groups.flatMap((g) => g.items) }] : groups;
  }, [props, query]);

  // Najechany element + klawisz slotu: element trafia do tego slotu (jak w Minecrafcie)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const slot = SLOT_ACTIONS.findIndex((a) => binds[a] === e.code);
      if (slot < 0) return;
      e.preventDefault();
      if (hovered) onAssign(slot, hovered);
      else onSelectSlot(slot);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [binds, hovered, onAssign, onSelectSlot]);

  const target = selected ?? 0;
  const startDrag = (e: React.DragEvent, data: DragData) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
  };
  const readDrag = (e: React.DragEvent): DragData | null => {
    try {
      return JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as DragData;
    } catch {
      return null;
    }
  };

  const tile = (def: BuildItem) => (
    <button
      key={def.id}
      className={styles.tile}
      data-on={hotbar[target] === def.id || undefined}
      draggable
      onDragStart={(e) => startDrag(e, { from: 'item', id: def.id })}
      onMouseEnter={() => setHovered(def.id)}
      onMouseLeave={() => setHovered((h) => (h === def.id ? null : h))}
      onClick={() => {
        onAssign(target, def.id);
        onSelectSlot(target, def.id);
      }}
      title={def.health ? `${itemFullLabel(def, t)}, ${def.health} HP` : itemFullLabel(def, t)}
    >
      <DefIcon def={def} size={40} />
      <span>{def.part ? t.parts[def.part] : itemLabel(def, t)}</span>
      {def.material && <span className={styles.tileMeta}>{t.materials[def.material]}</span>}
    </button>
  );

  const hoveredDef = hovered ? findDef(hovered) : undefined;

  return (
    <div
      className={styles.backdrop}
      data-ui
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // slot upuszczony poza paskiem: czyścimy go
        const d = readDrag(e);
        if (d?.from === 'slot') onAssign(d.index, null);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <section className={styles.inventory} role="dialog" aria-label={t.hud.inventory}>
        <header className={styles.invHead}>
          <h2>{t.hud.inventory}</h2>
          <div className={styles.invTabs} role="tablist" aria-label={t.hud.inventory}>
            {(['structures', 'props'] as const).map((id) => (
              <button key={id} role="tab" aria-selected={tab === id} data-on={tab === id || undefined} onClick={() => setTab(id)}>
                {id === 'structures' ? t.hud.tabStructures : t.hud.tabProps}
                {id === 'props' && props.length > 0 && <span className={styles.invCount}>{props.length}</span>}
              </button>
            ))}
          </div>
          {tab === 'structures' && (
            <div className={styles.swatches} role="group" aria-label={t.editor.material}>
              {MATERIALS.map((m) => (
                <button
                  key={m.id}
                  aria-pressed={matFilter === m.id}
                  aria-label={t.materials[m.id]}
                  title={t.materials[m.id]}
                  data-on={matFilter === m.id || undefined}
                  style={{ '--swatch': m.color } as React.CSSProperties}
                  onClick={() => {
                    // drugi klik zdejmuje filtr (wszystkie materiały), jak w 2D
                    const next = matFilter === m.id ? null : m.id;
                    setMatFilter(next);
                    if (next) onMaterial(next);
                    if (next && category === 'bed') setCategory(null);
                  }}
                />
              ))}
            </div>
          )}
          <label className={styles.search}>
            <MagnifyingGlass size={14} weight="bold" />
            <input
              type="text"
              placeholder={t.editor.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
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
          <button className="icon-btn" onClick={onClose} aria-label={t.hud.resume} title={keyName(binds.inventory)}>
            <X size={16} weight="bold" />
          </button>
        </header>

        <div className={styles.invBody}>
          {tab === 'structures' && (
            <>
              <div className={styles.catChips} role="group" aria-label={t.toolbox.categories}>
                <button data-on={!category || undefined} aria-pressed={!category} onClick={() => setCategory(null)}>
                  {t.toolbox.category.all}
                </button>
                {BLOCK_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    data-on={category === c.id || undefined}
                    aria-pressed={category === c.id}
                    onClick={() => {
                      setCategory(category === c.id ? null : c.id);
                      if (c.id === 'bed') setMatFilter(null);
                    }}
                  >
                    {t.toolbox.category[c.id]}
                  </button>
                ))}
              </div>
              {!query && !category && !matFilter && (
                <div className={styles.group}>
                  <h3>{t.hud.tools}</h3>
                  <div className={styles.tiles}>{tile(REMOVER)}</div>
                </div>
              )}
              {blocks.sections.map((sec) => (
                <div key={sec.id} className={styles.group}>
                  <h3>{t.toolbox.category[sec.id]}</h3>
                  {sec.bed ? (
                    <div className={styles.tiles}>{tile(BED)}</div>
                  ) : matFilter ? (
                    <div className={styles.tiles}>{sec.rows.flatMap((r) => r.cells.filter((d): d is BuildItem => !!d).map(tile))}</div>
                  ) : (
                    <div className={styles.matrix} style={{ gridTemplateColumns: `repeat(${blocks.columns}, minmax(0, 1fr))` }}>
                      {sec.rows.flatMap((r) => r.cells.map((d, i) => (d ? tile(d) : <span key={`${r.part}-${i}`} className={styles.gap} aria-hidden />)))}
                    </div>
                  )}
                </div>
              ))}
              {blocks.count === 0 && query && <p className={styles.muted}>{t.editor.noMatch(query)}</p>}
            </>
          )}
          {tab === 'props' && props.length === 0 && (
            <p className={styles.muted}>{propsReady ? t.hud.propsMissing : t.hud.propsLoading}</p>
          )}
          {tab === 'props' &&
            propGroups.map((g) => (
              <div key={g.id} className={styles.group}>
                <h3>{g.id === 'results' ? t.editor.results : t.hud.propCategories[g.id]}</h3>
                <div className={styles.tiles}>{g.items.map(tile)}</div>
              </div>
            ))}
          {tab === 'props' && props.length > 0 && propGroups.length === 0 && query && <p className={styles.muted}>{t.editor.noMatch(query)}</p>}
        </div>

        <footer className={styles.invFoot}>
          <div className={styles.invInfo}>
            {hoveredDef ? (
              <>
                <strong>{itemFullLabel(hoveredDef, t)}</strong>
                {hoveredDef.health && <span>{hoveredDef.health} HP</span>}
              </>
            ) : (
              <span>{t.hud.inventoryHint}</span>
            )}
          </div>
          <div className={styles.invHotbar} role="list" aria-label={t.hud.hotbar}>
            {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
              const def = hotbar[i] ? findDef(hotbar[i]!) : undefined;
              return (
                <button
                  key={i}
                  role="listitem"
                  className={styles.invSlot}
                  data-on={selected === i || undefined}
                  data-drop={dropSlot === i || undefined}
                  aria-label={t.hud.slotAria(i + 1, def ? itemLabel(def, t) : null)}
                  draggable={!!def}
                  onDragStart={(e) => startDrag(e, { from: 'slot', index: i })}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropSlot(i);
                  }}
                  onDragLeave={() => setDropSlot((s) => (s === i ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropSlot(null);
                    const d = readDrag(e);
                    if (d?.from === 'item') onAssign(i, d.id);
                    if (d?.from === 'slot' && d.index !== i) onSwap(d.index, i);
                  }}
                  onClick={() => onSelectSlot(i)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onAssign(i, null);
                  }}
                  onMouseEnter={() => def && setHovered(def.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className={styles.slotKey}>{keyName(binds[SLOT_ACTIONS[i]])}</span>
                  {def && <DefIcon def={def} size={38} />}
                </button>
              );
            })}
          </div>
        </footer>
      </section>
    </div>
  );
}

// --- Czat ---

export interface ChatMessage {
  id: number;
  text: string;
  kind: 'cmd' | 'info' | 'error';
  /** Po kilku sekundach znika z ekranu (zostaje w historii otwartego czatu). */
  faded?: boolean;
}

export function Chat({
  open,
  initial,
  messages,
  history,
  itemIds,
  onSubmit,
  onClose,
}: {
  open: boolean;
  /** Tekst na start (np. "/" po wciśnięciu ukośnika). */
  initial: string;
  messages: ChatMessage[];
  history: string[];
  itemIds: string[];
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState(initial);
  const [pick, setPick] = useState(0);
  const [back, setBack] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages, open]);

  const suggestions = useMemo(() => (open ? suggest(value, itemIds) : []), [open, value, itemIds]);
  const shown = open ? messages.slice(-40) : messages.filter((m) => !m.faded).slice(-6);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) onSubmit(value.trim());
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const s = suggestions[Math.min(pick, suggestions.length - 1)];
      if (s) {
        setValue(s.complete);
        setPick(0);
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      if (suggestions.length > 1) {
        setPick((p) => (p + dir + suggestions.length) % suggestions.length);
      } else if (history.length) {
        // historia komend: strzałka w górę cofa się do starszych
        const next = Math.max(-1, Math.min(history.length - 1, back - dir));
        setBack(next);
        setValue(next < 0 ? '' : history[history.length - 1 - next]);
      }
    }
  };

  if (!open && shown.length === 0) return null;
  return (
    <div className={styles.chat} data-open={open || undefined} data-ui={open || undefined}>
      {shown.length > 0 && (
        <div ref={list} className={styles.chatLog} aria-live="polite">
          {shown.map((m) => (
            <p key={m.id} data-kind={m.kind}>
              {m.text}
            </p>
          ))}
        </div>
      )}
      {open && (
        <>
          {suggestions.length > 0 && (
            <ul className={styles.suggest}>
              {suggestions.map((s, i) => (
                <li key={s.complete} data-on={i === Math.min(pick, suggestions.length - 1) || undefined}>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setValue(s.complete);
                      setPick(0);
                      input.current?.focus();
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={input}
            className={styles.chatInput}
            value={value}
            placeholder={t.hud.chatPlaceholder}
            onChange={(e) => {
              setValue(e.target.value);
              setPick(0);
            }}
            onKeyDown={onKeyDown}
            onBlur={onClose}
            spellCheck={false}
            autoComplete="off"
            aria-label={t.hud.chatPlaceholder}
          />
          <p className={styles.chatHint}>{t.hud.chatHint}</p>
        </>
      )}
    </div>
  );
}

// --- Mapa (M) ---

/** Pełna mapa z gry pod M: strzałka gracza, baza, spawny; klik teleportuje. */
export function MapScreen({
  meta,
  site,
  onTeleport,
  onClose,
}: {
  meta: MapMeta;
  site?: Site;
  onTeleport: (x: number, z: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div className={styles.backdrop} data-ui onMouseDown={(e) => e.target === e.currentTarget && onClose()} onContextMenu={(e) => e.preventDefault()}>
      <section className={styles.mapScreen} role="dialog" aria-label={t.hud.map}>
        <header className={styles.invHead}>
          <h2>{t.hud.map}</h2>
          <p className={styles.mapHint}>{t.hud.mapHint}</p>
          <button className="icon-btn" onClick={onClose} aria-label={t.hud.resume}>
            <X size={16} weight="bold" />
          </button>
        </header>
        <div className={styles.mapBody}>
          <MapView
            meta={meta}
            site={site}
            live
            onPick={onTeleport}
            onSpawn={(i) => {
              const sp = meta.noBuild?.spawns[i];
              if (sp) onTeleport(sp[0], sp[2]);
            }}
          />
        </div>
      </section>
    </div>
  );
}

// --- Jak grać (pierwsza zakładka menu) ---

/** Klawisze z bieżących ustawień; LPM i Ctrl+Z są stałe. */
function Keys({ codes }: { codes: string[] }) {
  return (
    <span className={styles.quickKeys}>
      {codes.map((c) => (
        <kbd key={c}>{c}</kbd>
      ))}
    </span>
  );
}

export function QuickStart() {
  const t = useT();
  const q = t.hud.quick;
  const binds = useKeybinds((s) => s.binds);
  const keyName = useKeyName();
  const k = (a: keyof typeof binds) => keyName(binds[a]);
  const groups: { title: string; rows: [string[], string][] }[] = [
    {
      title: q.move,
      rows: [
        [[k('forward'), k('left'), k('back'), k('right')], q.walk],
        [[k('up')], q.jump],
        [[k('sprint')], q.sprint],
        [[k('forward')], q.climb],
        [[k('toggleFly')], q.fly],
      ],
    },
    {
      title: q.build,
      rows: [
        [[k('inventory')], q.inventory],
        [[`${k('slot1')}-${k('slot9')}`], q.slots],
        [[q.lmb], q.place],
        [[k('rotate')], q.rotate],
        [[k('demolish')], q.demolish],
        [['Ctrl', 'Z'], q.undo],
      ],
    },
    {
      title: q.base,
      rows: [
        [[k('interact')], q.interact],
        [[k('map')], q.map],
        [[k('chat')], q.chat],
        [[k('grab')], q.grab],
      ],
    },
  ];
  return (
    <div className={styles.quick}>
      <div className={styles.quickGrid}>
        {groups.map((g) => (
          <section key={g.title} className={styles.quickGroup}>
            <h3>{g.title}</h3>
            <ul>
              {g.rows.map(([codes, label]) => (
                <li key={label}>
                  <span>{label}</span>
                  <Keys codes={codes} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className={styles.tips}>
        <h3>
          <Lightbulb size={15} weight="duotone" />
          {q.tipsTitle}
        </h3>
        <ul>
          {q.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
