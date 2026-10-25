"use client";

/*
  Okno Materiały: ile surowców trzeba zebrać na cały projekt albo jedną bazę (suma przepisów z gry).
  W Plannerze zakładka okna klocków, w Sandboxie sekcja menu Esc. Lista od największej ilości,
  przycisk kopiuje ją jako tekst do wklejenia ekipie na Discordzie.
*/
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { computeMaterials, type PlacedItem } from '@/lib/builder';
import { loadProps, usePropsStore } from '@/lib/props';
import { loadResources, resourceIcon, resourceName, useResources } from '@/lib/resources';
import { useBases } from './BasesPanel';
import ItemIcon from './ItemIcon';
import { useT } from './I18nProvider';
import styles from './MaterialsPanel.module.css';

export default function MaterialsPanel({ items, projectName }: { items: PlacedItem[]; projectName: string }) {
  const t = useT();
  const bases = useBases(items);
  const names = useResources((s) => s.names);
  // rekwizyty muszą być zarejestrowane, zanim policzymy ich przepisy
  const propsReady = usePropsStore((s) => s.ready);
  const [scope, setScope] = useState(-1);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    loadResources();
    loadProps();
  }, []);

  const chosen = scope >= 0 && bases[scope] ? bases[scope].items : items;
  const { rows, loot } = useMemo(() => {
    void propsReady;
    const { totals, loot } = computeMaterials(chosen);
    const rows = Object.entries(totals)
      .map(([id, qty]) => ({ id, qty, name: resourceName(id, t.lang, names) }))
      .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, t.lang));
    return { rows, loot };
  }, [chosen, names, t.lang, propsReady]);

  const label = scope >= 0 && bases[scope] ? t.bases.name(scope + 1) : t.materialsPanel.whole;

  const copy = async () => {
    const text = [
      t.materialsPanel.copyTitle(projectName, label),
      ...rows.map((r) => `${r.qty} x ${r.name}`),
      ...(loot ? [t.materialsPanel.loot(loot)] : []),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // brak dostępu do schowka (np. strona w ramce): nic nie robimy, lista jest widoczna obok
    }
  };

  if (items.length === 0) return <p className={styles.hint}>{t.materialsPanel.empty}</p>;

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <label className={styles.scope}>
          <span>{t.materialsPanel.scope}</span>
          <select value={scope} onChange={(e) => setScope(Number(e.target.value))}>
            <option value={-1}>{t.materialsPanel.whole}</option>
            {bases.map((b, i) => (
              <option key={b.items[0].id} value={i}>
                {t.bases.name(i + 1)} ({t.projects.elements(b.items.length)})
              </option>
            ))}
          </select>
        </label>
        <button className={styles.copy} onClick={copy} disabled={rows.length === 0}>
          {copied ? <Check size={15} weight="bold" /> : <Copy size={15} weight="bold" />}
          {copied ? t.materialsPanel.copied : t.materialsPanel.copy}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className={styles.hint}>{t.materialsPanel.none}</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((r) => (
            <li key={r.id} className={styles.row}>
              <ItemIcon src={resourceIcon(r.id)} name={r.name} size={32} />
              <span className={styles.name}>{r.name}</span>
              <span className={styles.qty}>{r.qty}</span>
            </li>
          ))}
        </ul>
      )}
      {loot > 0 && <p className={styles.hint}>{t.materialsPanel.loot(loot)}</p>}
      <p className={styles.hint}>{t.materialsPanel.note}</p>
    </div>
  );
}
