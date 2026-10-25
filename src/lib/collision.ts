/*
  Kolizje postaci i celowanie w Sandboxie 3D.
  - Listy siatek (struktury, obiekty mapy, drogi) trzymamy w pamięci i odświeżamy tylko po zmianie sceny
    (markSceneDirty) albo co sekundę na wszelki wypadek, zamiast przechodzić całe drzewo sceny w każdej klatce.
  - Promienie idą przez BVH (three-mesh-bvh): geometria dostaje drzewo przy pierwszym odświeżeniu listy.
  - Postać to kapsuła (PlayerStance.RADIUS, HEIGHT_*): ruch poziomy sprawdza wachlarz równoległych promieni
    na całej szerokości postaci na kilku wysokościach, więc cienki słupek ani róg nie prześlizgną się między nimi.
*/
import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
// acceleratedRaycast nie sprawdza sfery otaczającej i przy każdej instancji odwraca macierz;
// najpierw tani test sfery jak w three.js, drzewo dopiero dla trafionych. Bez drzewa: zwykły raycast.
const baseRaycast = THREE.Mesh.prototype.raycast;
const raySphere = new THREE.Sphere();
THREE.Mesh.prototype.raycast = function (raycaster, intersects) {
  const g = this.geometry;
  if (!g.boundsTree) return baseRaycast.call(this, raycaster, intersects);
  if (g.boundingSphere === null) g.computeBoundingSphere();
  raySphere.copy(g.boundingSphere!).applyMatrix4(this.matrixWorld);
  if (!raycaster.ray.intersectsSphere(raySphere)) return;
  if (raycaster.ray.origin.distanceTo(raySphere.center) - raySphere.radius > raycaster.far) return;
  acceleratedRaycast.call(this, raycaster, intersects);
};

/** Poniżej tej liczby trójkątów zwykły raycast jest szybszy niż budowa drzewa. */
const BVH_MIN_TRIANGLES = 128;
const REFRESH_MS = 1000;

export interface SceneMeshes {
  /** Blokują ruch: struktury i obiekty mapy bez dróg i przezroczystych kart (liście, siatki). */
  solids: THREE.Object3D[];
  /** Można na nich stanąć: wszystko poza drzewami. */
  floors: THREE.Object3D[];
  /** Postawione elementy bazy (celowanie, wyburzanie, interakcja). */
  structures: THREE.Object3D[];
  /** Obiekty mapy bez drzew (celowanie, grunt pod podłogą). */
  mapSolids: THREE.Object3D[];
}

let cache: SceneMeshes | null = null;
let cachedScene: THREE.Scene | null = null;
let stamp = 0;
let dirty = true;

/** Scena się zmieniła (element dodany lub usunięty, doczytany obiekt mapy): listy siatek do przebudowy. */
export function markSceneDirty() {
  dirty = true;
}

function withTree(mesh: THREE.Mesh) {
  const g = mesh.geometry;
  if (!g || g.boundsTree || !g.attributes.position) return;
  const triangles = (g.index ? g.index.count : g.attributes.position.count) / 3;
  if (triangles >= BVH_MIN_TRIANGLES) g.computeBoundsTree();
}

export function sceneMeshes(scene: THREE.Scene): SceneMeshes {
  const now = performance.now();
  if (cache && !dirty && cachedScene === scene && now - stamp < REFRESH_MS) return cache;
  const next: SceneMeshes = { solids: [], floors: [], structures: [], mapSolids: [] };
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const d = o.userData;
    const structure = !!(d.itemId || d.itemIds);
    if (!structure && !d.road && !d.mapObject) return;
    withTree(mesh);
    if (structure) next.structures.push(o);
    if (d.mapObject && !d.tree) next.mapSolids.push(o);
    if (!d.road && !d.cutout) next.solids.push(o);
    if (!d.tree) next.floors.push(o);
  });
  cache = next;
  cachedScene = scene;
  stamp = now;
  dirty = false;
  return next;
}

// --- Najbliższe otoczenie postaci ---

/*
  Promień po InstancedMesh sprawdza każdą instancję, a ruch postaci to kilkadziesiąt promieni na klatkę.
  Raz na klatkę wybieramy więc instancje, których sfera dotyka kuli wokół postaci, i dajemy je promieniom
  jako zwykłe siatki z macierzą instancji (pula obiektów, bez alokacji w każdej klatce).
*/
const around = new THREE.Sphere();
const bounds = new THREE.Sphere();
const instanceWorld = new THREE.Matrix4();

/**
 * Wybór brył w pobliżu z własną pulą obiektów: każda lista (np. ściany i podłoże) potrzebuje osobnego,
 * bo wynik jest ważny do następnego wywołania tej samej funkcji.
 */
export function createNearby() {
  const proxies: THREE.Mesh[] = [];
  const near: THREE.Object3D[] = [];

  const proxyFor = (index: number, source: THREE.InstancedMesh, matrix: THREE.Matrix4, instanceId: number) => {
    const proxy = proxies[index] ?? (proxies[index] = new THREE.Mesh());
    proxy.geometry = source.geometry;
    proxy.material = source.material;
    proxy.matrixWorld.copy(matrix);
    // id elementu z partii: kolizja go nie potrzebuje, ale testy (?debug) pokazują, w co trafił promień
    proxy.userData = { itemId: source.userData.itemIds?.[instanceId], mapObject: source.userData.mapObject };
    return proxy;
  };

  /** Bryły (i instancje), których sfera otaczająca dotyka kuli (x, y, z, r). */
  return (objects: THREE.Object3D[], x: number, y: number, z: number, r: number): THREE.Object3D[] => {
    near.length = 0;
    around.center.set(x, y, z);
    around.radius = r;
    let used = 0;
    for (const o of objects) {
      const mesh = o as THREE.InstancedMesh;
      const g = mesh.geometry;
      if (!g) continue;
      if (g.boundingSphere === null) g.computeBoundingSphere();
      if (mesh.isInstancedMesh) {
        if (mesh.count === 0) continue;
        if (mesh.boundingSphere === null) mesh.computeBoundingSphere();
        bounds.copy(mesh.boundingSphere!).applyMatrix4(mesh.matrixWorld);
        if (!bounds.intersectsSphere(around)) continue;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, instanceWorld);
          instanceWorld.premultiply(mesh.matrixWorld);
          bounds.copy(g.boundingSphere!).applyMatrix4(instanceWorld);
          if (bounds.intersectsSphere(around)) near.push(proxyFor(used++, mesh, instanceWorld, i));
        }
      } else {
        bounds.copy(g.boundingSphere!).applyMatrix4(mesh.matrixWorld);
        if (bounds.intersectsSphere(around)) near.push(o);
      }
    }
    return near;
  };
}

// --- Promienie kolizji ---

const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
const hits: THREE.Intersection[] = [];
const origin = new THREE.Vector3();
const direction = new THREE.Vector3();
const instance = new THREE.Matrix4();
const normalMatrix = new THREE.Matrix3();

/** Pierwsze trafienie promienia (albo null). */
export function castFirst(objects: THREE.Object3D[], ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, far: number) {
  origin.set(ox, oy, oz);
  direction.set(dx, dy, dz).normalize();
  ray.set(origin, direction);
  ray.far = far;
  hits.length = 0;
  ray.intersectObjects(objects, false, hits);
  return hits[0] ?? null;
}

/** Normalna trafionej ściany w układzie świata (z uwzględnieniem macierzy instancji). */
function worldNormal(hit: THREE.Intersection, out: THREE.Vector3) {
  if (!hit.face) return out.set(0, 0, 0);
  out.copy(hit.face.normal);
  const obj = hit.object as THREE.InstancedMesh;
  if (obj.isInstancedMesh && hit.instanceId !== undefined) {
    obj.getMatrixAt(hit.instanceId, instance);
    instance.premultiply(obj.matrixWorld);
  } else {
    instance.copy(obj.matrixWorld);
  }
  return out.applyMatrix3(normalMatrix.getNormalMatrix(instance)).normalize();
}

/** Margines między postacią a ścianą, żeby promień w następnej klatce nie startował w ścianie. */
const SKIN = 0.02;
/** Przesunięcia promieni w poprzek ruchu (ułamek promienia postaci). */
const LANES = [-0.95, -0.5, 0, 0.5, 0.95];
const wallNormal = new THREE.Vector3();

/** Wysokości (nad stopami) sprawdzane przy ruchu: kolana, środek, głowa; niższe przeszkody pokonuje wchodzenie na stopnie. */
function probeHeights(height: number) {
  const knee = 0.55;
  const head = Math.max(knee + 0.05, height - 0.15);
  return head - knee > 0.5 ? [knee, (knee + head) / 2, head] : [knee, head];
}

/**
 * Jak daleko kapsuła może przesunąć się w poziomym kierunku (dirX, dirZ), najwyżej `dist`.
 * Zwraca dozwoloną drogę i normalną najbliższej ściany (w `wallNormal`).
 */
function sweep(objects: THREE.Object3D[], x: number, feet: number, z: number, radius: number, height: number, dirX: number, dirZ: number, dist: number) {
  let allowed = dist;
  let hit = false;
  const px = -dirZ, pz = dirX; // w poprzek ruchu
  for (const h of probeHeights(height)) {
    for (const lane of LANES) {
      const off = lane * radius;
      // odległość od punktu startu promienia do brzegu postaci w kierunku ruchu
      const reach = Math.sqrt(Math.max(0, radius * radius - off * off));
      const first = castFirst(objects, x + px * off, feet + h, z + pz * off, dirX, 0, dirZ, dist + reach + SKIN);
      if (!first) continue;
      const free = first.distance - reach - SKIN;
      if (free < allowed) {
        allowed = free;
        hit = true;
        worldNormal(first, wallNormal);
      }
    }
  }
  return { allowed: Math.max(0, allowed), hit };
}

/**
 * Ruch poziomy kapsuły o (dx, dz) z kolizją: dojście do ściany i ślizganie wzdłuż niej (rzut reszty ruchu na ścianę).
 * Zwraca przesunięcie do wykonania i informację, czy coś zatrzymało ruch na danej osi.
 */
export function moveCapsule(objects: THREE.Object3D[], x: number, feet: number, z: number, radius: number, height: number, dx: number, dz: number) {
  let mx = 0, mz = 0;
  let rx = dx, rz = dz;
  let blocked = false;
  // dwa przebiegi: ruch do ściany, potem ślizg wzdłuż niej (w rogu drugi przebieg też się zatrzyma)
  for (let pass = 0; pass < 2; pass++) {
    const dist = Math.hypot(rx, rz);
    if (dist < 1e-6) break;
    const dirX = rx / dist, dirZ = rz / dist;
    const s = sweep(objects, x + mx, feet, z + mz, radius, height, dirX, dirZ, dist);
    mx += dirX * s.allowed;
    mz += dirZ * s.allowed;
    if (!s.hit) break;
    blocked = true;
    // reszta ruchu rzutowana na płaszczyznę ściany (tylko pozioma składowa normalnej)
    const left = dist - s.allowed;
    const nx = wallNormal.x, nz = wallNormal.z;
    const nl = Math.hypot(nx, nz);
    if (nl < 1e-3) break;
    const ux = nx / nl, uz = nz / nl;
    const restX = dirX * left, restZ = dirZ * left;
    const into = restX * ux + restZ * uz;
    rx = restX - ux * into;
    rz = restZ - uz * into;
  }
  return { dx: mx, dz: mz, blocked };
}

const PUSH_DIRS = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)] as const);

/**
 * Wypchnięcie kapsuły z elementów, które w nią weszły (np. zamykane drzwi, element postawiony na graczu):
 * promienie od środka na boki, każdy krótszy od promienia postaci odpycha w przeciwną stronę.
 */
export function pushOut(objects: THREE.Object3D[], x: number, feet: number, z: number, radius: number, height: number) {
  // tylko najgłębsze wcięcie: suma ze skośnych promieni na tę samą ścianę wypychałaby za daleko,
  // a w rogu drugą ścianę poprawi następna klatka
  let best = 0, px = 0, pz = 0;
  for (const [cx, cz] of PUSH_DIRS) {
    for (const h of probeHeights(height)) {
      const first = castFirst(objects, x, feet + h, z, cx, 0, cz, radius);
      if (!first) continue;
      const depth = radius - first.distance;
      if (depth > best) {
        best = depth;
        px = -cx * depth;
        pz = -cz * depth;
      }
    }
  }
  return { dx: px, dz: pz };
}

/** Punkty nad głową sprawdzane przy skoku i wstawaniu: środek i cztery boki. */
const HEAD_POINTS = [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]] as const;

/**
 * Ile miejsca jest nad punktem `top` (czubek głowy), najwyżej `up` metrów.
 * Zwraca odległość do najbliższego sufitu albo `up`, gdy wolne.
 */
export function headroom(objects: THREE.Object3D[], x: number, top: number, z: number, radius: number, up: number) {
  let free = up;
  for (const [ax, az] of HEAD_POINTS) {
    // start trochę poniżej głowy, żeby nie zaczynać promienia w suficie
    const first = castFirst(objects, x + ax * radius, top - 0.05, z + az * radius, 0, 1, 0, up + 0.05);
    if (first) free = Math.min(free, first.distance - 0.05);
  }
  return Math.max(0, free);
}
