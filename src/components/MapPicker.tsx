"use client";

import { useEffect, useState } from 'react';
import { loadMap, loadMapIndex, type MapData, type MapInfo, type Site } from '@/lib/terrain';
import { useT } from './I18nProvider';
import MapView from './MapView';
import styles from './MapPicker.module.css';

interface Props {
  site?: Site;
  onChange: (site: Site | undefined) => void;
  showUnderlay: boolean;
  onToggleUnderlay: () => void;
  /** Widok 3D: klik w spawn albo mapę teleportuje zamiast przenosić punkt startu, na mapie widać gracza. */
  onTeleport?: (x: number, z: number) => void;
}

/** Punkt startu projektu na spawnie z gry (teren pod nim to poziom 0 bazy). */
export function siteAtSpawn(data: MapData, index: number): Site {
  const spawns = data.meta.noBuild?.spawns ?? [];
  const sp = spawns[index] ?? [0, 0, 0];
  const x = Math.round(sp[0] * 10) / 10, z = Math.round(sp[2] * 10) / 10;
  return { map: data.meta.id, x, z, elevation: Math.round(data.heightAt(x, z) * 4) / 4 };
}

/** Wybór mapy z gry. Start na spawnie z gry; inny spawn przenosi punkt startu (w 3D: teleport). */
export default function MapPicker({ site, onChange, showUnderlay, onToggleUnderlay, onTeleport }: Props) {
  const t = useT();
  const [maps, setMaps] = useState<MapInfo[] | null>(null);
  const [data, setData] = useState<MapData | null>(null);

  useEffect(() => {
    loadMapIndex().then(setMaps);
  }, []);

  const current = site?.map ?? null;
  useEffect(() => {
    if (!current) return;
    let alive = true;
    loadMap(current).then((d) => alive && setData(d)).catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [current]);

  if (maps === null) return <p className={styles.hint}>{t.map.loadingList}</p>;

  if (maps.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{t.map.noMaps}</p>
        <code>npm run export:game</code>
        <p className={styles.hint}>{t.map.noMapsHint}</p>
      </div>
    );
  }

  const meta = data && data.meta.id === current ? data.meta : null;

  // nowa mapa: start na pierwszym spawnie z gry
  const pickMap = (id: string) => {
    if (id === current) return;
    loadMap(id).then((d) => onChange(siteAtSpawn(d, 0)));
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.maps} role="group" aria-label={t.map.mapGroup}>
        {maps.map((m) => (
          <button key={m.id} data-on={current === m.id || undefined} onClick={() => pickMap(m.id)}>
            {m.name}
            <span>{(m.size / 1024).toFixed(m.size < 1024 ? 1 : 0)} km</span>
          </button>
        ))}
      </div>

      {meta && data && site && (
        <>
          <p className={styles.hint}>{onTeleport ? t.hud.mapHint : t.map.spawnHint}</p>
          <MapView
            meta={meta}
            site={site}
            live={!!onTeleport}
            onPick={onTeleport}
            onSpawn={(i) => {
              const sp = meta.noBuild?.spawns[i];
              if (onTeleport && sp) onTeleport(sp[0], sp[2]);
              else if (!onTeleport) onChange(siteAtSpawn(data, i));
            }}
          />
          <div className={styles.fields}>
            <p className={styles.hint}>
              {t.map.startAt(site.x.toFixed(0), site.z.toFixed(0), site.elevation.toFixed(1))}
              {meta.seaLevel != null && t.map.water(meta.seaLevel.toFixed(1))}
            </p>
            <div className={styles.actions}>
              <button className="btn btn-ghost" onClick={() => onChange(undefined)}>{t.map.noMap}</button>
            </div>
            {!onTeleport && (
              <label className={styles.toggle}>
                <input type="checkbox" checked={showUnderlay} onChange={onToggleUnderlay} />
                {t.map.underlay}
              </label>
            )}
          </div>
        </>
      )}
    </div>
  );
}
