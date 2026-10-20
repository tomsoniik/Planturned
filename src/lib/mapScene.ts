/*
  Obiekty mapy (budynki, skały, płoty...) i drzewa wyeksportowane z gry (npm run export:game).

  public/maps/<Mapa>/scene.json: { types: [{ guid, kind, name }], inst: [[typ, x, y, z, rx, ry, rz, sx, sy, sz]] }
  Pozycja i obrót (kąty Eulera w stopniach) w układzie Unity, jak w Level/Objects.dat i Terrain/Trees.dat.
  public/game/scenery/<guid>.json: model w układzie three.js (LOD0, kolory palety),
  w "cut" liście i siatki z teksturą wycinaną alfą (public/game/scenery/tex).
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

interface RawCutout {
  /** Plik tekstury względem /game/scenery. */
  t: string;
  /** Próg alfy (_Cutoff materiału). */
  a: number;
  p: number[];
  uv: number[];
  i: number[];
}

/** Model typu: bryły z kolorami palety i części wycinane alfą (liście, siatki) z własną teksturą. */
export interface SceneryModel {
  solid: THREE.BufferGeometry | null;
  cutouts: { geometry: THREE.BufferGeometry; material: THREE.Material }[];
}

// Liście kilku gatunków drzew dzielą teksturę: jeden materiał na plik.
const cutoutMaterials = new Map<string, THREE.Material>();
const textureLoader = new THREE.TextureLoader();

function cutoutMaterial(file: string, alphaTest: number) {
  const key = `${file}@${alphaTest}`;
  let m = cutoutMaterials.get(key);
  if (!m) {
    const map = textureLoader.load(`/game/scenery/${file}`);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    // DoubleSide: karty liści widać z obu stron, cień też rzucają obie strony
    m = new THREE.MeshStandardMaterial({ map, alphaTest, side: THREE.DoubleSide, roughness: 0.9 });
    cutoutMaterials.set(key, m);
  }
  return m;
}

function cutoutGeometry(raw: RawCutout) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(raw.p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(raw.uv, 2));
  g.setIndex(raw.i);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const modelCache = new Map<string, Promise<SceneryModel | null>>();

export function loadSceneryModel(guid: string): Promise<SceneryModel | null> {
  let p = modelCache.get(guid);
  if (!p) {
    p = fetch(`/game/scenery/${guid}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((mesh: { p: number[]; i: number[]; c?: number[]; cut?: RawCutout[] } | null) =>
        mesh
          ? {
              solid: mesh.i.length ? buildGeometry(mesh) : null,
              cutouts: (mesh.cut ?? []).map((c) => ({ geometry: cutoutGeometry(c), material: cutoutMaterial(c.t, c.a) })),
            }
          : null,
      )
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
