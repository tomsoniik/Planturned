"use client";

/*
  Planner (2D) bez górnego paska: pływające wyspy nad planem.
  Lewa: powrót, nazwa projektu z menu (zmiana nazwy, eksport, wyczyść), stan zapisu.
  Środek: przełącznik Planner / Sandbox. Prawa: cofnij/ponów, mapa, warstwy, menu ⋯ (język, skróty).
  Piętra: pionowy pasek przy prawej krawędzi.
*/
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  Bed,
  CaretDown,
  CloudCheck,
  Cube,
  DotsThreeOutline,
  DownloadSimple,
  GlobeHemisphereWest,
  GridFour,
  Keyboard,
  MapTrifold,
  PencilSimple,
  Plus,
  Stack,
  Translate,
  Trash,
} from '@phosphor-icons/react';
import LangSwitch from './LangSwitch';
import { useT } from './I18nProvider';
import styles from './PlannerChrome.module.css';

export type Mode = 'planner' | 'sandbox';

/** Przełącznik trybu: Planner (plan 2D) i Sandbox (świat 3D). */
export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const t = useT();
  const item = (m: Mode, Glyph: typeof Cube) => (
    <button role="tab" aria-selected={mode === m} data-on={mode === m || undefined} onClick={() => mode !== m && onChange(m)}>
      <Glyph size={18} weight="duotone" />
      <span>{t.editor.modes[m]}</span>
    </button>
  );
  return (
    <div className={styles.mode} role="tablist" aria-label={t.editor.view}>
      {item('planner', GridFour)}
      {item('sandbox', Cube)}
    </div>
  );
}

/** Zamyka menu po kliknięciu obok albo Esc (Esc nie trafia wtedy do skrótów edytora). */
function useDismiss(open: boolean, close: () => void, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      close();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, close, ref]);
}

function MenuItem({
  icon,
  label,
  extra,
  danger,
  narrow,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  extra?: ReactNode;
  danger?: boolean;
  /** Tylko na wąskim ekranie (na szerokim to samo jest na wyspie). */
  narrow?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className={styles.itemIcon}>{icon}</span>
      <span className={styles.itemLabel}>{label}</span>
      {extra}
    </>
  );
  // wiersz z własnymi przyciskami (język) nie może być przyciskiem
  return onClick ? (
    <button role="menuitem" className={styles.item} data-danger={danger || undefined} data-narrow={narrow || undefined} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={styles.item} data-static>
      {body}
    </div>
  );
}

export default function PlannerChrome({
  name,
  saved,
  onRename,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  mapLabel,
  hasSite,
  underlay,
  bedAreas,
  onMap,
  onUnderlay,
  onBedAreas,
  onExport,
  onClear,
  onKeys,
  onSandbox,
  floors,
  floorBase,
  floor,
  onFloor,
  onAddFloor,
}: {
  name: string;
  saved: boolean;
  onRename: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  mapLabel: string;
  hasSite: boolean;
  underlay: boolean;
  bedAreas: boolean;
  onMap: () => void;
  onUnderlay: () => void;
  onBedAreas: () => void;
  onExport: () => void;
  onClear: () => void;
  onKeys: () => void;
  onSandbox: () => void;
  /** Poziomy do wyboru (rosnąco). */
  floors: number[];
  floorBase: number;
  floor: number;
  onFloor: (lvl: number) => void;
  onAddFloor: () => void;
}) {
  const t = useT();
  const [projectOpen, setProjectOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const projectRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  useDismiss(projectOpen, () => setProjectOpen(false), projectRef);
  useDismiss(moreOpen, () => setMoreOpen(false), moreRef);

  const startRename = () => {
    setProjectOpen(false);
    setDraft(name);
    setEditing(true);
  };
  const finishRename = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== name) onRename(next);
  };
  const floorLabel = (lvl: number) => (lvl === floorBase ? t.editor.groundShort : String(lvl - floorBase));

  return (
    <>
      <div className={styles.top}>
        {/* Lewa wyspa: projekt */}
        <div className={styles.island} data-side="left" ref={projectRef}>
          <Link href="/builder" className={styles.btn} title={t.editor.back} aria-label={t.editor.back}>
            <ArrowLeft size={18} weight="bold" />
          </Link>
          <span className={styles.rule} aria-hidden />
          {editing ? (
            <input
              autoFocus
              className={styles.nameInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={finishRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishRename();
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setEditing(false);
                }
              }}
              aria-label={t.editor.projectName}
            />
          ) : (
            <button
              className={styles.name}
              aria-haspopup="menu"
              aria-expanded={projectOpen}
              onClick={() => setProjectOpen((o) => !o)}
              onDoubleClick={startRename}
              title={t.editor.rename}
            >
              <strong>{name || t.editor.loading}</strong>
              <CaretDown size={13} weight="bold" />
            </button>
          )}
          <span className={styles.saved} title={saved ? t.editor.saved : t.editor.autosave}>
            <CloudCheck size={16} weight="duotone" />
            <span>{saved ? t.editor.saved : t.editor.autosave}</span>
          </span>
          {projectOpen && (
            <div className={styles.menu} role="menu" data-side="left">
              <MenuItem icon={<PencilSimple size={17} weight="duotone" />} label={t.editor.rename} onClick={startRename} />
              <MenuItem
                icon={<DownloadSimple size={17} weight="duotone" />}
                label={t.editor.export}
                onClick={() => {
                  setProjectOpen(false);
                  onExport();
                }}
              />
              <span className={styles.menuRule} aria-hidden />
              <MenuItem
                icon={<Trash size={17} weight="duotone" />}
                label={t.editor.clear}
                danger
                onClick={() => {
                  setProjectOpen(false);
                  onClear();
                }}
              />
            </div>
          )}
        </div>

        <div className={styles.center}>
          <ModeSwitch mode="planner" onChange={(m) => m === 'sandbox' && onSandbox()} />
        </div>

        {/* Prawa wyspa: historia, mapa, warstwy, więcej */}
        <div className={styles.island} data-side="right" ref={moreRef}>
          <button className={styles.btn} onClick={onUndo} disabled={!canUndo} title={t.editor.undo} aria-label={t.editor.undo}>
            <ArrowCounterClockwise size={18} weight="bold" />
          </button>
          <button className={styles.btn} onClick={onRedo} disabled={!canRedo} title={t.editor.redo} aria-label={t.editor.redo}>
            <ArrowClockwise size={18} weight="bold" />
          </button>
          <span className={styles.rule} aria-hidden />
          <button className={styles.mapChip} onClick={onMap} title={t.mapChooser.change}>
            <MapTrifold size={16} weight="duotone" />
            <span>{mapLabel}</span>
          </button>
          {hasSite && (
            <button className={styles.btn} data-layer data-on={underlay || undefined} onClick={onUnderlay} title={t.mapChooser.underlay} aria-label={t.mapChooser.underlay} aria-pressed={underlay}>
              <GlobeHemisphereWest size={18} weight="duotone" />
            </button>
          )}
          <button className={styles.btn} data-layer data-on={bedAreas || undefined} onClick={onBedAreas} title={t.editor.bedAreas} aria-label={t.editor.bedAreas} aria-pressed={bedAreas}>
            <Bed size={18} weight="duotone" />
          </button>
          <button
            className={styles.btn}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            data-open={moreOpen || undefined}
            onClick={() => setMoreOpen((o) => !o)}
            title={t.editor.more}
            aria-label={t.editor.more}
          >
            <DotsThreeOutline size={18} weight="duotone" />
          </button>
          {moreOpen && (
            <div className={styles.menu} role="menu" data-side="right">
              {/* wąski ekran: warstwy z wyspy trafiają tutaj */}
              {hasSite && (
                <MenuItem
                  narrow
                  icon={<GlobeHemisphereWest size={17} weight="duotone" />}
                  label={t.mapChooser.underlay}
                  extra={<span className={styles.check} data-on={underlay || undefined} aria-hidden />}
                  onClick={onUnderlay}
                />
              )}
              <MenuItem
                narrow
                icon={<Bed size={17} weight="duotone" />}
                label={t.editor.bedAreas}
                extra={<span className={styles.check} data-on={bedAreas || undefined} aria-hidden />}
                onClick={onBedAreas}
              />
              <MenuItem icon={<Translate size={17} weight="duotone" />} label={t.common.language} extra={<LangSwitch />} />
              <MenuItem
                icon={<Keyboard size={17} weight="duotone" />}
                label={t.editor.tabs.hotkeys}
                onClick={() => {
                  setMoreOpen(false);
                  onKeys();
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Piętra: najwyższe u góry, jak przyciski w windzie */}
      <nav className={styles.floors} aria-label={t.editor.floor}>
        <span className={styles.floorsIcon} aria-hidden>
          <Stack size={18} weight="duotone" />
        </span>
        <button className={styles.floorAdd} onClick={onAddFloor} title={t.editor.addFloor} aria-label={t.editor.addFloor}>
          <Plus size={13} weight="bold" />
        </button>
        <div className={styles.floorList}>
          {[...floors].reverse().map((lvl) => (
            <button
              key={lvl}
              data-on={floor === lvl || undefined}
              aria-current={floor === lvl || undefined}
              onClick={() => onFloor(lvl)}
              title={t.editor.floorLabel(lvl - floorBase)}
            >
              {floorLabel(lvl)}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
