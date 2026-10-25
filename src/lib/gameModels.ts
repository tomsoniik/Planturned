import * as THREE from 'three';

/** Model struktury wyeksportowany z gry (public/game/structures.json, npm run export:game). */
export interface GameModel {
  id: number;
  name: string;
  construct: string;
  health: number | null;
  color: string | null;
  geometry: THREE.BufferGeometry;
  /** Najniższy punkt modelu (pivot w konwencji gry). */
  minY: number;
  /** Czy model ma kolory z palety gry (tekstura 2x2 próbkowana przez UV). */
  hasColors: boolean;
}

interface RawStructure {
  id: number;
  name: string;
  construct: string;
  health: number | null;
  color?: string;
  mesh?: { p: number[]; i: number[]; c?: number[] };
}

/** Geometria z eksportu (pozycje, indeksy, kolory palety w sRGB) z płaskim cieniowaniem jak w grze. */
export function buildGeometry(mesh: { p: number[]; i: number[]; c?: number[] }) {
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(mesh.p, 3));
  if (mesh.c) {
    // Paleta jest w sRGB, three.js liczy oświetlenie w przestrzeni liniowej.
    const c = new THREE.Color();
    const lin = new Float32Array(mesh.c.length);
    for (let k = 0; k < mesh.c.length; k += 3) {
      c.setRGB(mesh.c[k] / 255, mesh.c[k + 1] / 255, mesh.c[k + 2] / 255, THREE.SRGBColorSpace);
      lin[k] = c.r;
      lin[k + 1] = c.g;
      lin[k + 2] = c.b;
    }
    indexed.setAttribute('color', new THREE.Float32BufferAttribute(lin, 3));
  }
  indexed.setIndex(mesh.i);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

let promise: Promise<Map<number, GameModel>> | null = null;

/** Wczytuje modele raz; gdy eksportu nie ma, zwraca pustą mapę (builder używa brył zastępczych). */
export function loadGameModels(): Promise<Map<number, GameModel>> {
  if (!promise) {
    promise = fetch('/game/structures.json')
      .then((r) => (r.ok ? (r.json() as Promise<RawStructure[]>) : []))
      .then((list) => {
        const map = new Map<number, GameModel>();
        list.forEach((s) => {
          if (!s.mesh) return;
          const geometry = buildGeometry(s.mesh);
          map.set(s.id, {
            id: s.id,
            name: s.name,
            construct: s.construct,
            health: s.health,
            color: s.color ?? null,
            geometry,
            minY: geometry.boundingBox!.min.y,
            hasColors: !!s.mesh.c,
          });
        });
        return map;
      })
      .catch(() => new Map());
  }
  return promise;
}

// --- Rekwizyty: siatki wczytywane pojedynczo, na żądanie (public/game/props/<id>.json) ---

const propModels = new Map<number, GameModel>();
const propPending = new Set<number>();
const propListeners = new Set<() => void>();

/** Już wczytane modele rekwizytów (ID z gry -> model). */
export const loadedPropModels = () => propModels;

/** Powiadamia, gdy dojdzie nowy model rekwizytu; zwraca funkcję wypisania. */
export function onPropModels(fn: () => void) {
  propListeners.add(fn);
  return () => {
    propListeners.delete(fn);
  };
}

/** Zleca wczytanie modeli, których jeszcze nie ma (każdy co najwyżej raz). */
export function requestPropModels(ids: Iterable<number>) {
  for (const id of ids) {
    if (propModels.has(id) || propPending.has(id)) continue;
    propPending.add(id);
    fetch(`/game/props/${id}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ p: number[]; i: number[]; c?: number[] }>) : null))
      .then((mesh) => {
        if (!mesh) return;
        const geometry = buildGeometry(mesh);
        propModels.set(id, {
          id,
          name: '',
          construct: 'Barricade',
          health: null,
          color: null,
          geometry,
          minY: geometry.boundingBox!.min.y,
          hasColors: !!mesh.c,
        });
        propListeners.forEach((fn) => fn());
      })
      .catch(() => {})
      .finally(() => propPending.delete(id));
  }
}
