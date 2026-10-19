"use client";

/*
  Podłoże jak w Unturned: tekstury terenu mieszane według splatmap i drogi z Paths.dat.
  Dane eksportuje scripts/export_game_data.py (meta.terrain, splat_N.png, roads.json).

  Teren (LandscapeTile / LandscapeMaterialAsset): każda warstwa to tekstura 64 px powtarzana co
  szerokość_px * 0.25 m w układzie świata; wagi warstw co 4 m. Mieszanie robi shader MeshStandardMaterial,
  więc światło, cienie i mgła działają jak dla reszty sceny.

  Drogi (Road.buildMesh): próbka co 5 m po krzywej Béziera, wysokość z terenu podniesiona, gdy krawędź
  wchodzi w zbocze, przekrój z 4 punktów (płaska jezdnia + skośne pobocza), U na szerokość, V wzdłuż drogi.
*/
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { MapData, MapMeta, Site } from '@/lib/terrain';

const mapBase = (id: string) => `/maps/${encodeURIComponent(id)}`;

// --- Teren ---

/** Obraz bez mnożenia przez alfę: kanał A splatmapy to waga warstwy, nie przezroczystość. */
async function loadRawBitmap(url: string) {
  const blob = await (await fetch(url)).blob();
  return createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}

async function loadImage(url: string) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

const LAYER_PX = 64;

interface GroundTextures {
  splats: THREE.Texture[];
  layers: THREE.DataArrayTexture;
  sizes: number[];
}

const groundCache = new Map<string, Promise<GroundTextures | null>>();

function loadGround(meta: MapMeta): Promise<GroundTextures | null> {
  const info = meta.terrain;
  if (!info) return Promise.resolve(null);
  let p = groundCache.get(meta.id);
  if (!p) {
    p = (async () => {
      const splats = await Promise.all(
        Array.from({ length: info.splats }, async (_, i) => {
          const tex = new THREE.Texture(await loadRawBitmap(`${mapBase(meta.id)}/splat_${i}.png`));
          tex.flipY = false; // wiersz 0 = północ, v = 0
          tex.colorSpace = THREE.NoColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.needsUpdate = true;
          return tex;
        }),
      );
      // Warstwy w jednej tablicy tekstur (jedna jednostka tekstur zamiast 8-12)
      const imgs = await Promise.all(info.layers.map((l) => loadImage(`/game/terrain/${l.tex}.png`)));
      const data = new Uint8Array(LAYER_PX * LAYER_PX * 4 * imgs.length);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = LAYER_PX;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      imgs.forEach((img, i) => {
        ctx.clearRect(0, 0, LAYER_PX, LAYER_PX);
        ctx.drawImage(img, 0, 0, LAYER_PX, LAYER_PX);
        data.set(ctx.getImageData(0, 0, LAYER_PX, LAYER_PX).data, i * LAYER_PX * LAYER_PX * 4);
      });
      const layers = new THREE.DataArrayTexture(data, LAYER_PX, LAYER_PX, imgs.length);
      layers.colorSpace = THREE.SRGBColorSpace;
      layers.wrapS = layers.wrapT = THREE.RepeatWrapping;
      layers.minFilter = THREE.LinearMipmapLinearFilter;
      layers.magFilter = THREE.LinearFilter;
      layers.generateMipmaps = true;
      layers.anisotropy = 8;
      layers.needsUpdate = true;
      return { splats, layers, sizes: info.layers.map((l) => l.size) };
    })().catch(() => null);
    groundCache.set(meta.id, p);
  }
  return p;
}

/**
 * Materiał terenu z teksturami gry. Siatki terenu leżą w układzie sceny (x = świat x - site.x, z = site.z - świat z),
 * więc shader odtwarza współrzędne świata z uOrigin. Null, gdy brak danych (stary eksport): wtedy zostaje satelita.
 */
export function useGroundMaterial(map: MapData, site: Site): THREE.MeshStandardMaterial | null {
  const [tex, setTex] = useState<GroundTextures | null>(null);
  useEffect(() => {
    let alive = true;
    loadGround(map.meta).then((t) => alive && setTex(t));
    return () => {
      alive = false;
    };
  }, [map.meta]);

  const material = useMemo(() => {
    if (!tex) return null;
    const n = tex.sizes.length;
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uOrigin = { value: new THREE.Vector2(site.x, site.z) };
      shader.uniforms.uHalf = { value: map.meta.extent / 2 };
      shader.uniforms.uExtent = { value: map.meta.extent };
      shader.uniforms.uLayers = { value: tex.layers };
      shader.uniforms.uSizes = { value: tex.sizes };
      tex.splats.forEach((s, i) => (shader.uniforms[`uSplat${i}`] = { value: s }));
      m.userData.shader = shader;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec2 uOrigin;\nvarying vec2 vGameXZ;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvec4 groundWorld = modelMatrix * vec4(transformed, 1.0);\nvGameXZ = vec2(groundWorld.x + uOrigin.x, uOrigin.y - groundWorld.z);',
        );

      // Mieszanie warstw: suma wag * tekstura warstwy, znormalizowana (jak alphamapy terenu Unity)
      const splatDecl = tex.splats.map((_, i) => `uniform sampler2D uSplat${i};`).join('\n');
      const weights = tex.splats.map((_, i) => `vec4 w${i} = texture2D(uSplat${i}, suv);`).join('\n');
      const comps = ['x', 'y', 'z', 'w'];
      const blend = Array.from({ length: n }, (_, i) => {
        const w = `w${Math.floor(i / 4)}.${comps[i % 4]}`;
        return `col += ${w} * texture(uLayers, vec3(vGameXZ.x / uSizes[${i}], -vGameXZ.y / uSizes[${i}], ${i}.0)).rgb; tot += ${w};`;
      }).join('\n');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\nprecision highp sampler2DArray;\nuniform sampler2DArray uLayers;\nuniform float uSizes[${n}];\nuniform float uHalf;\nuniform float uExtent;\n${splatDecl}\nvarying vec2 vGameXZ;`,
        )
        .replace(
          '#include <map_fragment>',
          `vec2 suv = vec2((vGameXZ.x + uHalf) / uExtent, (uHalf - vGameXZ.y) / uExtent);
${weights}
vec3 col = vec3(0.0); float tot = 0.0;
${blend}
diffuseColor.rgb *= tot > 0.001 ? col / tot : vec3(0.24, 0.29, 0.17);`,
        );
    };
    m.customProgramCacheKey = () => `ground-${n}-${tex.splats.length}`;
    return m;
    // site.x/z aktualizuje efekt niżej, bez przekompilowania shadera
  }, [tex, map.meta.extent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const shader = material?.userData.shader as { uniforms: Record<string, { value: unknown }> } | undefined;
    if (shader) (shader.uniforms.uOrigin.value as THREE.Vector2).set(site.x, site.z);
  }, [material, site.x, site.z]);

  useEffect(() => () => material?.dispose(), [material]);
  return material;
}

// --- Drogi ---

interface RoadParams {
  tex: string;
  halfWidth: number;
  halfVert: number;
  edge: number;
  offset: number;
  vPerM: number;
}
interface RoadsFile {
  materials: RoadParams[];
  assets: Record<string, RoadParams>;
  /** j: [x, y, z, t0x, t0y, t0z, t1x, t1y, t1z, offset, ignoreTerrain] */
  roads: { m: number; a?: string; loop: boolean; j: number[][] }[];
}

const roadsCache = new Map<string, Promise<RoadsFile | null>>();
function loadRoads(id: string) {
  let p = roadsCache.get(id);
  if (!p) {
    p = fetch(`${mapBase(id)}/roads.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RoadsFile>) : null))
      .catch(() => null);
    roadsCache.set(id, p);
  }
  return p;
}

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// BezierTool
const bezier = (a: V3, b: V3, c: V3, d: V3, t: number): V3 => {
  const u = 1 - t;
  return add(add(mul(a, u * u * u), mul(b, 3 * u * u * t)), add(mul(c, 3 * u * t * t), mul(d, t * t * t)));
};
const bezierVel = (a: V3, b: V3, c: V3, d: V3, t: number): V3 => {
  const u = 1 - t;
  return add(add(mul(sub(b, a), 3 * u * u), mul(sub(c, b), 6 * u * t)), mul(sub(d, c), 3 * t * t));
};
const bezierLen = (a: V3, b: V3, c: V3, d: V3) => (len(sub(d, a)) + len(sub(d, c)) + len(sub(b, c)) + len(sub(b, a))) / 2;

/** Geometria jednej drogi w układzie sceny (null, gdy droga nie dotyka wycinka). */
function buildRoad(
  road: RoadsFile['roads'][number],
  params: RoadParams,
  heightAt: (x: number, z: number) => number,
  site: Site,
  span: number,
): { pos: number[]; nrm: number[]; uv: number[]; idx: number[] } | null {
  const J = road.j;
  if (J.length < 2) return null;
  const vert = (k: number): V3 => [J[k][0], J[k][1], J[k][2]];
  const tan = (k: number, s: 0 | 1): V3 => (s === 0 ? [J[k][3], J[k][4], J[k][5]] : [J[k][6], J[k][7], J[k][8]]);
  const segs = J.length - 1 + (road.loop ? 1 : 0);
  const ctrl = (i: number) => {
    const j2 = i === J.length - 1 ? 0 : i + 1;
    const a = vert(i), d = vert(j2), t1 = tan(i, 1), t2 = tan(j2, 0);
    const straight = dot(norm(t1), norm(t2)) < -0.999;
    return { a, b: add(a, t1), c: add(d, t2), d, straight };
  };

  // updateSamples: co 5 m, reszta przechodzi na następny segment
  const samples: { i: number; t: number }[] = [];
  let carry = 0;
  for (let i = 0; i < segs; i++) {
    const c = ctrl(i);
    const L = c.straight ? len(sub(c.d, c.a)) : bezierLen(c.a, c.b, c.c, c.d);
    let s = carry;
    for (; s < L; s += 5) samples.push({ i, t: s / L });
    carry = s - L;
  }
  samples.push(road.loop ? { i: 0, t: 0 } : { i: J.length - 2, t: 1 });

  // szybkie odrzucenie dróg poza wycinkiem
  const near = J.some((j) => Math.abs(j[0] - site.x) < span && Math.abs(j[2] - site.z) < span);
  if (!near) return null;

  const normalAt = (x: number, z: number): V3 => {
    const e = 1;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    return norm([-dx, 2 * e, -dz]);
  };

  const { halfWidth: hw, halfVert: hv, edge, offset: off, vPerM } = params;
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [];
  let dist = 0;
  let prev: V3 | null = null;
  for (const s of samples) {
    const c = ctrl(s.i);
    const jt = J[s.i];
    const ignore = jt[10] === 1;
    let p = c.straight ? add(c.a, mul(sub(c.d, c.a), s.t)) : bezier(c.a, c.b, c.c, c.d, s.t);
    if (!ignore) p = [p[0], heightAt(p[0], p[2]), p[2]];
    const dir = norm(c.straight ? sub(c.d, c.a) : bezierVel(c.a, c.b, c.c, c.d, s.t));
    const up: V3 = ignore ? [0, 1, 0] : normalAt(p[0], p[2]);
    const side = norm(cross(dir, up));
    if (!ignore) {
      for (const sgn of [1, -1]) {
        const q = add(p, mul(side, sgn * hw));
        const diff = heightAt(q[0], q[2]) - q[1];
        if (diff > 0) p = [p[0], p[1] + diff, p[2]];
      }
    }
    const nextOff = s.i < J.length - 1 ? J[s.i + 1][9] : road.loop ? J[0][9] : jt[9];
    p = [p[0], p[1] + jt[9] + (nextOff - jt[9]) * s.t, p[2]];
    if (prev) dist += len(sub(p, prev));
    prev = p;
    const lift = mul(up, off);
    const ring: V3[] = [
      add(add(add(p, mul(side, hw + edge)), mul(up, -hv)), lift),
      add(add(add(p, mul(side, hw)), mul(up, hv)), lift),
      add(add(add(p, mul(side, -hw)), mul(up, hv)), lift),
      add(add(add(p, mul(side, -(hw + edge))), mul(up, -hv)), lift),
    ];
    const v = dist * vPerM;
    ring.forEach((r, k) => {
      // świat gry -> scena (z na północ -> -z)
      pos.push(r[0] - site.x, r[1] - site.elevation, site.z - r[2]);
      nrm.push(up[0], up[1], -up[2]);
      uv.push(k < 2 ? 0 : 1, v);
    });
  }
  // trójkąty jak w Road.buildMesh: 3 pasy (pobocze, jezdnia, pobocze) między kolejnymi próbkami.
  // Unity: przód = zgodnie z ruchem wskazówek zegara; po odbiciu osi z trójkąt dalej jest "zgodny",
  // a three.js uznaje za przód przeciwny kierunek, więc dwa ostatnie wierzchołki każdego trójkąta są zamienione.
  const idx: number[] = [];
  for (let k = 0; k < samples.length - 1; k++) {
    const o = k * 4;
    idx.push(o + 5, o + 4, o + 1, o, o + 1, o + 4, o + 6, o + 5, o + 2, o + 1, o + 2, o + 5, o + 7, o + 6, o + 3, o + 2, o + 3, o + 6);
  }
  return { pos, nrm, uv, idx };
}

/** Drogi z mapy gry w obrębie wycinka terenu. */
export function GameRoads({ site, map, span }: { site: Site; map: MapData; span: number }) {
  const [file, setFile] = useState<RoadsFile | null>(null);
  useEffect(() => {
    let alive = true;
    if (map.meta.roads) loadRoads(map.meta.id).then((f) => alive && setFile(f));
    return () => {
      alive = false;
    };
  }, [map.meta.id, map.meta.roads]);

  // jedna siatka na materiał drogi
  const meshes = useMemo(() => {
    if (!file) return [];
    const groups = new Map<string, { params: RoadParams; parts: NonNullable<ReturnType<typeof buildRoad>>[] }>();
    for (const road of file.roads) {
      const params = (road.a && file.assets[road.a]) || file.materials[road.m];
      if (!params) continue;
      const part = buildRoad(road, params, map.heightAt, site, span);
      if (!part) continue;
      const key = params.tex;
      if (!groups.has(key)) groups.set(key, { params, parts: [] });
      groups.get(key)!.parts.push(part);
    }
    return [...groups.values()].map(({ params, parts }) => {
      const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
      for (const p of parts) {
        const base = pos.length / 3;
        pos.push(...p.pos);
        nrm.push(...p.nrm);
        uv.push(...p.uv);
        for (const i of p.idx) idx.push(i + base);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      return { key: params.tex, geometry: g, url: `${mapBase(map.meta.id)}/${params.tex}` };
    });
  }, [file, map, site, span]);

  return (
    <>
      {meshes.map((m) => (
        <RoadMesh key={m.key} geometry={m.geometry} url={m.url} />
      ))}
    </>
  );
}

function RoadMesh({ geometry, url }: { geometry: THREE.BufferGeometry; url: string }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load(url, (t) => {
      if (!alive) return;
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      setTex(t);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!tex) return null;
  return (
    <mesh geometry={geometry} receiveShadow userData={{ terrain: true }}>
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  );
}
