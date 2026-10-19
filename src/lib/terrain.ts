/*
  Teren map Unturned wyeksportowany z gry (public/maps, npm run export:game).

  Współrzędne świata gry: x na wschód, z na północ, metry, środek mapy w (0,0).
  Map.png pokrywa kwadrat o boku `extent` wyśrodkowany w (0,0); wiersz 0 obrazu to północ.
*/

export interface MapInfo {
  id: string;
  name: string;
  size: number;
  extent: number;
}

export interface MapMeta extends MapInfo {
  grid: number;
  cell: number;
  heightMin: number;
  heightMax: number;
  seaLevel: number | null;
  tiles: number;
  /** Twardy limit budowania (wysokość świata, m). Brak w starszym eksporcie: 1024. */
  heightLimit?: number;
  /** Czy mapa ogranicza tlen na wysokości (Use_Legacy_Oxygen_Height). */
  oxygen?: boolean;
  /** Wysokość świata, powyżej której spada tlen. */
  oxygenLine?: number | null;
  /** Strefy zakazu budowy (PlayerClipVolume): pozycja, obrót (kwaternion Unity), skala. */
  clipVolumes?: { p: number[]; r: number[]; s: number[] }[];
  /** Tekstury terenu z gry: warstwy (tekstura 64 px, co ile metrów się powtarza) i liczba plików wag splat_N.png. */
  terrain?: { layers: { tex: string; size: number }[]; splats: number } | null;
  /** Czy jest roads.json (drogi z Paths.dat). */
  roads?: boolean;
  /** Strefy bez budowania: safezone (kula/prostopadłościan/walec, skala = rozmiar), spawny graczy i ich promień, zakaz budowy pod terenem. */
  noBuild?: {
    safezones: { shape: string; p: number[]; r: number[]; s: number[] }[];
    spawns: number[][];
    spawnRadius: number;
    undergroundBlocked: boolean;
  };
}

export interface MapData {
  meta: MapMeta;
  heights: Float32Array;
  /** Wysokość terenu w metrach (interpolacja dwuliniowa). */
  heightAt: (wx: number, wz: number) => number;
}

/** Miejsce bazy na mapie: punkt (0,0) planu leży w (x, z) świata, podłogi parteru na wysokości `elevation`. */
export interface Site {
  map: string;
  x: number;
  z: number;
  elevation: number;
}

const base = (id: string) => `/maps/${encodeURIComponent(id)}`;

export const mapOverviewUrl = (id: string) => `${base(id)}/overview.jpg`;
export const mapTileUrl = (id: string, tx: number, ty: number) => `${base(id)}/tiles/${tx}_${ty}.jpg`;

let indexPromise: Promise<MapInfo[]> | null = null;

export function loadMapIndex(): Promise<MapInfo[]> {
  if (!indexPromise) {
    indexPromise = fetch('/maps/index.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return indexPromise;
}

const cache = new Map<string, Promise<MapData>>();

export function loadMap(id: string): Promise<MapData> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const meta: MapMeta = await (await fetch(`${base(id)}/meta.json`)).json();
      const buf = await (await fetch(`${base(id)}/height.bin`)).arrayBuffer();
      const raw = new Uint16Array(buf);
      const range = meta.heightMax - meta.heightMin;
      const heights = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) heights[i] = meta.heightMin + (raw[i] / 65535) * range;

      const n = meta.grid;
      const half = meta.extent / 2;
      const heightAt = (wx: number, wz: number) => {
        const c = Math.min(Math.max((wx + half) / meta.cell, 0), n - 1.001);
        const r = Math.min(Math.max((half - wz) / meta.cell, 0), n - 1.001);
        const c0 = Math.floor(c), r0 = Math.floor(r);
        const fc = c - c0, fr = r - r0;
        const h00 = heights[r0 * n + c0], h01 = heights[r0 * n + c0 + 1];
        const h10 = heights[(r0 + 1) * n + c0], h11 = heights[(r0 + 1) * n + c0 + 1];
        return (h00 * (1 - fc) + h01 * fc) * (1 - fr) + (h10 * (1 - fc) + h11 * fc) * fr;
      };
      return { meta, heights, heightAt };
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Kafle satelity przecinające kwadrat [x±r, z±r] świata. */
export function tilesInRange(meta: MapMeta, x: number, z: number, r: number) {
  const tw = meta.extent / meta.tiles;
  const half = meta.extent / 2;
  const out: { tx: number; ty: number; left: number; top: number; size: number }[] = [];
  for (let ty = 0; ty < meta.tiles; ty++) {
    for (let tx = 0; tx < meta.tiles; tx++) {
      const left = -half + tx * tw; // zachodnia krawędź (x)
      const top = half - ty * tw; // północna krawędź (z)
      if (left + tw < x - r || left > x + r || top < z - r || top - tw > z + r) continue;
      out.push({ tx, ty, left, top, size: tw });
    }
  }
  return out;
}
