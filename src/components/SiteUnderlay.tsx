"use client";

import { useEffect, useState } from 'react';
import { UNITS_PER_METER } from '@/lib/builder';
import { loadMap, mapTileUrl, tilesInRange, type MapMeta, type Site } from '@/lib/terrain';

/** Satelita z gry pod planem 2D (w jednostkach planu, północ u góry). */
export default function SiteUnderlay({ site }: { site: Site }) {
  const [meta, setMeta] = useState<MapMeta | null>(null);

  useEffect(() => {
    let alive = true;
    loadMap(site.map).then((d) => alive && setMeta(d.meta)).catch(() => alive && setMeta(null));
    return () => {
      alive = false;
    };
  }, [site.map]);

  if (!meta || meta.id !== site.map) return null;

  return (
    <>
      {tilesInRange(meta, site.x, site.z, 700).map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${t.tx}_${t.ty}`}
          src={mapTileUrl(meta.id, t.tx, t.ty)}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: (t.left - site.x) * UNITS_PER_METER,
            top: (site.z - t.top) * UNITS_PER_METER,
            width: t.size * UNITS_PER_METER,
            height: t.size * UNITS_PER_METER,
            maxWidth: 'none',
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: 0.9,
            zIndex: 0,
          }}
        />
      ))}
    </>
  );
}
