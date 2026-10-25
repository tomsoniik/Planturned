"use client";

/*
  Elementy nad sceną: pasek widoku (mapa po lewej, przełączniki warstw i widoku po prawej)
  i pionowy rail narzędzi przy lewej krawędzi. Oba w 2D i 3D, zawartość podaje strona edytora.
*/
import { useRef, useState, type ReactNode } from 'react';
import { CaretDown, DotsSix, MapTrifold } from '@phosphor-icons/react';
import { MenuList, useDismiss, type MenuEntry } from './TopBar';
import { useT } from '../I18nProvider';
import s from './EditorShell.module.css';

export interface ViewToggle {
  id: string;
  label: string;
  icon: ReactNode;
  /** Przełącznik włączony; undefined = zwykły przycisk. */
  on?: boolean;
  kbd?: string;
  /** Tylko ikona (podpis w dymku). */
  compact?: boolean;
  onClick: () => void;
}

/** Przycisk paska widoku z rozwijanym menu (np. zoom 100%). */
export function ViewMenu({ label, icon, entries }: { label: string; icon?: ReactNode; entries: MenuEntry[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  return (
    <div className={s.menuWrap} ref={ref}>
      <button className={s.viewBtn} data-on={open || undefined} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon}
        {label}
        <CaretDown size={11} weight="bold" />
      </button>
      {open && <MenuList entries={entries} onDone={() => setOpen(false)} align="right" />}
    </div>
  );
}

/** Pozycja paska widoku: przełącznik albo gotowy węzeł (np. menu zoomu). */
export type ViewItem = ViewToggle | { id: string; node: ReactNode };

export function ViewBar({ mapName, onMap, groups }: { mapName: string; onMap: () => void; groups: ViewItem[][] }) {
  const t = useT();
  return (
    <div className={s.viewBar}>
      <div className={s.chip}>
        <MapTrifold size={15} weight="duotone" />
        <span>{t.shell.map}</span>
        <strong>{mapName}</strong>
        <button className={s.chipBtn} onClick={onMap}>
          {t.shell.change}
        </button>
      </div>
      <div className={s.viewGroup}>
        {groups.flatMap((g, gi) => [
          gi > 0 ? <span key={`rule${gi}`} className={s.viewRule} aria-hidden /> : null,
          ...g.map((b) =>
            'node' in b ? (
              <span key={b.id} style={{ display: 'contents' }}>
                {b.node}
              </span>
            ) : (
              <button
                key={b.id}
                className={s.viewBtn}
                data-on={b.on || undefined}
                aria-pressed={b.on}
                title={b.kbd ? `${b.label} (${b.kbd})` : b.label}
                aria-label={b.compact ? b.label : undefined}
                onClick={b.onClick}
              >
                {b.icon}
                {!b.compact && b.label}
              </button>
            ),
          ),
        ])}
      </div>
    </div>
  );
}

export interface ToolDef {
  id: string;
  label: string;
  icon: ReactNode;
  on: boolean;
  /** Klawisz narzędzia (w dymku). */
  kbd?: string;
  danger?: boolean;
  /** Narzędzie otwiera okno wyboru (róg w prawym dolnym rogu). */
  more?: boolean;
  onClick: () => void;
}

export function ToolRail({ tools }: { tools: ToolDef[] }) {
  const t = useT();
  return (
    <div className={s.rail} role="toolbar" aria-orientation="vertical" aria-label={t.shell.tools}>
      <span className={s.railGrip} aria-hidden>
        <DotsSix size={14} weight="bold" />
      </span>
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={s.tool}
          data-on={tool.on || undefined}
          data-danger={tool.danger || undefined}
          data-more={tool.more || undefined}
          aria-pressed={tool.on}
          aria-label={tool.label}
          title={tool.kbd ? `${tool.label} (${tool.kbd})` : tool.label}
          onClick={tool.onClick}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
