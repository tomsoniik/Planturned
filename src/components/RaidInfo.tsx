"use client";

/*
  Kalkulator raidu przy elemencie: nazwa, HP i ile sztuk każdego ładunku go niszczy.
  W Sandboxie pod celownikiem (element, na który patrzysz), w Plannerze przy jednym zaznaczonym elemencie.
*/
import { useEffect } from 'react';
import type { BuildItem } from '@/lib/builder';
import { itemFullLabel } from '@/lib/i18n';
import { iconUrl } from '@/lib/builder';
import { loadExplosives, raidCost, useExplosives } from '@/lib/raid';
import ItemIcon from './ItemIcon';
import { useT } from './I18nProvider';
import styles from './RaidInfo.module.css';

export default function RaidInfo({ def, className }: { def: BuildItem; className?: string }) {
  const t = useT();
  const list = useExplosives((s) => s.list);
  useEffect(() => {
    loadExplosives();
  }, []);
  const cost = raidCost(def, list);
  if (!def.health || cost.length === 0) return null;
  return (
    <div className={`${styles.raid} ${className ?? ''}`} data-ui>
      <strong>{itemFullLabel(def, t)}</strong>
      <span className={styles.hp}>{t.raid.hp(def.health)}</span>
      <span className={styles.rule} aria-hidden />
      <span className={styles.title}>{t.raid.title}</span>
      <ul className={styles.list}>
        {cost.map((c) => (
          <li key={c.id} title={`${c.count} x ${t.raid.names[c.id] ?? c.id}`}>
            <ItemIcon src={iconUrl(c.id)} name={t.raid.names[c.id] ?? String(c.id)} size={22} eager />
            <span>{c.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
