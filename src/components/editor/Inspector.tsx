"use client";

/*
  Inspektor po prawej: zakładki Właściwości / Budowle / Materiały i klocki, z których strona edytora składa
  właściwości zaznaczenia, trzymanego elementu albo projektu (nagłówek, akcje, sekcje, pola, paleta, raid).
*/
import { useEffect, useRef, type ReactNode } from 'react';
import { Bomb, Plus } from '@phosphor-icons/react';
import { iconUrl, type BuildItem } from '@/lib/builder';
import { loadExplosives, raidCost, useExplosives } from '@/lib/raid';
import ItemIcon from '../ItemIcon';
import { useT } from '../I18nProvider';
import s from './EditorShell.module.css';

export type InspectorTab = 'props' | 'bases' | 'materials';

export function Inspector({
  tab,
  onTab,
  children,
  footer,
}: {
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useT();
  return (
    <aside className={s.inspector} aria-label={t.shell.inspector}>
      <div className={s.tabs} role="tablist">
        {(['props', 'bases', 'materials'] as InspectorTab[]).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} data-on={tab === id || undefined} onClick={() => onTab(id)}>
            {t.shell.tabs[id]}
          </button>
        ))}
      </div>
      <div className={s.inspectorBody} role="tabpanel">
        {children}
      </div>
      {footer && <div className={s.inspectorFoot}>{footer}</div>}
    </aside>
  );
}

/** Nagłówek obiektu: ikona przedmiotu albo glif, nazwa i podpis. */
export function ObjHead({ def, glyph, title, sub }: { def?: BuildItem; glyph?: ReactNode; title: string; sub?: ReactNode }) {
  return (
    <div className={s.objHead}>
      {def ? <ItemIcon src={def.icon} name={title} size={36} eager /> : <span className={s.objGlyph}>{glyph}</span>}
      <div>
        <strong title={title}>{title}</strong>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

export interface ActionDef {
  id: string;
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onClick: () => void;
}

export function Actions({ items }: { items: ActionDef[] }) {
  return (
    <div className={s.actions}>
      {items.map((a) => (
        <button key={a.id} className={s.action} data-danger={a.danger || undefined} onClick={a.onClick} title={a.label}>
          {a.icon}
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Section({ icon, title, tool, children }: { icon: ReactNode; title: string; tool?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.section}>
      <header className={s.sectionHead}>
        <span className={s.sectionIcon}>{icon}</span>
        <h3>{title}</h3>
        {tool}
      </header>
      {children}
    </section>
  );
}

/** Przycisk w nagłówku sekcji (np. przywróć kolor). */
export function SectionTool({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button className={s.sectionTool} onClick={onClick} aria-label={label} title={label}>
      {icon}
    </button>
  );
}

export function Fields({ children }: { children: ReactNode }) {
  return <div className={s.fields}>{children}</div>;
}

/** Pole z etykietą w środku ("X 4.5 m"): wartość tylko do odczytu, bo elementy trzymają się siatki i snapowania. */
export function Field({ label, value, unit, wide, lead }: { label: string; value: ReactNode; unit?: string; wide?: boolean; lead?: ReactNode }) {
  return (
    <div className={s.field} data-wide={wide || undefined}>
      {lead}
      <span>{label}</span>
      <output>{value}</output>
      {unit && <em>{unit}</em>}
    </div>
  );
}

export function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className={s.row}>
      <span>{label}</span>
      <input type="checkbox" role="switch" className={s.switch} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={s.seg} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} data-on={value === o.id || undefined} onClick={() => onChange(o.id)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Paleta kolorów malowania: gotowe kolory, własny (natywny wybór koloru) i opcjonalne przyciski tekstowe.
 * Własny kolor trafia dopiero po zamknięciu okna wyboru (zdarzenie change), żeby nie zapisywać historii przy każdym ruchu.
 */
export function Palette({
  colors,
  value,
  onPick,
  extra,
}: {
  colors: string[];
  value: string;
  onPick: (color: string) => void;
  extra?: { id: string; label: string; on: boolean; onClick: () => void }[];
}) {
  const t = useT();
  const customRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  });
  useEffect(() => {
    const el = customRef.current;
    if (!el) return;
    const onChange = () => pickRef.current(el.value);
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);
  return (
    <div className={s.palette}>
      {extra?.map((x) => (
        <button key={x.id} className={s.paletteText} data-on={x.on || undefined} onClick={x.onClick}>
          {x.label}
        </button>
      ))}
      {colors.map((c) => (
        <button
          key={c}
          className={s.paletteSwatch}
          data-on={value.toLowerCase() === c.toLowerCase() || undefined}
          style={{ background: c }}
          onClick={() => onPick(c)}
          aria-label={t.editor.colorAria(c)}
        />
      ))}
      <label className={s.paletteCustom} title={t.editor.colorCustom}>
        <Plus size={12} weight="bold" />
        <input ref={customRef} type="color" defaultValue={value.startsWith('#') ? value : '#8dc46f'} aria-label={t.editor.colorCustom} />
      </label>
    </div>
  );
}

/** Sekcja Raid: HP elementu i ile sztuk każdego ładunku go niszczy (dane z eksportu gry). */
export function RaidSection({ def }: { def: BuildItem }) {
  const t = useT();
  const list = useExplosives((st) => st.list);
  useEffect(() => {
    loadExplosives();
  }, []);
  if (!def.health) return null;
  const cost = raidCost(def, list);
  return (
    <Section icon={<Bomb size={15} weight="duotone" />} title={t.shell.raid}>
      <Fields>
        <Field label={t.shell.hp} value={def.health} wide />
      </Fields>
      {cost.length > 0 && (
        <>
          <p className={s.note}>{t.raid.title}</p>
          <ul className={s.raidList}>
            {cost.map((c) => (
              <li key={c.id} title={t.raid.names[c.id] ?? String(c.id)}>
                <ItemIcon src={iconUrl(c.id)} name={t.raid.names[c.id] ?? String(c.id)} size={22} eager />
                {c.count}
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

/** Wąski kontener na istniejące panele (budowle, materiały) w zakładkach inspektora. */
export function PanelSlot({ children }: { children: ReactNode }) {
  return <div className={s.panelSlot}>{children}</div>;
}
