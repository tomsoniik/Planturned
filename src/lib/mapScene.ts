/*
  Obiekty mapy (budynki, skały, płoty...) i drzewa wyeksportowane z gry (npm run export:game).

  public/maps/<Mapa>/scene.json: { types: [{ guid, kind, name }], inst: [[typ, x, y, z, rx, ry, rz, sx, sy, sz]] }
  Pozycja i obrót (kąty Eulera w stopniach) w układzie Unity, jak w Level/Objects.dat i Terrain/Trees.dat.
  public/game/scenery/<guid>.json: model w układzie three.js (LOD0, kolory palety).
*/
import * as THREE from 'three';
import { buildGeometry } from './gameModels';

export interface SceneType {
  guid: string;
  kind: 'object' | 'tree';
  name: string;
}

export interface MapScene {
  types: SceneType[];
  inst: number[][];
}

const sceneCache = new Map<string, Promise<MapScene | null>>();

export function loadMapScene(mapId: string): Promise<MapScene | null> {
  let p = sceneCache.get(mapId);
  if (!p) {
    p = fetch(`/maps/${encodeURIComponent(mapId)}/scene.json`)
      .then((r) => (r.ok ? (r.json() as Promise<MapScene>) : null))
      .catch(() => null);
    sceneCache.set(mapId, p);
  }
  return p;
}

const modelCache = new Map<string, Promise<THREE.BufferGeometry | null>>();

export function loadSceneryModel(guid: string): Promise<THREE.BufferGeometry | null> {
  let p = modelCache.get(guid);
  if (!p) {
    p = fetch(`/game/scenery/${guid}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((mesh) => (mesh ? buildGeometry(mesh) : null))
      .catch(() => null);
    modelCache.set(guid, p);
  }
  return p;
}

const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

/**
 * Macierz instancji w scenie plannera.
 * Unity jest lewoskrętne, three.js prawoskrętne: odbijamy oś Z (z_sceny = site.z - z_świata).
 * Quaternion.Euler(x, y, z) w Unity to Ry * Rx * Rz; po odbiciu Z kąty wokół X i Y zmieniają znak.
 */
export function instanceMatrix(row: number[], origin: { x: number; y: number; z: number }, out: THREE.Matrix4) {
  const [, x, y, z, rx, ry, rz, sx, sy, sz] = row;
  tmpPos.set(x - origin.x, y - origin.y, origin.z - z);
  tmpEuler.set(THREE.MathUtils.degToRad(-rx), THREE.MathUtils.degToRad(-ry), THREE.MathUtils.degToRad(rz), 'YXZ');
  tmpQuat.setFromEuler(tmpEuler);
  tmpScale.set(sx, sy, sz);
  return out.compose(tmpPos, tmpQuat, tmpScale);
}
