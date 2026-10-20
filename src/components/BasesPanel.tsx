"use client";

/*
  Lista baz w projekcie: każda grupa połączonych elementów to osobna baza (baseGroups).
  W 2D: pokaż (przybliż i zaznacz), usuń. W 3D (menu Esc): przenieś, teleportuj, usuń.
*/
import { useMemo } from 'react';
import { ArrowsOutCardinal, Crosshair, MagnifyingGlassPlus, Trash } from '@phosphor-icons/react';
import { LEVEL_HEIGHT, UNITS_PER_METER, baseGroups, type PlacedItem } from '@/lib/builder';
import type { MapData, Site } from '@/lib/terrain';
import { useT } from './I18nProvider';
import styles from './BasesPanel.module.css';

export interface BaseInfo {
  items: PlacedItem[];
  /** Środek w układzie planu. */
  cx: number;
  cy: number;
  /** Najniższy poziom bazy. */
  floor: number;
}

export function useBases(items: PlacedItem[]): BaseInfo[] {
  return useMemo(
    () =>
      baseGroups(items).map((g) => {
        const xs = g.map((i) => i.x), ys = g.map((i) => i.y);
        return {
          items: g,
          cx: (Math.min(...xs) + Math.max(...xs)) / 2,
          cy: (Math.min(...ys) + Math.max(...ys)) / 2,
          floor: Math.min(...g.map((i) => i.floor || 0)),
        };
      }),
    [items],
  );
}

/** Punkt bazy w układzie świata gry (x, z) i wysokość jej spodu. */
export function baseWorld(b: BaseInfo, site: Site) {
  return {
    x: site.x + b.cx / UNITS_PER_METER,
    z: site.z - b.cy / UNITS_PER_METER,
    y: site.elevation + b.floor * LEVEL_HEIGHT,
  };
}

export default function BasesPanel({
  items,
  site,
  map,
  hint,
  onShow,
  onMove,
  onTeleport,
  onDelete,
}: {
  items: PlacedItem[];
  site?: Site;
  map?: MapData | null;
  hint: string;
  onShow?: (b: BaseInfo) => void;
  onMove?: (b: BaseInfo) => void;
  onTeleport?: (b: BaseInfo) => void;
  onDelete: (b: BaseInfo) => void;
}) {
  const t = useT();
  const bases = useBases(items);

  if (bases.length === 0) return <p className={styles.hint}>{t.bases.empty}</p>;

  const height = (b: BaseInfo) => {
    if (!site || !map || map.meta.id !== site.map) return null;
    const w = baseWorld(b, site);
    return w.y - map.heightAt(w.x, w.z);
  };

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>{hint}</p>
      <ul className={styles.list}>
        {bases.map((b, i) => {
          const h = height(b);
          return (
            <li key={b.items[0].id} className={styles.row}>
              <div className={styles.info}>
                <strong>{t.bases.name(i + 1)}</strong>
                <span>
                  {t.projects.elements(b.items.length)}
                  {h !== null && `, ${h < 1.5 ? t.bases.ground : t.bases.above(h.toFixed(0))}`}
                </span>
              </div>
              <div className={styles.actions}>
                {onShow && (
                  <button className="icon-btn" onClick={() => onShow(b)} title={t.bases.show} aria-label={t.bases.show}>
                    <MagnifyingGlassPlus size={16} weight="bold" />
                  </button>
                )}
                {onMove && (
                  <button className="icon-btn" onClick={() => onMove(b)} title={t.bases.move} aria-label={t.bases.move}>
                    <ArrowsOutCardinal size={16} weight="bold" />
                  </button>
                )}
                {onTeleport && (
                  <button className="icon-btn" onClick={() => onTeleport(b)} title={t.bases.teleport} aria-label={t.bases.teleport}>
                    <Crosshair size={16} weight="bold" />
                  </button>
                )}
                <button className="icon-btn danger" onClick={() => onDelete(b)} title={t.bases.remove} aria-label={t.bases.remove}>
                  <Trash size={16} weight="bold" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
