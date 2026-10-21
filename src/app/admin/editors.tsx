"use client";

import { useActionState, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowCounterClockwise, Plus, Trash } from '@phosphor-icons/react';
import type { Release } from '@/lib/changelog';
import { LINK_ICONS, type FooterLink, type LinkIcon, type Media, type Seo, type Text } from '@/lib/cms/schema';
import { saveContent, type SaveResult } from './actions';
import styles from './admin.module.css';

const ICON_LABELS: Record<LinkIcon, string> = {
  github: 'GitHub',
  steam: 'Steam',
  discord: 'Discord',
  youtube: 'YouTube',
  link: 'Link',
};

/** Przenosi element listy o jedno miejsce w górę (-1) albo w dół (+1). */
function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Sekcja panelu: formularz z kluczem CMS i danymi jako JSON w ukrytym polu.
 * Zapis i przywracanie domyślnych idą przez tę samą server action.
 */
function Section({ title, hint, cmsKey, data, children }: { title: string; hint: string; cmsKey: string; data: unknown; children: ReactNode }) {
  const [state, action, pending] = useActionState<SaveResult | null, FormData>(saveContent, null);
  return (
    <form action={action} className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
      </div>
      <input type="hidden" name="key" value={cmsKey} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />
      {children}
      <div className={styles.saveBar}>
        {state && (
          <p className={styles.status} data-ok={state.ok || undefined} role="status">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          name="mode"
          value="reset"
          className="btn btn-ghost"
          disabled={pending}
          onClick={(e) => {
            if (!window.confirm('Przywrócić domyślną treść tej sekcji? Zapisane zmiany znikną.')) e.preventDefault();
          }}
        >
          <ArrowCounterClockwise size={16} weight="bold" />
          Domyślne
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Zapisywanie' : 'Zapisz'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={styles.field} data-wide={wide || undefined}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Para pól PL / EN dla jednego tekstu. */
function TextPair({ label, value, onChange, multiline, max }: { label: string; value: Text; onChange: (v: Text) => void; multiline?: boolean; max?: number }) {
  return (
    <>
      {(['pl', 'en'] as const).map((l) => (
        <Field key={l} label={`${label} (${l.toUpperCase()})`}>
          {multiline ? (
            <textarea className="input" rows={2} maxLength={max} value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
          ) : (
            <input className="input" maxLength={max} value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
          )}
        </Field>
      ))}
    </>
  );
}

function RowTools({ onUp, onDown, onRemove, removeLabel }: { onUp: () => void; onDown: () => void; onRemove: () => void; removeLabel: string }) {
  return (
    <div className={styles.rowTools}>
      <button type="button" className="icon-btn" title="W górę" aria-label="W górę" onClick={onUp}>
        <ArrowUp size={16} weight="bold" />
      </button>
      <button type="button" className="icon-btn" title="W dół" aria-label="W dół" onClick={onDown}>
        <ArrowDown size={16} weight="bold" />
      </button>
      <button type="button" className="icon-btn danger" title={removeLabel} aria-label={removeLabel} onClick={onRemove}>
        <Trash size={16} weight="bold" />
      </button>
    </div>
  );
}

/* ---------- Changelog ---------- */

const emptyText = (): Text => ({ pl: '', en: '' });

/** Kolejna wersja: podbity ostatni numer (0.13.0 -> 0.13.1). */
function nextVersion(list: Release[]) {
  const [maj = 0, min = 0, patch = -1] = (list[0]?.version ?? '0.0.0').split('.').map(Number);
  return `${maj}.${min}.${patch + 1}`;
}

export function ChangelogEditor({ initial }: { initial: Release[] }) {
  const [releases, setReleases] = useState(initial);
  const [open, setOpen] = useState<string | null>(initial[0]?.version ?? null);

  const update = (i: number, patch: Partial<Release>) => setReleases((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const add = () => {
    const version = nextVersion(releases);
    setReleases((rs) => [{ version, date: new Date().toISOString().slice(0, 10), title: emptyText(), changes: [emptyText()] }, ...rs]);
    setOpen(version);
  };

  return (
    <Section title="Changelog" hint="Wersje od najnowszej. Każda ma tytuł i listę zmian po polsku i angielsku." cmsKey="changelog" data={releases}>
      <button type="button" className={`btn btn-ghost ${styles.addBtn}`} onClick={add}>
        <Plus size={16} weight="bold" />
        Nowa wersja
      </button>
      <ol className={styles.list}>
        {releases.map((r, i) => (
          <li key={i} className={styles.item} data-open={open === r.version || undefined}>
            <div className={styles.itemHead}>
              <button type="button" className={styles.itemToggle} onClick={() => setOpen(open === r.version ? null : r.version)}>
                <span className={styles.mono}>{r.version || 'bez numeru'}</span>
                <span>{r.title.pl || 'Bez tytułu'}</span>
                <span className={styles.muted}>{r.date}</span>
              </button>
              <RowTools
                onUp={() => setReleases((rs) => move(rs, i, -1))}
                onDown={() => setReleases((rs) => move(rs, i, 1))}
                onRemove={() => window.confirm(`Usunąć wersję ${r.version}?`) && setReleases((rs) => rs.filter((_, k) => k !== i))}
                removeLabel="Usuń wersję"
              />
            </div>
            {open === r.version && (
              <div className={styles.itemBody}>
                <div className={styles.grid}>
                  <Field label="Numer wersji">
                    <input className="input" value={r.version} maxLength={20} onChange={(e) => {
                      update(i, { version: e.target.value });
                      setOpen(e.target.value);
                    }} />
                  </Field>
                  <Field label="Data">
                    <input className="input" type="date" value={r.date} onChange={(e) => update(i, { date: e.target.value })} />
                  </Field>
                  <TextPair label="Tytuł" value={r.title} max={80} onChange={(title) => update(i, { title })} />
                </div>
                <h3 className={styles.subhead}>Zmiany</h3>
                <ol className={styles.changes}>
                  {r.changes.map((c, j) => (
                    <li key={j} className={styles.change}>
                      <div className={styles.grid}>
                        <TextPair label={`Zmiana ${j + 1}`} value={c} multiline max={600} onChange={(v) => update(i, { changes: r.changes.map((x, k) => (k === j ? v : x)) })} />
                      </div>
                      <RowTools
                        onUp={() => update(i, { changes: move(r.changes, j, -1) })}
                        onDown={() => update(i, { changes: move(r.changes, j, 1) })}
                        onRemove={() => update(i, { changes: r.changes.filter((_, k) => k !== j) })}
                        removeLabel="Usuń zmianę"
                      />
                    </li>
                  ))}
                </ol>
                <button type="button" className="btn btn-ghost" onClick={() => update(i, { changes: [...r.changes, emptyText()] })}>
                  <Plus size={16} weight="bold" />
                  Dodaj zmianę
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ---------- Tło i media ---------- */

/** Wkleisz cały link z YouTube albo samo ID: wyciągamy 11 znaków. */
function videoIdFrom(input: string) {
  const s = input.trim();
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : s;
}

export function MediaEditor({ initial }: { initial: Media }) {
  const [media, setMedia] = useState(initial);
  const set = (patch: Partial<Media>) => setMedia((m) => ({ ...m, ...patch }));
  const poster = media.poster || `https://i.ytimg.com/vi/${media.videoId}/hqdefault.jpg`;

  return (
    <Section title="Tło i media" hint="Film z YouTube w tle strony głównej, listy projektów i changeloga. Film zostaje na YouTube, strona go tylko osadza." cmsKey="media" data={media}>
      <div className={styles.mediaRow}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="Podgląd tła" className={styles.poster} />
        <div className={styles.grid}>
          <Field label="Film z YouTube (link albo ID)" wide>
            <input className="input" value={media.videoId} onChange={(e) => set({ videoId: videoIdFrom(e.target.value) })} />
          </Field>
          <Field label="Pętla od (sekunda)">
            <input className="input" type="number" min={0} value={media.start} onChange={(e) => set({ start: Number(e.target.value) })} />
          </Field>
          <Field label="Pętla do (sekunda, 0 = do końca)">
            <input className="input" type="number" min={0} value={media.end} onChange={(e) => set({ end: Number(e.target.value) })} />
          </Field>
          <Field label="Własny poster (adres obrazka, opcjonalnie)" wide>
            <input className="input" type="url" placeholder="https://..." value={media.poster} onChange={(e) => set({ poster: e.target.value })} />
          </Field>
          <label className={styles.check}>
            <input type="checkbox" checked={media.preview3d} onChange={(e) => set({ preview3d: e.target.checked })} />
            Obracana baza 3D na stronie głównej
          </label>
        </div>
      </div>
    </Section>
  );
}

/* ---------- Linki i SEO ---------- */

export function LinksEditor({ initial }: { initial: FooterLink[] }) {
  const [links, setLinks] = useState(initial);
  const update = (i: number, patch: Partial<FooterLink>) => setLinks((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  return (
    <Section title="Linki w stopce" hint="Pokazują się po stałych linkach (Moje projekty, Changelog). Otwierają się w nowej karcie." cmsKey="links" data={links}>
      <ol className={styles.list}>
        {links.map((l, i) => (
          <li key={i} className={`${styles.item} ${styles.linkItem}`}>
            <div className={styles.grid}>
              <TextPair label="Nazwa" value={l.label} max={40} onChange={(label) => update(i, { label })} />
              <Field label="Adres">
                <input className="input" type="url" placeholder="https://..." value={l.href} onChange={(e) => update(i, { href: e.target.value })} />
              </Field>
              <Field label="Ikona">
                <select className="input" value={l.icon} onChange={(e) => update(i, { icon: e.target.value as LinkIcon })}>
                  {LINK_ICONS.map((ic) => (
                    <option key={ic} value={ic}>{ICON_LABELS[ic]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <RowTools
              onUp={() => setLinks((ls) => move(ls, i, -1))}
              onDown={() => setLinks((ls) => move(ls, i, 1))}
              onRemove={() => setLinks((ls) => ls.filter((_, k) => k !== i))}
              removeLabel="Usuń link"
            />
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-ghost" onClick={() => setLinks((ls) => [...ls, { label: emptyText(), href: '', icon: 'link' }])}>
        <Plus size={16} weight="bold" />
        Dodaj link
      </button>
    </Section>
  );
}

export function SeoEditor({ initial }: { initial: Seo }) {
  const [seo, setSeo] = useState(initial);
  return (
    <Section title="SEO" hint="Tytuł karty i opis w Google oraz obrazek, który pokazuje się przy udostępnianiu linku." cmsKey="seo" data={seo}>
      <div className={styles.grid}>
        <TextPair label="Tytuł strony" value={seo.title} max={70} onChange={(title) => setSeo((s) => ({ ...s, title }))} />
        <TextPair label="Opis" value={seo.description} multiline max={200} onChange={(description) => setSeo((s) => ({ ...s, description }))} />
        <Field label="Obrazek do udostępniania (adres, najlepiej 1200x630)" wide>
          <input className="input" type="url" placeholder="https://..." value={seo.ogImage} onChange={(e) => setSeo((s) => ({ ...s, ogImage: e.target.value }))} />
        </Field>
      </div>
    </Section>
  );
}
