"use client";

import { useEffect, useState } from 'react';
import { loadMap, loadMapIndex, mapOverviewUrl, type MapData, type MapInfo, type Site } from '@/lib/terrain';
import { useT } from './I18nProvider';
import styles from './MapPicker.module.css';

const round = (v: number, step: number) => Math.round(v / step) * step;

interface Props {
  site?: Site;
  onChange: (site: Site | undefined) => void;
  showUnderlay: boolean;
  onToggleUnderlay: () => void;
}

/** Wybór mapy z gry i miejsca bazy (wycinek terenu pod plan 2D i scenę 3D). */
export default function MapPicker({ site, onChange, showUnderlay, onToggleUnderlay }: Props) {
  const t = useT();
  const [maps, setMaps] = useState<MapInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(site?.map ?? null);
  const [data, setData] = useState<MapData | null>(null);

  useEffect(() => {
    loadMapIndex().then(setMaps);
  }, []);

  const current = selected ?? site?.map ?? null;
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

  const placeAt = (x: number, z: number) => {
    if (!current || !data) return;
    onChange({ map: current, x: round(x, 1), z: round(z, 1), elevation: round(data.heightAt(x, z), 0.25) });
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!meta) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const u = (e.clientX - rect.left) / rect.width;
    const v = (e.clientY - rect.top) / rect.height;
    placeAt((u - 0.5) * meta.extent, (0.5 - v) * meta.extent);
  };

  const marker = site && meta && site.map === meta.id
    ? { left: `${(site.x / meta.extent + 0.5) * 100}%`, top: `${(0.5 - site.z / meta.extent) * 100}%` }
    : null;
  const ground = site && data && site.map === data.meta.id ? data.heightAt(site.x, site.z) : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.maps} role="group" aria-label={t.map.mapGroup}>
        {maps.map((m) => (
          <button key={m.id} data-on={current === m.id || undefined} onClick={() => setSelected(m.id)}>
            {m.name}
            <span>{(m.size / 1024).toFixed(m.size < 1024 ? 1 : 0)} km</span>
          </button>
        ))}
      </div>

      {current && (
        <>
          <p className={styles.hint}>{t.map.pickHint}</p>
          <div className={styles.overview} onClick={handleClick} role="button" aria-label={t.map.pickAria}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mapOverviewUrl(current)} alt={t.map.mapAlt(current)} draggable={false} />
            {marker && <span className={styles.marker} style={marker} />}
          </div>
        </>
      )}

      {site && (
        <div className={styles.fields}>
          <label>
            {t.map.east}
            <input
              className="input"
              type="number"
              value={site.x}
              onChange={(e) => onChange({ ...site, x: Number(e.target.value) })}
            />
          </label>
          <label>
            {t.map.north}
            <input
              className="input"
              type="number"
              value={site.z}
              onChange={(e) => onChange({ ...site, z: Number(e.target.value) })}
            />
          </label>
          <label className={styles.full}>
            {t.map.elevation}
            <input
              className="input"
              type="number"
              step={0.25}
              value={site.elevation}
              onChange={(e) => onChange({ ...site, elevation: Number(e.target.value) })}
            />
          </label>
          {ground !== null && (
            <p className={styles.hint}>
              {t.map.terrainHere(ground.toFixed(1))}
              {data?.meta.seaLevel != null && t.map.water(data.meta.seaLevel.toFixed(1))}
            </p>
          )}
          <div className={styles.actions}>
            <button className="btn btn-ghost" onClick={() => placeAt(site.x, site.z)}>{t.map.toTerrain}</button>
            <button className="btn btn-ghost" onClick={() => onChange(undefined)}>{t.map.noMap}</button>
          </div>
          <label className={styles.toggle}>
            <input type="checkbox" checked={showUnderlay} onChange={onToggleUnderlay} />
            {t.map.underlay}
          </label>
        </div>
      )}
    </div>
  );
}
