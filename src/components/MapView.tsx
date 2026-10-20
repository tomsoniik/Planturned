"use client";

/*
  Mapa z gry (podgląd Map.png) ze spawnami, miejscem bazy i pozycją gracza w 3D.
  Współrzędne świata gry: x na wschód, z na północ, środek mapy w (0, 0); góra obrazu to północ.
*/
import { useEffect, useRef } from 'react';
import { mapOverviewUrl, type MapMeta, type Site } from '@/lib/terrain';
import { cameraPosition } from '@/lib/view3d';
import { useT } from './I18nProvider';
import styles from './MapPicker.module.css';

const toPct = (meta: MapMeta, x: number, z: number) => ({
  left: `${(x / meta.extent + 0.5) * 100}%`,
  top: `${(0.5 - z / meta.extent) * 100}%`,
});

/**
 * `live`: strzałka gracza odświeżana z kamery 3D (bez re-renderów Reacta).
 * `onPick`: klik w mapę (punkt świata); `onSpawn`: klik w spawn (indeks).
 */
export default function MapView({
  meta,
  site,
  live = false,
  onPick,
  onSpawn,
}: {
  meta: MapMeta;
  site?: Site;
  live?: boolean;
  onPick?: (x: number, z: number) => void;
  onSpawn?: (index: number) => void;
}) {
  const t = useT();
  const arrow = useRef<HTMLSpanElement>(null);
  const spawns = meta.noBuild?.spawns ?? [];

  useEffect(() => {
    if (!live) return;
    let frame = 0;
    const tick = () => {
      const el = arrow.current;
      const p = cameraPosition();
      if (el) {
        el.hidden = !p;
        if (p) {
          const pos = toPct(meta, p[0], p[2]);
          el.style.left = pos.left;
          el.style.top = pos.top;
          // kamera patrzy w (-sin yaw, -cos yaw) sceny; północ to -z sceny, więc obrót strzałki to -yaw
          el.style.transform = `translate(-50%, -50%) rotate(${-p[3]}rad)`;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live, meta]);

  return (
    <div
      className={styles.overview}
      data-pick={onPick ? true : undefined}
      onClick={(e) => {
        if (!onPick) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const u = (e.clientX - rect.left) / rect.width;
        const v = (e.clientY - rect.top) / rect.height;
        onPick((u - 0.5) * meta.extent, (0.5 - v) * meta.extent);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mapOverviewUrl(meta.id)} alt={t.map.mapAlt(meta.name)} draggable={false} />
      {spawns.map((sp, i) => (
        <button
          key={i}
          className={styles.spawn}
          style={toPct(meta, sp[0], sp[2])}
          title={t.map.spawn(i + 1)}
          aria-label={t.map.spawn(i + 1)}
          onClick={(e) => {
            if (!onSpawn) return;
            e.stopPropagation();
            onSpawn(i);
          }}
        />
      ))}
      {site && site.map === meta.id && <span className={styles.marker} style={toPct(meta, site.x, site.z)} title={t.hud.base} />}
      {live && <span ref={arrow} className={styles.player} title={t.hud.you} hidden />}
    </div>
  );
}
