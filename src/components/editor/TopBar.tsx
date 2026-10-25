"use client";

/*
  Górny pasek edytora: logo z menu aplikacji, menu Plik / Edycja / Widok / Pomoc, nazwa projektu ze stanem zapisu,
  na środku przełącznik Planner / Sandbox, po prawej cofnij, ponów, zapisz i eksport.
*/
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { ArrowClockwise, ArrowCounterClockwise, CaretDown, Check, DownloadSimple, FloppyDisk, X } from '@phosphor-icons/react';
import { useT } from '../I18nProvider';
import s from './EditorShell.module.css';

export type Mode = 'planner' | 'sandbox';

export type MenuEntry =
  | 'rule'
  /** Kreska widoczna tylko na telefonie. */
  | 'narrow'
  | {
      label: string;
      icon?: ReactNode;
      /** Skrót po prawej (Ctrl Z). */
      hint?: string;
      /** Pozycja z zaznaczeniem (przełącznik); undefined = zwykła akcja. */
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
      href?: string;
      /** Własna zawartość po prawej (np. przełącznik języka); wiersz nie jest wtedy przyciskiem. */
      extra?: ReactNode;
      /** Tylko na telefonie (menu Plik / Edycja / Widok / Pomoc chowa się wtedy w menu logo). */
      narrow?: boolean;
      onClick?: () => void;
    };

/** Zamyka menu po kliknięciu obok albo Esc (Esc nie trafia wtedy do skrótów edytora). */
export function useDismiss(open: boolean, close: () => void, ref: RefObject<HTMLElement | null>) {
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

/** Lista pozycji menu; klik w akcję zamyka menu. */
export function MenuList({ entries, onDone, align, up }: { entries: MenuEntry[]; onDone: () => void; align?: 'right'; up?: boolean }) {
  return (
    <div className={s.menu} role="menu" data-align={align} data-up={up || undefined}>
      {entries.map((e, i) => {
        if (e === 'rule') return <span key={`r${i}`} className={s.menuRule} aria-hidden />;
        if (e === 'narrow') return <span key={`n${i}`} className={s.menuRule} data-narrow aria-hidden />;
        const body = (
          <>
            <span className={s.menuIcon}>{e.icon}</span>
            <span className={s.menuLabel}>{e.label}</span>
            {e.extra}
            {e.hint && <span className={s.menuHint}>{e.hint}</span>}
            {e.checked !== undefined && <span className={s.menuCheck}>{e.checked && <Check size={14} weight="bold" />}</span>}
          </>
        );
        if (e.extra) {
          return (
            <div key={e.label} className={s.menuItem} data-static data-narrow={e.narrow || undefined}>
              {body}
            </div>
          );
        }
        if (e.href) {
          return (
            <Link key={e.label} href={e.href} role="menuitem" className={s.menuItem} data-narrow={e.narrow || undefined} onClick={onDone}>
              {body}
            </Link>
          );
        }
        return (
          <button
            key={e.label}
            role={e.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
            aria-checked={e.checked}
            className={s.menuItem}
            data-danger={e.danger || undefined}
            data-narrow={e.narrow || undefined}
            disabled={e.disabled}
            onClick={() => {
              onDone();
              e.onClick?.();
            }}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}

/** Przełącznik trybu: Planner (plan 2D) i Sandbox (świat 3D). */
export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const t = useT();
  return (
    <div className={s.mode} role="tablist" aria-label={t.editor.view}>
      {(['planner', 'sandbox'] as Mode[]).map((m) => (
        <button key={m} role="tab" aria-selected={mode === m} data-on={mode === m || undefined} onClick={() => mode !== m && onChange(m)}>
          {t.editor.modes[m]}
        </button>
      ))}
    </div>
  );
}

export interface TopMenus {
  file: MenuEntry[];
  edit: MenuEntry[];
  view: MenuEntry[];
  help: MenuEntry[];
}

export default function TopBar({
  appMenu,
  menus,
  name,
  saved,
  onRename,
  mode,
  onMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onExport,
}: {
  appMenu: MenuEntry[];
  menus: TopMenus;
  name: string;
  saved: boolean;
  onRename: (name: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExport: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState<'app' | keyof TopMenus | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const leftRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(null);
  useDismiss(open !== null, close, leftRef);

  const startRename = () => {
    setDraft(name);
    setEditing(true);
  };
  const finishRename = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== name) onRename(next);
  };

  return (
    <header className={s.top}>
      <div className={s.topLeft} ref={leftRef}>
        <div className={s.menuWrap}>
          <button
            className={s.logo}
            aria-label={t.shell.appMenu}
            aria-haspopup="menu"
            aria-expanded={open === 'app'}
            data-open={open === 'app' || undefined}
            onClick={() => setOpen(open === 'app' ? null : 'app')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/logo-mark.png" alt="" width={20} height={22} />
            <CaretDown size={11} weight="bold" />
          </button>
          {open === 'app' && (
            <MenuList
              // na telefonie pasek menu znika, więc jego pozycje lądują tutaj (oznaczone jako tylko wąskie)
              entries={[
                ...appMenu,
                ...(Object.keys(menus) as (keyof TopMenus)[]).flatMap((id): MenuEntry[] => [
                  'narrow',
                  ...menus[id].map((e): MenuEntry => (e === 'rule' || e === 'narrow' ? 'narrow' : { ...e, narrow: true })),
                ]),
              ]}
              onDone={close}
            />
          )}
        </div>
        <nav className={s.menubar} aria-label={t.shell.appMenu}>
          {(Object.keys(menus) as (keyof TopMenus)[]).map((id) => (
            <div key={id} className={s.menuWrap}>
              <button
                className={s.menuTrigger}
                aria-haspopup="menu"
                aria-expanded={open === id}
                data-open={open === id || undefined}
                onClick={() => setOpen(open === id ? null : id)}
                // jak w aplikacjach: przy otwartym menu najechanie przełącza na sąsiednie
                onPointerEnter={() => open !== null && open !== id && setOpen(id)}
              >
                {t.shell.menu[id]}
              </button>
              {open === id && <MenuList entries={menus[id]} onDone={close} />}
            </div>
          ))}
        </nav>
        <div className={s.title}>
          {editing ? (
            <input
              autoFocus
              className={s.nameInput}
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
            <button className={s.name} onClick={startRename} title={t.editor.rename}>
              {name || t.editor.loading}
            </button>
          )}
          <span className={s.saved} data-on={saved || undefined}>
            <span>{saved ? t.editor.saved : t.editor.autosave}</span>
          </span>
        </div>
      </div>

      <ModeSwitch mode={mode} onChange={onMode} />

      <div className={s.topRight}>
        <button className={s.iconBtn} onClick={onUndo} disabled={!canUndo} title={t.editor.undo} aria-label={t.editor.undo}>
          <ArrowCounterClockwise size={17} weight="bold" />
        </button>
        <button className={s.iconBtn} onClick={onRedo} disabled={!canRedo} title={t.editor.redo} aria-label={t.editor.redo}>
          <ArrowClockwise size={17} weight="bold" />
        </button>
        <span className={s.topRule} aria-hidden />
        <button className={s.ghostBtn} onClick={onSave} title={`${t.shell.save} (Ctrl S)`}>
          <FloppyDisk size={16} weight="bold" />
          <span>{t.shell.save}</span>
        </button>
        <button className={s.primaryBtn} onClick={onExport} title={t.editor.export}>
          <DownloadSimple size={16} weight="bold" />
          <span>{t.shell.exportShort}</span>
        </button>
      </div>
    </header>
  );
}

/** Okno dialogowe na całym ekranie (Pomoc, ustawienia). Esc i klik w tło zamykają. */
export function Dialog({ title, icon, onClose, children }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, ref);
  return (
    <div className={s.dialogBackdrop}>
      <section className={s.dialog} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className={s.dialogHead}>
          {icon}
          <h2>{title}</h2>
          <button className={s.iconBtn} onClick={onClose} aria-label={t.shell.close} title={t.shell.close}>
            <X size={17} weight="bold" />
          </button>
        </header>
        <div className={s.dialogBody}>{children}</div>
      </section>
    </div>
  );
}
