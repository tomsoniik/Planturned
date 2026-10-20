"use client";

/*
  Interfejs widoku 3D w stylu gry: pasek 9 slotów, ekwipunek (E), czat z komendami (T, /) i menu pauzy (Esc).
  Stan (pasek, wiadomości, ustawienia sceny) trzyma edytor; tu jest tylko wygląd i obsługa myszy/klawiszy w nakładkach.
*/
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Hammer, MagnifyingGlass, X } from '@phosphor-icons/react';
import { BED, HOTBAR_SIZE, MATERIALS, REMOVER, findDef, itemsForMaterial, type BuildItem, type Hotbar, type MaterialId, type PartId } from '@/lib/builder';
import { itemLabel, type PartGroupId } from '@/lib/i18n';
import { SLOT_ACTIONS, keyLabel, useKeybinds } from '@/lib/keybinds';
import { suggest } from '@/lib/commands';
import { useT } from './I18nProvider';
import styles from './Hud3D.module.css';

const PART_GROUPS: { id: PartGroupId; parts: PartId[] }[] = [
  { id: 'slabs', parts: ['floor', 'tri_floor', 'roof', 'tri_roof', 'hole', 'tri_hole', 'hatch'] },
  { id: 'walls', parts: ['wall', 'doorway', 'window', 'garage', 'rampart', 'ramp_wall'] },
  { id: 'pillars', parts: ['pillar', 'post'] },
  { id: 'stairs', parts: ['stairs', 'ramp'] },
];

function useKeyName() {
  const t = useT();
  return (code: string) => keyLabel(code, { space: t.keys.space, shift: t.keys.shift });
}

function ItemIcon({ def }: { def: BuildItem }) {
  if (def.shape === 'remover') return <Hammer size={26} weight="bold" className={styles.toolIcon} data-remover />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={def.icon} alt="" draggable={false} />;
}

// --- Pasek ---

/** Pasek u dołu ekranu. Puste sloty są niewidoczne (zostaje tylko miejsce), wybrany pusty ma sam obrys. */
export function Hotbar({ hotbar, selected }: { hotbar: Hotbar; selected: number | null }) {
  const t = useT();
  const binds = useKeybinds((s) => s.binds);
  const keyName = useKeyName();
  if (hotbar.every((id) => !id)) {
    return <div className={styles.hotbarEmpty}>{t.hud.emptyHotbar(keyName(binds.inventory))}</div>;
  }
  return (
    <div className={styles.hotbar} aria-hidden>
      {hotbar.map((id, i) => {
        const def = id ? findDef(id) : undefined;
        return (
          <div key={i} className={styles.slot} data-empty={!def || undefined} data-on={selected === i || undefined}>
            {def && (
              <>
                <span className={styles.slotKey}>{keyName(binds[SLOT_ACTIONS[i]])}</span>
                <ItemIcon def={def} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Ekwipunek ---

type DragData = { from: 'item'; id: string } | { from: 'slot'; index: number };
const DRAG_TYPE = 'application/x-planturned';

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
  onSelectSlot: (slot: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const binds = useKeybinds((s) => s.binds);
  const keyName = useKeyName();
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  const groups = useMemo(() => {
    const items = itemsForMaterial(material);
    const q = query.trim().toLowerCase();
    if (q) return [{ label: t.editor.results, items: items.filter((i) => itemLabel(i, t).toLowerCase().includes(q)) }];
    return PART_GROUPS.map((g) => ({ label: t.editor.groups[g.id], items: items.filter((i) => i.part && g.parts.includes(i.part)) })).filter(
      (g) => g.items.length > 0,
    );
  }, [material, query, t]);

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
        onSelectSlot(target);
      }}
      title={def.health ? `${itemLabel(def, t)}, ${def.health} HP` : itemLabel(def, t)}
    >
      <ItemIcon def={def} />
      <span>{itemLabel(def, t)}</span>
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
          <div className={styles.swatches} role="radiogroup" aria-label={t.editor.material}>
            {MATERIALS.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={material === m.id}
                aria-label={t.materials[m.id]}
                title={t.materials[m.id]}
                data-on={material === m.id || undefined}
                style={{ '--swatch': m.color } as React.CSSProperties}
                onClick={() => onMaterial(m.id)}
              />
            ))}
          </div>
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
          <div className={styles.group}>
            <h3>{t.hud.tools}</h3>
            <div className={styles.tiles}>{[REMOVER, BED].map(tile)}</div>
          </div>
          {groups.map((g) => (
            <div key={g.label} className={styles.group}>
              <h3>{g.label}</h3>
              <div className={styles.tiles}>{g.items.map(tile)}</div>
            </div>
          ))}
          {groups.length === 0 && <p className={styles.muted}>{t.editor.noMatch(query)}</p>}
        </div>

        <footer className={styles.invFoot}>
          <div className={styles.invInfo}>
            {hoveredDef ? (
              <>
                <strong>{itemLabel(hoveredDef, t)}</strong>
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
                  {def && <ItemIcon def={def} />}
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

// --- Menu pauzy ---

export interface MenuSection {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface MenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export function PauseMenu({
  title,
  sections,
  actions,
  footer,
  onResume,
}: {
  title: string;
  sections: MenuSection[];
  actions: MenuAction[];
  footer: string;
  onResume: () => void;
}) {
  const t = useT();
  const [section, setSection] = useState(sections[0]?.id);
  const current = sections.find((s) => s.id === section) ?? sections[0];
  return (
    <div className={styles.backdrop} data-ui data-menu onContextMenu={(e) => e.preventDefault()}>
      <section className={styles.menu} role="dialog" aria-label={t.hud.menuTitle}>
        <nav className={styles.menuNav}>
          <p className={styles.menuTitle}>{title}</p>
          <button className="btn btn-primary" onClick={onResume} autoFocus>
            {t.hud.resume}
          </button>
          <div className={styles.menuTabs} role="tablist">
            {sections.map((s) => (
              <button key={s.id} role="tab" aria-selected={s.id === current?.id} data-on={s.id === current?.id || undefined} onClick={() => setSection(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className={styles.menuActions}>
            {actions.map((a) => (
              <button key={a.label} onClick={a.onClick}>
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        </nav>
        <div className={styles.menuBody}>
          <h2>{current?.label}</h2>
          {current?.content}
        </div>
        <p className={styles.menuFoot}>{footer}</p>
      </section>
    </div>
  );
}
