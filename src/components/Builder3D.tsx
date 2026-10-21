"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import styles from './Builder3D.module.css';
import {
  LEVEL_HEIGHT,
  SIDE,
  TRI_H,
  computePaste,
  computePlacement,
  findDef,
  findSlabSlotByRay,
  findSlotByRay,
  isFloorPart,
  isPlacementValid,
  isSlab,
  normalizeAngle,
  roundLevel,
  sameLevel,
  wallMissingPillars,
  isRoofLayer,
  type BuildItem,
  type PasteResult,
  type PlacedItem,
} from '@/lib/builder';
import { resolveLighting } from '@/lib/lighting';
import { loadGameModels, type GameModel } from '@/lib/gameModels';
import { loadMap, mapOverviewUrl, type MapData, type Site } from '@/lib/terrain';
import { DEFAULT_SCENE, type SceneSettings } from '@/lib/scene';
import { itemLabel, type AimReason, type AimWarn } from '@/lib/i18n';
import { useT } from './I18nProvider';
import { keyLabel, useKeybinds } from '@/lib/keybinds';
import { onSceneCommand, registerCameraProbe, registerContainer, useView3D } from '@/lib/view3d';
import {
  AIR_ACCEL, AIR_DECEL, EYES, EYES_LERP, FALL_DAMAGE_MAX, FALL_DAMAGE_SPEED, GRAVITY, HEIGHT, JUMP_SPEED, MAX_SLOPE_DEG,
  RADIUS, SLIDE_ACCEL, SPEED, SWIM_BODY_DEPTH, SWIM_MULTIPLIER, SWIM_SURFACE_OFFSET, SWIM_UP_SPEED, TERMINAL_VELOCITY, TICK,
  breathAtHeight, oxygenTick, type OxygenState, type Stance, type Vitals,
} from '@/lib/playerPhysics';
import { Meadow, SkyAndLight, meadowHeight } from './Scenery';
import MapObjects from './MapObjects';
import { GameRoads, maskedMaterial, nearMask, useGroundMaterial } from './GameGround';

// --- Wymiary w metrach (zgodne z modelami gry) ---
export const SCALE = 1 / 10; // jednostki planu -> metry
const S = SIDE * SCALE; // bok podłogi: 6 m
const H = LEVEL_HEIGHT; // wysokość poziomu: 4,5 m
const TOP = 0.25; // wierzch podłogi nad jej pivotem
const WALL_BASE = 0.125; // spód ścian, filarów i słupków nad poziomem
const TILE = 128; // bok kafla terenu w pełnej rozdzielczości (m)
const NEAR_RADIUS = 600; // kafle do tej odległości od kamery (środek kafla) są w pełnej rozdzielczości
const DROP_RADIUS = 760; // dalsze kafle są zwalniane (histereza względem NEAR_RADIUS)
const TILE_BUDGET_MS = 3; // czas na dobudowanie kafli w jednej klatce
const OBJECT_RADIUS = 480; // promień wokół kamery, w którym wczytujemy obiekty mapy
const CHUNK = 128; // co ile metrów obszar obiektów mapy przesuwa się za kamerą

type Models = Map<number, GameModel>;

export function useGameModels() {
  const [models, setModels] = useState<Models>(new Map());
  useEffect(() => {
    let alive = true;
    loadGameModels().then((m) => alive && setModels(m));
    return () => {
      alive = false;
    };
  }, []);
  return models;
}

/** Wysokość pivotu elementu nad poziomem (konwencje z gry). */
function pieceY(def: BuildItem, model?: GameModel) {
  if (def.shape === 'bed') return TOP;
  if (def.shape === 'hatch') return H - 0.1; // w otworze dachu
  if (def.shape === 'wall' || def.shape === 'pillar') return WALL_BASE - (model ? model.minY : 0);
  if (isRoofLayer(def)) return H;
  return 0;
}

// --- Bryły zastępcze (gdy nie ma eksportu modeli z gry) ---

const triShape = (() => {
  const s = new THREE.Shape();
  const h = TRI_H * SCALE;
  s.moveTo(0, (h * 2) / 3);
  s.lineTo(S / 2, -h / 3);
  s.lineTo(-S / 2, -h / 3);
  s.closePath();
  return s;
})();

function FallbackGeometry({ def }: { def: BuildItem }) {
  switch (def.shape) {
    case 'triangle':
      return <extrudeGeometry args={[triShape, { depth: 0.5, bevelEnabled: false }]} />;
    case 'wall':
      return <boxGeometry args={[5.6, def.part === 'rampart' ? 1.5 : 4.25, 0.7]} />;
    case 'pillar':
      return <boxGeometry args={[1, def.part === 'post' ? 1.86 : 4.25, 1]} />;
    case 'hatch':
      return <boxGeometry args={[1.6, 0.12, 1.6]} />;
    case 'bed':
      return <boxGeometry args={[1, 0.5, 2]} />;
    default:
      return <boxGeometry args={[S, 0.5, S]} />;
  }
}

/** Przesunięcie bryły zastępczej względem pivotu (żeby pasowała do konwencji modeli z gry). */
function fallbackOffset(def: BuildItem): [number, number, number] {
  if (def.shape === 'wall') return [0, (def.part === 'rampart' ? 1.5 : 4.25) / 2, 0];
  if (def.shape === 'pillar') return [0, (def.part === 'post' ? 1.86 : 4.25) / 2, 0];
  if (def.shape === 'bed') return [0, 0.25, 0];
  return [0, 0, 0];
}

interface PieceProps {
  def: BuildItem;
  model?: GameModel;
  color: string;
  /** Płaszczyzna przycinająca (skybase: bez fundamentu podłogi). */
  clip?: THREE.Plane[];
  ghost?: 'ok' | 'bad';
  highlight?: 'selected' | 'target';
  itemId?: string;
}

/** Jeden element w lokalnym układzie (pivot w 0, bez obrotu). */
function Piece({ def, model, color, clip, ghost, highlight, itemId }: PieceProps) {
  const palette = !!model?.hasColors && highlight !== 'target';
  const material = ghost ? (
    <meshStandardMaterial
      color={ghost === 'ok' ? '#8dc46f' : '#e5484d'}
      transparent
      opacity={0.45}
      depthWrite={false}
      flatShading
    />
  ) : (
    <meshStandardMaterial
      key={`${palette ? 'palette' : 'flat'}-${clip ? 'clip' : 'full'}`}
      vertexColors={palette}
      color={highlight === 'target' ? '#e5484d' : palette ? '#ffffff' : color}
      emissive={highlight === 'selected' ? '#8dc46f' : highlight === 'target' ? '#7a1c1f' : '#000000'}
      emissiveIntensity={highlight ? 0.35 : 0}
      clippingPlanes={clip}
      // Przycięta podłoga nie ma spodu: od dołu pokazujemy wnętrze płyty, inaczej skybase jest przezroczysty.
      side={clip ? THREE.DoubleSide : THREE.FrontSide}
      roughness={def.material === 'metal' ? 0.55 : 0.9}
      metalness={def.material === 'metal' ? 0.2 : 0}
      flatShading
    />
  );
  // W Unturned budowle nie rzucają cienia, tylko go przyjmują
  const shadow = !ghost;

  if (model) {
    return (
      <mesh geometry={model.geometry} receiveShadow={shadow} userData={{ itemId }}>
        {material}
      </mesh>
    );
  }
  const triangle = def.shape === 'triangle';
  return (
    <mesh
      position={triangle ? [0, -0.25, 0] : fallbackOffset(def)}
      rotation={triangle ? [-Math.PI / 2, 0, 0] : undefined}
      receiveShadow={shadow}
      userData={{ itemId }}
    >
      <FallbackGeometry def={def} />
      {material}
    </mesh>
  );
}

const MemoPiece = React.memo(Piece);

export function Item3D({
  item,
  models,
  isSelected = false,
  isTargeted = false,
  showBedAreas = false,
  noSkirt = false,
}: {
  item: PlacedItem;
  models: Models;
  isSelected?: boolean;
  isTargeted?: boolean;
  showBedAreas?: boolean;
  /** Skybase: fundament podłogi (10 m w dół) jest przycinany. */
  noSkirt?: boolean;
}) {
  const def = findDef(item.itemId);
  const floorPart = def?.part === 'floor' || def?.part === 'tri_floor';
  const clip = useMemo(
    () => (noSkirt && floorPart ? [new THREE.Plane(new THREE.Vector3(0, 1, 0), -((item.floor || 0) * H - 0.3))] : undefined),
    [noSkirt, floorPart, item.floor],
  );
  if (!def) return null;
  const model = def.gameId !== undefined ? models.get(def.gameId) : undefined;
  // W 3D zawsze wygląd z gry: kolory z zakładki Kolor są tylko oznaczeniami w planie 2D.
  const color = model?.color || def.color;

  return (
    <group
      position={[item.x * SCALE, (item.floor || 0) * H + pieceY(def, model), item.y * SCALE]}
      rotation={[0, (-item.rotation * Math.PI) / 180, 0]}
    >
      <MemoPiece
        def={def}
        model={model}
        color={color}
        clip={clip}
        highlight={isTargeted ? 'target' : isSelected ? 'selected' : undefined}
        itemId={item.id}
      />
      {def.shape === 'bed' && showBedAreas && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[27 - 0.15, 27, 96]} />
          <meshBasicMaterial color="#8dc46f" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// --- Wiele struktur jednym wywołaniem rysowania ---

interface BatchGroup {
  key: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Wysokość pivotu nad poziomem piętra. */
  y: number;
  items: PlacedItem[];
}

// Materiały wspólne dla wszystkich instancji: bez podświetlenia, jak Piece.
const batchMaterials = new Map<string, THREE.MeshStandardMaterial>();

function batchMaterial(palette: boolean, color: string, metal: boolean, clipY: number | null) {
  const key = `${palette}|${color}|${metal}|${clipY}`;
  let m = batchMaterials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      vertexColors: palette,
      color: palette ? '#ffffff' : color,
      roughness: metal ? 0.55 : 0.9,
      metalness: metal ? 0.2 : 0,
      flatShading: true,
      clippingPlanes: clipY === null ? null : [new THREE.Plane(new THREE.Vector3(0, 1, 0), -clipY)],
      side: clipY === null ? THREE.FrontSide : THREE.DoubleSide,
    });
    batchMaterials.set(key, m);
  }
  return m;
}

/** Wszystkie wystąpienia jednego typu elementu jako InstancedMesh; `userData.itemIds[instanceId]` to id elementu (celowanie, wyburzanie). */
function InstancedGroup({ group, hidden, ghost = false }: { group: BatchGroup; hidden: Set<string>; ghost?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const ids: string[] = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    for (const item of group.items) {
      if (hidden.has(item.id)) continue;
      p.set(item.x * SCALE, (item.floor || 0) * H + group.y, item.y * SCALE);
      q.setFromAxisAngle(up, (-item.rotation * Math.PI) / 180);
      mesh.setMatrixAt(ids.length, m.compose(p, q, one));
      ids.push(item.id);
    }
    mesh.count = ids.length;
    // podgląd wklejania nie jest celem celownika ani podłożem
    mesh.userData = ghost ? {} : { itemIds: ids };
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [group, hidden, ghost]);

  // bez castShadow: w Unturned budowle nie rzucają cienia
  return <instancedMesh ref={ref} args={[group.geometry, group.material, group.items.length]} receiveShadow={!ghost} />;
}

const NO_IDS = new Set<string>();
const ghostMaterials = {
  ok: new THREE.MeshStandardMaterial({ color: '#8dc46f', transparent: true, opacity: 0.45, depthWrite: false, flatShading: true }),
  bad: new THREE.MeshStandardMaterial({ color: '#e5484d', transparent: true, opacity: 0.45, depthWrite: false, flatShading: true }),
};

/** Podgląd wklejanej grupy: zielone pasują, czerwone kolidują. */
function PasteGhost({ paste, models }: { paste: PasteResult; models: Models }) {
  const groups = useMemo(() => {
    const byKey = new Map<string, BatchGroup>();
    for (const item of paste.items) {
      const def = findDef(item.itemId);
      const model = def?.gameId !== undefined ? models.get(def.gameId) : undefined;
      if (!def || !model) continue;
      const bad = paste.invalid.has(item.id);
      const key = `${def.id}|${bad}`;
      let g = byKey.get(key);
      if (!g) byKey.set(key, (g = { key, geometry: model.geometry, material: ghostMaterials[bad ? 'bad' : 'ok'], y: pieceY(def, model), items: [] }));
      g.items.push(item);
    }
    return [...byKey.values()];
  }, [paste, models]);
  return (
    <>
      {groups.map((g) => (
        <InstancedGroup key={`${g.key}-${g.items.length}`} group={g} hidden={NO_IDS} ghost />
      ))}
    </>
  );
}

/**
 * Postawione elementy: jedno wywołanie rysowania na typ (zamiast jednego na element), więc duże bazy nie tną.
 * Zaznaczone i celowane elementy idą osobno przez Item3D, z podświetleniem.
 */
function Structures({
  items,
  models,
  selected,
  targetId,
  showBedAreas,
  noSkirt,
}: {
  items: PlacedItem[];
  models: Models;
  selected: string[];
  targetId: string | null;
  showBedAreas: boolean;
  noSkirt: boolean;
}) {
  const { groups, loose } = useMemo(() => {
    const byKey = new Map<string, BatchGroup>();
    const loose: PlacedItem[] = [];
    for (const item of items) {
      const def = findDef(item.itemId);
      const model = def?.gameId !== undefined ? models.get(def.gameId) : undefined;
      if (!def || !model) {
        loose.push(item);
        continue;
      }
      const floorPart = def.part === 'floor' || def.part === 'tri_floor';
      // skybase: fundament podłogi przycięty płaszczyzną na wysokości jej piętra
      const clipY = noSkirt && floorPart ? (item.floor || 0) * H - 0.3 : null;
      const key = `${def.id}|${clipY}`;
      let g = byKey.get(key);
      if (!g) {
        const palette = model.hasColors;
        const material = batchMaterial(palette, model.color || def.color, def.material === 'metal', clipY);
        byKey.set(key, (g = { key, geometry: model.geometry, material, y: pieceY(def, model), items: [] }));
      }
      g.items.push(item);
    }
    return { groups: [...byKey.values()], loose };
  }, [items, models, noSkirt]);

  const hidden = useMemo(() => new Set(targetId ? [...selected, targetId] : selected), [selected, targetId]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const special = [...hidden].map((id) => byId.get(id)).filter((i): i is PlacedItem => !!i && !loose.includes(i));

  return (
    <>
      {groups.map((g) => (
        <InstancedGroup key={`${g.key}-${g.items.length}`} group={g} hidden={hidden} />
      ))}
      {[...loose, ...special].map((item) => (
        <Item3D
          key={item.id}
          item={item}
          models={models}
          isSelected={selected.includes(item.id)}
          isTargeted={targetId === item.id}
          noSkirt={noSkirt}
        />
      ))}
      {showBedAreas &&
        items
          .filter((i) => findDef(i.itemId)?.shape === 'bed')
          .map((i) => (
            <mesh key={i.id} position={[i.x * SCALE, (i.floor || 0) * H + TOP + 0.05, i.y * SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[27 - 0.15, 27, 96]} />
              <meshBasicMaterial color="#8dc46f" transparent opacity={0.7} depthWrite={false} />
            </mesh>
          ))}
    </>
  );
}

/** Id elementu trafionego promieniem: zwykła siatka (itemId) albo instancja z partii (itemIds[instanceId]). */
function hitItemId(hit: THREE.Intersection): string | null {
  const d = hit.object.userData;
  return (d.itemId as string | undefined) ?? (hit.instanceId !== undefined ? (d.itemIds?.[hit.instanceId] as string | undefined) : undefined) ?? null;
}

// --- Teren mapy z gry ---

/**
 * Środek obszaru obiektów mapy (współrzędne sceny): podąża za kamerą skokami co CHUNK metrów.
 * Histereza: bez skakania na granicy.
 */
function useChunkCenter(): [number, number] {
  const camera = useThree((s) => s.camera);
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  useFrame(() => {
    const { x, z } = camera.position;
    if (Math.abs(x - center[0]) < CHUNK * 0.75 && Math.abs(z - center[1]) < CHUNK * 0.75) return;
    setCenter([Math.round(x / CHUNK) * CHUNK, Math.round(z / CHUNK) * CHUNK]);
  });
  return center;
}

/** Podgląd satelity całej mapy: tylko stary eksport bez tekstur terenu. */
function useOverviewTexture(meta: MapData['meta']) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (meta.terrain) return;
    let alive = true;
    new THREE.TextureLoader().load(mapOverviewUrl(meta.id), (tex) => {
      if (!alive) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      setTexture(tex);
    });
    return () => {
      alive = false;
    };
  }, [meta.id, meta.terrain]);
  return texture;
}

/** Teren, drogi i obiekty mapy wokół kamery. */
function MapSurroundings({ site, map }: { site: Site; map: MapData }) {
  const center = useChunkCenter();
  const lifted = site;
  const { meta } = map;
  const mask = nearMask(meta, TILE);
  // Tekstury terenu z gry (splatmapy); bez nich (stary eksport) podgląd satelity całej mapy
  const ground = useGroundMaterial(map, lifted);
  const farGround = useGroundMaterial(map, lifted, mask);
  const overview = useOverviewTexture(meta);
  const plain = useMemo(
    () => new THREE.MeshStandardMaterial({ map: overview, color: overview ? '#ffffff' : '#3c4a2c', roughness: 1 }),
    [overview],
  );
  const farPlain = useMemo(
    () => maskedMaterial({ map: overview, color: overview ? '#ffffff' : '#3c4a2c', roughness: 1 }, mask, lifted, meta.extent, false),
    [overview, mask, lifted, meta.extent],
  );
  useEffect(() => () => plain.dispose(), [plain]);
  useEffect(() => () => farPlain.dispose(), [farPlain]);

  return (
    <>
      <NearTerrain site={lifted} map={map} material={ground ?? plain} />
      <FarTerrain site={lifted} map={map} material={farGround ?? farPlain} />
      <GameRoads site={lifted} map={map} mask={mask} visibleRadius={NEAR_RADIUS} />
      {meta.seaLevel !== null && (
        <mesh position={[0, meta.seaLevel - lifted.elevation, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[meta.extent * 2.5, meta.extent * 2.5]} />
          <meshStandardMaterial color="#2c4a5e" transparent opacity={0.78} roughness={0.15} metalness={0.1} />
        </mesh>
      )}
      <MapObjects site={site} radius={OBJECT_RADIUS} center={center} />
    </>
  );
}

const SKIRT = 4; // fartuch krawędzi kafla w dół (m): bez szpar między kaflem a dalekim terenem

/**
 * Kafel terenu (c, r) w pełnej rozdzielczości: wierzchołki dokładnie w punktach siatki wysokości gry,
 * normalne z różnic sąsiednich wysokości (te same na styku kafli, więc bez widocznych szwów).
 */
function buildTile(map: MapData, site: Site, c: number, r: number): THREE.BufferGeometry | null {
  const { cell, grid, extent } = map.meta;
  const { heights } = map;
  const half = extent / 2;
  const k = Math.round(TILE / cell);
  const gc0 = c * k, gr0 = r * k;
  const gc1 = Math.min(gc0 + k, grid - 1), gr1 = Math.min(gr0 + k, grid - 1);
  if (gc1 <= gc0 || gr1 <= gr0) return null;
  const nc = gc1 - gc0 + 1, nr = gr1 - gr0 + 1;
  const edge = 2 * (nc + nr) - 4;
  const count = nc * nr + edge;
  const pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  const h = (gr: number, gc: number) =>
    heights[Math.min(grid - 1, Math.max(0, gr)) * grid + Math.min(grid - 1, Math.max(0, gc))];
  const put = (i: number, gr: number, gc: number, drop: number) => {
    // scena: x rośnie z kolumną, z rośnie z wierszem (na południe)
    pos[i * 3] = -half + gc * cell - site.x;
    pos[i * 3 + 1] = h(gr, gc) - site.elevation - drop;
    pos[i * 3 + 2] = site.z - (half - gr * cell);
    const dx = (h(gr, gc + 1) - h(gr, gc - 1)) / (2 * cell), dz = (h(gr + 1, gc) - h(gr - 1, gc)) / (2 * cell);
    const l = Math.hypot(dx, 1, dz);
    nrm[i * 3] = -dx / l;
    nrm[i * 3 + 1] = 1 / l;
    nrm[i * 3 + 2] = -dz / l;
    uv[i * 2] = (gc * cell) / extent;
    uv[i * 2 + 1] = 1 - (gr * cell) / extent;
  };
  for (let r2 = 0; r2 < nr; r2++) for (let c2 = 0; c2 < nc; c2++) put(r2 * nc + c2, gr0 + r2, gc0 + c2, 0);

  const index: number[] = [];
  for (let r2 = 0; r2 < nr - 1; r2++) {
    for (let c2 = 0; c2 < nc - 1; c2++) {
      const a = r2 * nc + c2, b = a + 1, d = a + nc, e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  }
  // fartuch: obwód kafla powtórzony SKIRT m niżej, ściany w obie strony
  const ring: number[] = [];
  for (let c2 = 0; c2 < nc; c2++) ring.push(c2);
  for (let r2 = 1; r2 < nr; r2++) ring.push(r2 * nc + nc - 1);
  for (let c2 = nc - 2; c2 >= 0; c2--) ring.push((nr - 1) * nc + c2);
  for (let r2 = nr - 2; r2 > 0; r2--) ring.push(r2 * nc);
  const base = nc * nr;
  ring.forEach((v, i) => put(base + i, gr0 + Math.floor(v / nc), gc0 + (v % nc), SKIRT));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], a2 = base + i, b2 = base + ((i + 1) % ring.length);
    index.push(a, a2, b, b, a2, b2, a, b, a2, b, b2, a2);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

/**
 * Teren w pełnej rozdzielczości wokół kamery, w kaflach TILE x TILE m. Brakujące kafle (najbliższe najpierw)
 * dobudowują się w każdej klatce do limitu czasu, dalekie są zwalniane; dzięki temu ruch po mapie nie zacina.
 * Kafle trafiają do grupy bezpośrednio (bez Reacta), maska kafli mówi dalekiemu terenowi i drogom, gdzie już są.
 */
function NearTerrain({ site, map, material }: { site: Site; map: MapData; material: THREE.Material }) {
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);
  const tiles = useRef(new Map<number, THREE.Mesh>());
  const mat = useRef(material);

  useEffect(() => {
    mat.current = material;
    tiles.current.forEach((m) => (m.material = material));
  }, [material]);

  // inna mapa albo miejsce bazy: kafle od nowa
  useEffect(() => {
    const live = tiles.current;
    return () => {
      live.forEach((m) => {
        m.removeFromParent();
        m.geometry.dispose();
      });
      live.clear();
      const mask = nearMask(map.meta, TILE);
      mask.data.fill(0);
      mask.texture.needsUpdate = true;
    };
  }, [map, site]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const { meta } = map;
    const mask = nearMask(meta, TILE);
    const T = mask.tiles, half = meta.extent / 2;
    const live = tiles.current;
    // kamera w układzie świata gry
    const cx = camera.position.x + site.x, cz = site.z - camera.position.z;
    const dist = (key: number) => {
      const c = key % T, r = Math.floor(key / T);
      return Math.hypot(-half + (c + 0.5) * TILE - cx, half - (r + 0.5) * TILE - cz);
    };
    let changed = false;
    for (const [key, mesh] of live) {
      if (dist(key) < DROP_RADIUS) continue;
      mesh.removeFromParent();
      mesh.geometry.dispose();
      live.delete(key);
      mask.data[key] = 0;
      changed = true;
    }
    const want: { d: number; key: number }[] = [];
    const c0 = Math.max(0, Math.floor((cx - NEAR_RADIUS + half) / TILE)), c1 = Math.min(T - 1, Math.floor((cx + NEAR_RADIUS + half) / TILE));
    const r0 = Math.max(0, Math.floor((half - cz - NEAR_RADIUS) / TILE)), r1 = Math.min(T - 1, Math.floor((half - cz + NEAR_RADIUS) / TILE));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const key = r * T + c;
        if (live.has(key)) continue;
        const d = dist(key);
        if (d < NEAR_RADIUS) want.push({ d, key });
      }
    }
    want.sort((a, b) => a.d - b.d);
    const t0 = performance.now();
    for (const { key } of want) {
      if (performance.now() - t0 > TILE_BUDGET_MS) break;
      const geometry = buildTile(map, site, key % T, Math.floor(key / T));
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, mat.current);
      mesh.receiveShadow = true;
      mesh.userData = { terrain: true };
      g.add(mesh);
      live.set(key, mesh);
      mask.data[key] = 255;
      changed = true;
    }
    if (changed) mask.texture.needsUpdate = true;
  });

  return <group ref={group} />;
}

const FAR_STEP = 16; // rozdzielczość terenu całej mapy (m)

/**
 * Reszta mapy: cała mapa w niskiej rozdzielczości, budowana raz. Nad kaflami pełnej rozdzielczości
 * znika w shaderze (maska), a całość jest lekko obniżona, żeby nie przebijała przez kafle na ich krawędziach.
 */
function FarTerrain({ site, map, material }: { site: Site; map: MapData; material: THREE.Material }) {
  const { meta, heightAt } = map;

  const geometry = useMemo(() => {
    const half = meta.extent / 2;
    const n = Math.floor(meta.extent / FAR_STEP) + 1;
    const pos = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const wx = -half + c * FAR_STEP, wz = half - r * FAR_STEP;
        const k = r * n + c;
        pos.set([wx - site.x, heightAt(wx, wz) - site.elevation - 0.6, site.z - wz], k * 3);
        uv.set([c / (n - 1), 1 - r / (n - 1)], k * 2);
      }
    }
    const index = new Uint32Array((n - 1) * (n - 1) * 6);
    let i = 0;
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const a = r * n + c, b = a + 1, d = a + n, e = d + 1;
        index.set([a, d, b, b, d, e], i);
        i += 6;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeVertexNormals();
    return g;
  }, [meta.extent, site.x, site.z, site.elevation, heightAt]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}

// --- Kamera: latanie (noclip) albo chodzenie z grawitacją ---

/** Pointer lock bywa niedostępny (iframe, odmowa przeglądarki). Wtedy działamy bez niego. */
const lockState = { failed: false, listeners: new Set<() => void>() };
function markLockFailed() {
  if (lockState.failed) return;
  lockState.failed = true;
  lockState.listeners.forEach((fn) => fn());
}


/** Woda i tlen w układzie sceny: poziom wody (null = brak), przesunięcie sceny względem świata gry. */
interface WalkEnv {
  waterY: number | null;
  waterWorld: number;
  baseWorld: number;
  legacyOxygen: boolean;
}

export interface WalkStatus {
  health: number;
  oxygen: number;
  legsBroken: boolean;
  stance: Stance;
  dead: boolean;
}

function PlayerCamera({
  containerRef,
  start,
  walk,
  groundAt,
  env,
  origin,
  onStatus,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  start: [number, number, number];
  walk: boolean;
  groundAt: (x: number, z: number) => number;
  env: WalkEnv;
  /** Punkt (0,0) sceny w układzie świata gry (miejsce bazy); null bez mapy. */
  origin: { x: number; z: number } | null;
  onStatus: (s: WalkStatus) => void;
}) {
  const { camera, scene } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  // klawisze z ustawień; referencja, żeby pętla klatek nie musiała się odtwarzać po zmianie
  const binds = useKeybinds((s) => s.binds);
  const bindsRef = useRef(binds);
  useEffect(() => {
    bindsRef.current = binds;
  }, [binds]);
  const pitch = useRef(0);
  const yaw = useRef(0);
  const envRef = useRef(env);
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    envRef.current = env;
    onStatusRef.current = onStatus;
  }, [env, onStatus]);
  const toggles = useRef<('crouch' | 'prone')[]>([]);
  const phys = useRef({
    vel: new THREE.Vector3(),
    stance: 'stand' as Stance,
    eyes: EYES.stand,
    grounded: true,
    vitals: { health: 100, oxygen: 100, legsBroken: false } as Vitals,
    ox: { lastBreath: 0, lastSuffocate: 0 } as OxygenState,
    tick: 0,
    tickAcc: 0,
    dead: 0,
    lastReport: 0,
  });
  const resetVitals = () => {
    const p = phys.current;
    p.vitals = { health: 100, oxygen: 100, legsBroken: false };
    p.vel.set(0, 0, 0);
    p.stance = 'stand';
    p.dead = 0;
  };
  const report = () => {
    const p = phys.current;
    const now = performance.now();
    if (now - p.lastReport < 100) return;
    p.lastReport = now;
    onStatusRef.current({ ...p.vitals, stance: p.stance, dead: p.dead > 0 });
  };
  // ?debug w adresie: stan kamery i postaci do testów (window.__untmatica)
  useEffect(() => {
    if (!window.location.search.includes('debug')) return;
    const probe = () => {
      const p = camera.position;
      const ray = new THREE.Raycaster(new THREE.Vector3(p.x, p.y - phys.current.eyes + 0.5, p.z), new THREE.Vector3(0, -1, 0), 0, 80);
      const hits: THREE.Object3D[] = [];
      scene.traverse((o) => (o as THREE.Mesh).isMesh && hits.push(o));
      return ray.intersectObjects(hits, false).slice(0, 3).map((h) => ({ y: h.point.y, data: h.object.userData, name: h.object.type }));
    };
    (window as unknown as { __untmatica: unknown }).__untmatica = { camera, phys: phys.current, groundAt, probe };
  }, [camera, groundAt, scene]);
  // Czat: /tp na punkt mapy, /pos czyta pozycję kamery w układzie świata gry
  useEffect(() => {
    const ox = origin?.x ?? 0, oz = origin?.z ?? 0;
    registerCameraProbe(() => [camera.position.x + ox, camera.position.y + envRef.current.baseWorld, oz - camera.position.z, yaw.current]);
    const off = onSceneCommand((c) => {
      const p = phys.current;
      if (c.kind === 'tp') {
        const x = c.x - ox, z = oz - c.z;
        p.vel.set(0, 0, 0);
        if (c.y !== undefined) camera.position.set(x, c.y - envRef.current.baseWorld + 8, z + 18);
        else camera.position.set(x, groundAt(x, z) + (walk ? p.eyes + 0.5 : 12), z);
      } else if (c.kind === 'height') {
        p.vel.set(0, 0, 0);
        camera.position.y = groundAt(camera.position.x, camera.position.z) + Math.max(c.above, p.eyes);
      }
    });
    return () => {
      off();
      registerCameraProbe(null);
    };
  }, [camera, groundAt, origin, walk]);
  // Otwarta nakładka (ekwipunek, czat, menu): puszczamy wszystkie klawisze ruchu
  useEffect(() => useView3D.subscribe((s) => s.overlay !== 'none' && (keys.current = {})), []);
  // Wejście w chodzenie: pełne zdrowie, stopy na wysokości oczu kamery
  useEffect(() => {
    if (!walk) return;
    resetVitals();
    phys.current.eyes = EYES.stand;
  }, [walk]);
  const initialized = useRef(false);
  const down = useMemo(() => new THREE.Raycaster(), []);
  const ahead = useMemo(() => new THREE.Raycaster(), []);

  useEffect(() => {
    if (!initialized.current) {
      camera.position.set(start[0], start[1] + 9, start[2] + 26);
      pitch.current = -Math.atan2(9, 26);
      camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
      initialized.current = true;
    }
    const container = containerRef.current;

    const lock = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]') || lockState.failed) return;
      if (document.pointerLockElement === container || useView3D.getState().overlay !== 'none') return;
      try {
        const res = container?.requestPointerLock() as unknown as Promise<void> | undefined;
        res?.catch?.(() => markLockFailed());
      } catch {
        markLockFailed();
      }
    };
    const onLockError = () => markLockFailed();
    const keyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || useView3D.getState().overlay !== 'none') return;
      keys.current[e.code] = true;
      if (e.code === bindsRef.current.up && walk) e.preventDefault();
      if (walk && !e.repeat && e.code === bindsRef.current.crouch) toggles.current.push('crouch');
      if (walk && !e.repeat && e.code === bindsRef.current.prone) toggles.current.push('prone');
    };
    const keyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const move = (e: MouseEvent) => {
      // Bez przechwyconej myszki kamerą kręci się przeciągając prawym przyciskiem.
      if (document.pointerLockElement !== container && !(e.buttons & 2)) return;
      if (useView3D.getState().overlay !== 'none') return;
      yaw.current -= e.movementX * 0.0025;
      pitch.current = Math.max(-1.52, Math.min(1.52, pitch.current - e.movementY * 0.0025));
      camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
    };
    const blur = () => {
      keys.current = {};
    };

    container?.addEventListener('click', lock);
    document.addEventListener('pointerlockerror', onLockError);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('mousemove', move);
    window.addEventListener('blur', blur);
    return () => {
      container?.removeEventListener('click', lock);
      document.removeEventListener('pointerlockerror', onLockError);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('blur', blur);
    };
  }, [camera, start, containerRef, walk]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const k = keys.current;
    const b = bindsRef.current;
    const pos = camera.position;

    if (!walk) {
      const speed = (k[b.sprint] ? 30 : 14) * delta;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      if (k[b.forward]) pos.addScaledVector(forward, speed);
      if (k[b.back]) pos.addScaledVector(forward, -speed);
      if (k[b.left]) pos.addScaledVector(right, -speed);
      if (k[b.right]) pos.addScaledVector(right, speed);
      if (k[b.up]) pos.y += speed;
      if (k[b.down]) pos.y -= speed;
      return;
    }

    // Chodzenie jak w grze (lib/playerPhysics: PlayerMovement, PlayerStance, PlayerLife)
    const p = phys.current;
    const env = envRef.current;
    if (p.dead > 0) {
      p.dead -= delta;
      if (p.dead <= 0) {
        // powrót do miejsca startu z pełnym zdrowiem
        resetVitals();
        pos.set(start[0], groundAt(start[0], start[2]) + EYES.stand, start[2]);
      }
      report();
      return;
    }

    // Promienie tylko na struktury, obiekty mapy i drogi; wysokość terenu daje groundAt (bez siatki 74 tys. trójkątów)
    const meshes: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && (o.userData.itemId || o.userData.itemIds || o.userData.road || o.userData.mapObject)) meshes.push(o);
    });
    const solids = meshes.filter((m) => !m.userData.road && !m.userData.cutout);
    const floors = meshes.filter((m) => !m.userData.tree);

    // Kucanie i czołganie przełączane klawiszem (nie w wodzie)
    for (const toggle of toggles.current.splice(0)) {
      if (p.stance === 'swim') continue;
      p.stance = p.stance === toggle ? 'stand' : toggle;
    }

    let feet = pos.y - p.eyes;
    const waterY = env.waterY;
    const bodyUnder = waterY !== null && feet + SWIM_BODY_DEPTH < waterY;
    const eyesUnder = waterY !== null && pos.y < waterY;
    if (bodyUnder) p.stance = 'swim';
    else if (p.stance === 'swim') p.stance = 'stand';

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const wish = new THREE.Vector3();
    if (k[b.forward]) wish.add(forward);
    if (k[b.back]) wish.sub(forward);
    if (k[b.left]) wish.sub(right);
    if (k[b.right]) wish.add(right);
    if (wish.lengthSq() > 0) wish.normalize();
    // bieg tylko do przodu, na stojąco i bez złamanych nóg
    if (p.stance === 'stand' || p.stance === 'sprint') {
      p.stance = k[b.sprint] && k[b.forward] && !p.vitals.legsBroken ? 'sprint' : 'stand';
    }
    const speed = SPEED[p.stance] * (p.stance === 'swim' ? SWIM_MULTIPLIER : 1);
    const v = p.vel;
    let vyStart: number | null = null;

    // Grunt pod stopami: najwyższa powierzchnia do 0.5 m nad stopami (stopnie, drogi) albo teren
    const groundUnder = (x: number, y: number, z: number) => {
      down.set(new THREE.Vector3(x, y + 0.5, z), new THREE.Vector3(0, -1, 0));
      down.far = 80;
      const hit = down.intersectObjects(floors, false)[0];
      const terrain = groundAt(x, z);
      return hit && hit.point.y > terrain ? { y: hit.point.y, terrain: false } : { y: terrain, terrain: true };
    };
    const g = groundUnder(pos.x, feet, pos.z);
    const wasGrounded = p.grounded;
    // PlayerLife.onLanded: przy przejściu z powietrza na ziemię szybciej niż 22 m/s obrażenia = min(101, |v|) i złamane nogi
    const land = (vy: number) => {
      if (vy < -FALL_DAMAGE_SPEED && p.stance !== 'swim') {
        p.vitals.health = Math.max(0, p.vitals.health - Math.round(Math.min(FALL_DAMAGE_MAX, -vy)));
        p.vitals.legsBroken = true;
      }
    };
    p.grounded = p.stance !== 'swim' && feet <= g.y + 0.05 && v.y <= 0;
    if (p.grounded && !wasGrounded) land(v.y);

    if (p.stance === 'swim') {
      if (eyesUnder) {
        // pod wodą: ruch w stronę patrzenia, spacja w górę
        const look = new THREE.Vector3();
        camera.getWorldDirection(look);
        const dir = new THREE.Vector3();
        if (k[b.forward]) dir.add(look);
        if (k[b.back]) dir.sub(look);
        if (k[b.left]) dir.sub(right);
        if (k[b.right]) dir.add(right);
        if (dir.lengthSq() > 0) dir.normalize();
        v.copy(dir.multiplyScalar(speed));
        if (k[b.up]) v.y = SWIM_UP_SPEED;
      } else {
        // na powierzchni: ciało 1.275 m pod lustrem wody
        v.set(wish.x * speed, (waterY! - SWIM_SURFACE_OFFSET - feet) / 8, wish.z * speed);
      }
    } else if (p.grounded) {
      // zbocze stromsze niż 59°: zsuwanie zamiast chodzenia
      const e = 1;
      const n = g.terrain
        ? new THREE.Vector3(groundAt(pos.x - e, pos.z) - groundAt(pos.x + e, pos.z), 2 * e, groundAt(pos.x, pos.z - e) - groundAt(pos.x, pos.z + e)).normalize()
        : new THREE.Vector3(0, 1, 0);
      const steep = (Math.acos(Math.min(1, n.y)) * 180) / Math.PI > MAX_SLOPE_DEG;
      if (steep) {
        v.x += n.x * SLIDE_ACCEL * delta;
        v.z += n.z * SLIDE_ACCEL * delta;
        v.y = 0;
      } else {
        v.set(wish.x * speed, 0, wish.z * speed);
        if (k[b.up] && (p.stance === 'stand' || p.stance === 'sprint') && !p.vitals.legsBroken) {
          v.y = JUMP_SPEED;
          p.grounded = false;
        }
      }
    } else {
      vyStart = v.y;
      v.y = Math.max(v.y - GRAVITY * delta, -TERMINAL_VELOCITY);
      // sterowanie w powietrzu: przyspieszenie 8 * prędkość, wyhamowanie 2 m/s^2
      const h = new THREE.Vector2(v.x, v.z);
      const target = speed;
      const maxMag = h.length() > target ? Math.max(target, h.length() - AIR_DECEL * delta) : target;
      h.add(new THREE.Vector2(wish.x, wish.z).multiplyScalar(speed * AIR_ACCEL * delta));
      if (h.length() > maxMag) h.setLength(maxMag);
      v.x = h.x;
      v.z = h.y;
    }

    // Ruch poziomy z kolizjami: promienie na wysokości kolan i klatki, ślizganie po ścianie
    const height = HEIGHT[p.stance];
    const blocked = (dx: number, dz: number) => {
      const d = Math.hypot(dx, dz);
      if (d < 1e-5) return false;
      const dir = new THREE.Vector3(dx / d, 0, dz / d);
      for (const hgt of [0.55, Math.max(0.6, height - 0.3)]) {
        ahead.set(new THREE.Vector3(pos.x, feet + hgt, pos.z), dir);
        ahead.far = d + RADIUS;
        if (ahead.intersectObjects(solids, false).length > 0) return true;
      }
      return false;
    };
    const dx = v.x * delta, dz = v.z * delta;
    if (!blocked(dx, dz)) {
      pos.x += dx;
      pos.z += dz;
    } else if (!blocked(dx, 0)) {
      pos.x += dx;
      v.z = 0;
    } else if (!blocked(0, dz)) {
      pos.z += dz;
      v.x = 0;
    } else {
      v.x = v.z = 0;
    }

    // Ruch pionowy i lądowanie (PlayerLife.onLanded: > 22 m/s = obrażenia i złamane nogi)
    const g2 = groundUnder(pos.x, feet, pos.z);
    feet += ((vyStart ?? v.y) + v.y) / 2 * delta;
    if (feet <= g2.y) {
      if (!p.grounded) land(v.y);
      feet = g2.y;
      if (v.y < 0) v.y = 0;
      if (p.stance !== 'swim') p.grounded = true;
    }

    p.eyes += (EYES[p.stance] - p.eyes) * Math.min(1, EYES_LERP * delta);
    pos.y = feet + p.eyes;

    // Tlen w tikach symulacji gry (co 0.08 s)
    p.tickAcc += delta;
    while (p.tickAcc >= TICK) {
      p.tickAcc -= TICK;
      p.tick++;
      const breath = eyesUnder ? -1 : breathAtHeight(feet + env.baseWorld, env.waterWorld, env.legacyOxygen);
      oxygenTick(p.tick, breath, p.vitals, p.ox);
    }
    if (p.vitals.health <= 0 && p.dead <= 0) p.dead = 3;
    report();
  });

  return null;
}

// --- Celowanie: stawianie, wyburzanie, malowanie (sandbox bez wyboru piętra) ---

interface Aim {
  preview: PlacedItem | null;
  valid: boolean;
  targetId: string | null;
  /** Poziom powierzchni, na którą celujemy (wysokość / 4,5 m od punktu odniesienia). */
  surface: number | null;
  /** Wysokość tej powierzchni nad terenem (m). */
  above: number | null;
  /** Podgląd wklejania w 3D. */
  paste: PasteResult | null;
  /** Element w celowniku (podpowiedź o chwytaniu bazy). */
  lookId: string | null;
  reason?: AimReason;
  warn?: AimWarn;
}

/** Limity wysokości w układzie sceny (y = 0 to poziom bazy). Patrz docs/sky-limits.md. */
export interface SceneLimits {
  limitY: number;
  oxygenY: number | null;
  /** Czy punkt sceny leży w strefie zakazu budowy (PlayerClipVolume). */
  inClip: (x: number, y: number, z: number) => boolean;
  /** SafezoneVolume z No_Buildables. */
  inSafezone: (x: number, y: number, z: number) => boolean;
  /** LevelPlayers.checkCanBuild: za blisko spawnu graczy. */
  nearSpawn: (x: number, y: number, z: number) => boolean;
  /** Wysokość terenu w układzie sceny (null bez mapy). */
  groundY: ((x: number, z: number) => number) | null;
  /** Use_Underground_Whitelist: pod terenem nie wolno budować. */
  undergroundBlocked: boolean;
}

const EMPTY_AIM: Aim = { preview: null, valid: false, targetId: null, surface: null, above: null, paste: null, lookId: null };

/** Siatki postawionych struktur (do celowania i kolizji). */
function structureMeshes(scene: THREE.Scene) {
  const out: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && (o.userData.itemId || o.userData.itemIds)) out.push(o);
  });
  return out;
}

/** Promień do sprawdzania gruntu pod podłogą (wspólny, poza Reactem). */
const groundProbe = new THREE.Raycaster();

const AIM_RANGE = 120; // m: dalej celownik nic nie stawia
const AIR_DROP = 2.5; // m pod kamerą: płaszczyzna dla dachów stawianych w powietrzu
const TRI_FORWARD = 1.2679492; // UseableHousingUtils: wolna podłoga trójkątna przesunięta do przodu

interface AimHit {
  point: THREE.Vector3;
  distance: number;
  /** Teren i duże obiekty mapy liczą się jako grunt (DoesHitCountAsTerrain), struktury nie. */
  ground: boolean;
}

/** Trafienie w teren z siatki wysokości: marsz co 1 m i dokładniej bisekcją. */
function marchTerrain(ray: THREE.Ray, groundAt: (x: number, z: number) => number, max: number): AimHit | null {
  const p = new THREE.Vector3();
  if (ray.origin.y < groundAt(ray.origin.x, ray.origin.z)) return null;
  let prev = 0;
  for (let d = 1; d <= max; d += 1) {
    ray.at(d, p);
    if (p.y <= groundAt(p.x, p.z)) {
      let lo = prev, hi = d;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        ray.at(mid, p);
        if (p.y <= groundAt(p.x, p.z)) hi = mid;
        else lo = mid;
      }
      ray.at(hi, p);
      return { point: p.clone(), distance: hi, ground: true };
    }
    prev = d;
  }
  return null;
}

/** Punkt zaczepienia schowka (jak computePaste): płyta z najniższego poziomu. */
function pasteRef(clip: PlacedItem[]) {
  const minFloor = Math.min(...clip.map((i) => i.floor || 0));
  return clip.find((i) => sameLevel(i.floor || 0, minFloor) && isSlab(findDef(i.itemId))) ?? clip[0];
}

function AimController({
  containerRef,
  activeDef,
  items,
  limits,
  groundAt,
  turn,
  paste,
  onAim,
  onPlace,
  onDelete,
  onPaste,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeDef?: BuildItem;
  items: PlacedItem[];
  limits: SceneLimits;
  /** Wysokość terenu w układzie sceny (mapa albo łąka). */
  groundAt: (x: number, z: number) => number;
  turn: number;
  /** Wklejanie w 3D: schowek i liczba obrotów o 90°. */
  paste: { clip: PlacedItem[]; turn: number; move?: boolean } | null;
  onAim: (aim: Aim) => void;
  onPlace: (item: Omit<PlacedItem, 'id'>) => void;
  onDelete: (id: string) => void;
  onPaste: (items: PlacedItem[]) => void;
}) {
  const { camera, scene } = useThree();
  const aimRef = useRef<Aim>(EMPTY_AIM);
  const lastKey = useRef('');
  const pasteCache = useRef<{ key: string; res: PasteResult | null }>({ key: '', res: null });

  /** Zasady z gry dla punktu stawiania (UseableHousingUtils, HousingConnections). */
  const gameRule = (def: BuildItem, preview: PlacedItem, surface: number): AimReason | undefined => {
    const px = preview.x * SCALE, pz = preview.y * SCALE;
    const base = surface * H;
    if (limits.inSafezone(px, base + 1, pz)) return 'safezone';
    if (limits.nearSpawn(px, base + 1, pz)) return 'spawn';
    if (wallMissingPillars(def, preview, items)) return 'missingPillar';
    if (!limits.groundY) return undefined;
    if (isFloorPart(def)) {
      // IsFloorAboveGround: teren albo duży obiekt mapy najwyżej 10 m pod środkiem podłogi
      let ground = limits.groundY(px, pz);
      groundProbe.set(new THREE.Vector3(px, base + 1, pz), new THREE.Vector3(0, -1, 0));
      groundProbe.far = 11;
      const objs: THREE.Object3D[] = [];
      scene.traverse((o) => (o as THREE.Mesh).isMesh && o.userData.mapObject && !o.userData.tree && objs.push(o));
      const hit = groundProbe.intersectObjects(objs, false)[0];
      if (hit) ground = Math.max(ground, hit.point.y);
      if (ground < base - 10) return 'missingGround';
    } else if (limits.undergroundBlocked && def.shape !== 'bed' && def.shape !== 'hatch') {
      // UndergroundAllowlist: element w całości pod terenem
      const r = (preview.rotation * Math.PI) / 180;
      const pts = def.shape === 'wall'
        ? [-3, 0, 3].map((o) => [px + o * Math.cos(r), pz + o * Math.sin(r)])
        : [[px, pz]];
      // ściany i filary sięgają poziom wyżej, dachy leżą na górze swojego poziomu
      const topY = def.shape === 'wall' || def.shape === 'pillar' || isRoofLayer(def) ? base + H : base;
      if (pts.every(([x, z]) => topY < limits.groundY!(x, z))) return 'underground';
    }
    return undefined;
  };

  /** Limity mapy (wysokość, strefy zakazu, tlen) i zasady gry dla gotowego podglądu. */
  const judge = (def: BuildItem, preview: PlacedItem, surface: number, valid: boolean, warn?: AimWarn): Aim => {
    const px = preview.x * SCALE, pz = preview.y * SCALE;
    const top = surface * H + H;
    let reason: AimReason | undefined;
    if (top > limits.limitY) reason = 'mapLimit';
    else if (limits.inClip(px, surface * H + 1, pz)) reason = 'noBuildZone';
    else reason = gameRule(def, preview, preview.floor || 0);
    if (!reason && !warn && limits.oxygenY !== null && top > limits.oxygenY) warn = 'oxygen';
    return { ...EMPTY_AIM, preview, valid: valid && !reason, surface, above: surface * H - groundAt(px, pz), reason, warn };
  };

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const center = useMemo(() => new THREE.Vector2(0, 0), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  useFrame(() => {
    raycaster.setFromCamera(center, camera);
    const ray = raycaster.ray;
    let next: Aim = EMPTY_AIM;
    const structureHit = raycaster.intersectObjects(structureMeshes(scene), false).find((h) => h.distance < 90);
    const lookId = structureHit ? hitItemId(structureHit) : null;
    if (useView3D.getState().lookId !== lookId) useView3D.setState({ lookId });

    if (!activeDef && !paste) {
      next = { ...EMPTY_AIM, lookId };
    } else if (activeDef?.shape === 'remover' && !paste) {
      next = { ...EMPTY_AIM, targetId: structureHit ? hitItemId(structureHit) : null };
    } else {
      // Najbliższe trafienie: struktura, obiekt mapy albo teren
      const hits: AimHit[] = [];
      if (structureHit) hits.push({ point: structureHit.point, distance: structureHit.distance, ground: false });
      const objs: THREE.Object3D[] = [];
      scene.traverse((o) => (o as THREE.Mesh).isMesh && o.userData.mapObject && !o.userData.tree && objs.push(o));
      const objHit = raycaster.intersectObjects(objs, false).find((h) => h.distance < AIM_RANGE);
      if (objHit) hits.push({ point: objHit.point, distance: objHit.distance, ground: true });
      const terrainHit = marchTerrain(ray, groundAt, AIM_RANGE);
      if (terrainHit) hits.push(terrainHit);
      hits.sort((a, b) => a.distance - b.distance);
      const nearest = hits.find((h) => h.distance < AIM_RANGE) ?? null;
      // W powietrzu: płaszczyzna kawałek pod kamerą (stawianie skybase'a)
      const airPoint = () => {
        const p = new THREE.Vector3();
        const hit = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(camera.position.y - AIR_DROP)), p);
        return hit && camera.position.distanceTo(p) < 60 ? p : null;
      };
      const yawDeg = THREE.MathUtils.radToDeg(euler.setFromQuaternion(camera.quaternion).y);

      if (paste) {
        const point = nearest?.point ?? airPoint();
        if (point) {
          const ref = pasteRef(paste.clip);
          const refDef = findDef(ref.itemId);
          const floor = roundLevel(point.y / H - (isRoofLayer(refDef) ? 1 : 0));
          const cursor = { x: point.x / SCALE, y: point.z / SCALE };
          // wklejanie dużych baz jest kosztowne: liczymy tylko po przesunięciu celownika
          const key = `${Math.round(cursor.x)},${Math.round(cursor.y)},${floor.toFixed(2)},${paste.turn},${items.length}`;
          if (pasteCache.current.key !== key) {
            pasteCache.current = { key, res: computePaste({ clip: paste.clip, items, cursor, floor, turn: paste.turn, free: true }) };
          }
          const res = pasteCache.current.res;
          if (res) next = { ...EMPTY_AIM, paste: res, valid: res.valid, surface: floor, above: point.y - groundAt(point.x, point.z) };
        }
      } else if (activeDef) {
        const def = activeDef;
        const ray3 = { origin: { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z }, dir: { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z } };
        // Ściany i filary jak w grze: wolny slot najbliżej celownika (do 8 m), nawet gdy promień trafia w pustkę.
        const slot = findSlotByRay(def, items, ray3, turn);
        if (slot) {
          next = judge(def, slot, slot.floor || 0, isPlacementValid(def, slot, items));
        } else if (isSlab(def)) {
          const roofLike = isRoofLayer(def);
          // Podłogi i dachy: wolne miejsce przy krawędzi najbliżej celownika (FindEmptyFloorSlot)
          const slab = findSlabSlotByRay(def, items, ray3, turn);
          if (slab?.preview) {
            next = judge(def, slab.preview, (slab.preview.floor || 0) + (roofLike ? 1 : 0), slab.valid);
          } else if (roofLike) {
            // Dach tylko przy krawędzi płyty albo ściany (FindEmptyFloorSlot z isRoof); bez niej gra nic nie pokazuje
            next = { ...EMPTY_AIM, reason: 'roofSupport' };
          } else if (nearest) {
            // Wolna podłoga: w punkcie trafienia na gruncie, obrót z kierunku patrzenia (jak w grze)
            const point = nearest.point.clone();
            const triangle = def.shape === 'triangle';
            const yaw = THREE.MathUtils.degToRad(yawDeg);
            if (triangle) point.add(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(TRI_FORWARD));
            const floor = roundLevel(point.y / H);
            const preview: PlacedItem = {
              id: 'preview',
              itemId: def.id,
              x: Math.round((point.x / SCALE) * 100) / 100,
              y: Math.round((point.z / SCALE) * 100) / 100,
              floor,
              rotation: Math.round(normalizeAngle(-yawDeg + (triangle ? 0 : turn * 90)) * 10) / 10,
            };
            const aim = judge(def, preview, floor, isPlacementValid(def, preview, items));
            // DoesHitCountAsTerrain: na strukturze bez krawędzi podłoga nie stanie
            next = nearest.ground ? aim : { ...aim, valid: false, reason: 'missingGround' };
          }
        } else if (def.shape === 'bed' && nearest) {
          // Łóżko (barykada): w punkcie trafienia, obrócone jak gracz
          const floor = roundLevel((nearest.point.y - TOP) / H);
          const preview: PlacedItem = {
            id: 'preview',
            itemId: def.id,
            x: Math.round((nearest.point.x / SCALE) * 100) / 100,
            y: Math.round((nearest.point.z / SCALE) * 100) / 100,
            floor,
            rotation: Math.round(normalizeAngle(-yawDeg + turn * 90) * 10) / 10,
          };
          next = judge(def, preview, floor, isPlacementValid(def, preview, items));
        } else if (def.shape === 'hatch' && nearest) {
          // Klapa: w otworze dachu najbliżej trafienia
          const floor = (nearest.point.y - TOP) / H - 1;
          const res = computePlacement({ def, items, cursor: { x: nearest.point.x / SCALE, y: nearest.point.z / SCALE }, floor, turn, free: false });
          if (res.preview) next = judge(def, res.preview, (res.preview.floor || 0) + 1, res.valid);
        }
      }
    }

    aimRef.current = next;
    const p = next.preview;
    const key = `${next.targetId}|${next.lookId}|${next.valid}|${next.surface}|${next.reason}|${next.warn}|${p ? `${p.itemId},${p.x},${p.y},${p.rotation},${p.floor}` : ''}|${pasteCache.current.key}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      onAim(next);
    }
  });

  // /skybase: gracz na wysokości, na której pod limitem mapy mieści się jedno piętro, i jeden dach startowy pod nim
  useEffect(
    () =>
      onSceneCommand((c) => {
        if (c.kind !== 'skybase') return;
        const surface = Math.floor(((limits.limitY - H) / H) * 1000) / 1000;
        const yawDeg = THREE.MathUtils.radToDeg(new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(camera.quaternion).y);
        const { x, z } = camera.position;
        onPlace({
          itemId: c.itemId,
          x: Math.round((x / SCALE) * 100) / 100,
          y: Math.round((z / SCALE) * 100) / 100,
          floor: roundLevel(surface - 1),
          rotation: Math.round(normalizeAngle(-yawDeg) * 10) / 10,
        });
        camera.position.set(x, surface * H + TOP + EYES.stand, z);
      }),
    [camera, limits, onPlace],
  );

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (e.button !== 0 || useView3D.getState().overlay !== 'none') return;
      // Pierwszy klik tylko przejmuje kamerę; przy przechwyconej myszce target to kontener, nie canvas.
      const locked = document.pointerLockElement === containerRef.current;
      const fallback = lockState.failed && e.target instanceof HTMLCanvasElement;
      if (!locked && !fallback) return;
      const aim = aimRef.current;
      if (paste) {
        if (aim.paste?.valid) onPaste(aim.paste.items);
      } else if (activeDef?.shape === 'remover') {
        if (aim.targetId) onDelete(aim.targetId);
      } else if (activeDef) {
        if (aim.preview && aim.valid) {
          const { itemId, x, y, rotation, floor: f } = aim.preview;
          onPlace({ itemId, x, y, rotation, floor: f });
        }
      }
    };
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, [activeDef, paste, onPlace, onDelete, onPaste, containerRef]);

  return null;
}

// --- Komponent główny ---

interface Builder3DProps {
  placedItems: PlacedItem[];
  activeItem: string | null;
  turn: number;
  showBedAreas: boolean;
  selectedItemIds: string[];
  scene?: SceneSettings;
  site?: Site;
  /** Wklejanie schowka w 3D (Ctrl+V) albo przenoszenie bazy (G, move): grupa i liczba obrotów o 90°. */
  paste?: { clip: PlacedItem[]; turn: number; move?: boolean } | null;
  onPlaceItem: (item: Omit<PlacedItem, 'id'>) => void;
  onDeleteItem: (id: string) => void;
  onPaste?: (items: PlacedItem[]) => void;
}

const noPaste = () => {};

export default function Builder3D({
  placedItems,
  activeItem,
  turn,
  showBedAreas,
  selectedItemIds,
  scene = DEFAULT_SCENE,
  site,
  paste = null,
  onPlaceItem,
  onDeleteItem,
  onPaste = noPaste,
}: Builder3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const models = useGameModels();
  const t = useT();
  const binds = useKeybinds((s) => s.binds);
  const flyKeyRef = useRef(binds.toggleFly);
  useEffect(() => {
    flyKeyRef.current = binds.toggleFly;
  }, [binds.toggleFly]);
  const [aim, setAim] = useState<Aim>(EMPTY_AIM);
  const [locked, setLocked] = useState(false);
  const [walk, setWalk] = useState(false);
  const [lockFailed, setLockFailed] = useState(lockState.failed);
  const [map, setMap] = useState<MapData | null>(null);
  const overlay = useView3D((s) => s.overlay);
  const activeDef = activeItem ? findDef(activeItem) : undefined;
  const isDemolish = activeDef?.shape === 'remover';
  const siteMap = site?.map;
  const night = scene.time === 'night';

  useEffect(() => {
    let alive = true;
    if (!siteMap) return;
    loadMap(siteMap)
      .then((m) => alive && setMap(m))
      .catch(() => alive && setMap(null));
    return () => {
      alive = false;
    };
  }, [siteMap]);

  useEffect(() => {
    const onFail = () => setLockFailed(true);
    lockState.listeners.add(onFail);
    registerContainer(containerRef.current);
    let wasLocked = false;
    const onChange = () => {
      const now = document.pointerLockElement === containerRef.current;
      setLocked(now);
      // Esc oddaje kursor bez zdarzenia klawisza: jak w grze otwieramy menu pauzy
      const view = useView3D.getState();
      if (wasLocked && !now && view.overlay === 'none') view.setOverlay('menu');
      wasLocked = now;
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || useView3D.getState().overlay !== 'none') return;
      if (e.code === flyKeyRef.current) setWalk((w) => !w);
    };
    const off = onSceneCommand((c) => c.kind === 'fly' && setWalk(!c.on));
    document.addEventListener('pointerlockchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      off();
      registerContainer(null);
      useView3D.getState().setOverlay('none');
      lockState.listeners.delete(onFail);
      document.removeEventListener('pointerlockchange', onChange);
      window.removeEventListener('keydown', onKey);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, []);

  // Środek bazy liczony raz przy wejściu w 3D (kamera startuje przed bazą); bez elementów: punkt startu (spawn)
  const [start] = useState<[number, number, number]>(() => {
    if (placedItems.length === 0) return [0, 0, 0];
    const xs = placedItems.map((i) => i.x * SCALE);
    const zs = placedItems.map((i) => i.y * SCALE);
    const y = Math.min(...placedItems.map((i) => (i.floor || 0) * H));
    return [(Math.min(...xs) + Math.max(...xs)) / 2, y, (Math.min(...zs) + Math.max(...zs)) / 2];
  });

  const activeMap = site && map && map.meta.id === site.map ? map : null;

  // Limity wysokości (docs/sky-limits.md). Bez mapy: teren i woda na 0 m.
  const limits = useMemo<SceneLimits>(() => {
    const meta = activeMap?.meta;
    const baseWorld = site && activeMap ? site.elevation : 0;
    const sea = meta?.seaLevel ?? 0;
    const oxygenWorld = meta ? (meta.oxygen === false ? null : meta.oxygenLine ?? sea + (1024 - sea) / 2) : 512;
    const boxes = (meta?.clipVolumes ?? []).map((v) => ({
      p: new THREE.Vector3(v.p[0], v.p[1], v.p[2]),
      inv: new THREE.Quaternion(v.r[0], v.r[1], v.r[2], v.r[3]).invert(),
      half: new THREE.Vector3(v.s[0] / 2, v.s[1] / 2, v.s[2] / 2),
    }));
    const tmp = new THREE.Vector3();
    const nb = meta?.noBuild;
    const safezones = (nb?.safezones ?? []).map((v) => ({
      shape: v.shape,
      p: new THREE.Vector3(v.p[0], v.p[1], v.p[2]),
      inv: new THREE.Quaternion(v.r[0], v.r[1], v.r[2], v.r[3]).invert(),
      half: new THREE.Vector3(v.s[0] / 2, v.s[1] / 2, v.s[2] / 2),
    }));
    const spawnR2 = (nb?.spawnRadius ?? 16) ** 2;
    const world = (x: number, y: number, z: number) => [site!.x + x, y + baseWorld, site!.z - z] as const;
    return {
      inSafezone: (x, y, z) => {
        if (!site || safezones.length === 0) return false;
        const [wx, wy, wz] = world(x, y, z);
        return safezones.some((s) => {
          tmp.set(wx - s.p.x, wy - s.p.y, wz - s.p.z);
          if (s.shape === 'sphere') return tmp.length() <= s.half.x;
          if (s.shape === 'cylinder') return Math.hypot(tmp.x, tmp.z) <= s.half.x;
          tmp.applyQuaternion(s.inv);
          return Math.abs(tmp.x) <= s.half.x && Math.abs(tmp.y) <= s.half.y && Math.abs(tmp.z) <= s.half.z;
        });
      },
      nearSpawn: (x, y, z) => {
        if (!site || !nb) return false;
        const [wx, wy, wz] = world(x, y, z);
        return nb.spawns.some((sp) => (sp[0] - wx) ** 2 + (sp[1] - wy) ** 2 + (sp[2] - wz) ** 2 < spawnR2);
      },
      groundY: site && activeMap ? (x, z) => activeMap.heightAt(site.x + x, site.z - z) - baseWorld : null,
      undergroundBlocked: !!nb?.undergroundBlocked,
      limitY: (meta?.heightLimit ?? 1024) - baseWorld,
      oxygenY: oxygenWorld === null ? null : oxygenWorld - baseWorld,
      inClip: (x, y, z) => {
        if (!site || boxes.length === 0) return false;
        // Punkt sceny -> świat gry (Unity): z_świata = site.z - z_sceny.
        for (const b of boxes) {
          tmp.set(site.x + x - b.p.x, y + baseWorld - b.p.y, site.z - z - b.p.z).applyQuaternion(b.inv);
          if (Math.abs(tmp.x) <= b.half.x && Math.abs(tmp.y) <= b.half.y && Math.abs(tmp.z) <= b.half.z) return true;
        }
        return false;
      },
    };
  }, [activeMap, site]);
  // Woda i tlen dla chodzenia: poziom wody w układzie sceny, przesunięcie sceny względem świata gry
  const walkEnv = useMemo(() => {
    const meta = activeMap?.meta;
    const baseWorld = site && activeMap ? site.elevation : 0;
    const sea = meta?.seaLevel ?? null;
    return {
      waterY: sea === null ? null : sea - baseWorld,
      waterWorld: sea ?? 0,
      baseWorld,
      legacyOxygen: meta ? meta.oxygen !== false : true,
    };
  }, [activeMap, site]);
  const [walkStatus, setWalkStatus] = useState<WalkStatus | null>(null);
  const groundAt = useMemo(() => {
    if (site && activeMap) return (x: number, z: number) => activeMap.heightAt(site.x + x, site.z - z) - site.elevation;
    return meadowHeight;
  }, [site, activeMap]);
  // Oświetlenie mapy z gry (Lighting.dat) dla wybranej pory dnia
  const lighting = useMemo(
    () => (activeMap?.meta.lighting ? resolveLighting(activeMap.meta.lighting, scene.time) : null),
    [activeMap, scene.time],
  );

  const origin = useMemo(() => (site && activeMap ? { x: site.x, z: site.z } : null), [site, activeMap]);
  // Przenoszona baza wisi w celowniku: na starym miejscu jej nie ma i nie koliduje sama ze sobą
  const shownItems = useMemo(() => {
    if (!paste?.move) return placedItems;
    const moving = new Set(paste.clip.map((i) => i.id));
    return placedItems.filter((i) => !moving.has(i.id));
  }, [placedItems, paste]);

  const ghostDef = aim.preview ? findDef(aim.preview.itemId) : undefined;
  const ghostModel = ghostDef?.gameId !== undefined ? models.get(ghostDef.gameId) : undefined;
  const targeting = isDemolish;

  return (
    <div ref={containerRef} className={styles.container}>
      <Canvas
        shadows="percentage"
        camera={{ fov: 72, near: 0.1, far: 5000 }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
      >
        <SkyAndLight time={scene.time} focus={start} lighting={lighting} />
        {night && <pointLight position={[start[0], start[1] + 7, start[2]]} intensity={70} distance={60} color="#ffb070" />}

        <PlayerCamera containerRef={containerRef} start={start} walk={walk} groundAt={groundAt} env={walkEnv} origin={origin} onStatus={setWalkStatus} />
        <AimController
          containerRef={containerRef}
          activeDef={activeDef}
          items={shownItems}
          limits={limits}
          groundAt={groundAt}
          turn={turn}
          paste={paste}
          onAim={setAim}
          onPlace={onPlaceItem}
          onDelete={onDeleteItem}
          onPaste={onPaste}
        />

        {site && activeMap ? (
          <MapSurroundings site={site} map={activeMap} />
        ) : (
          <Meadow lift={0} night={night} />
        )}

        {/* Limity wysokości mapy: czerwony twardy limit, pomarańczowa granica tlenu */}
        {limits.limitY < 1500 && (
          <mesh position={[start[0], limits.limitY, start[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[700, 700]} />
            <meshBasicMaterial color="#e5484d" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} fog={false} />
          </mesh>
        )}
        {limits.oxygenY !== null && limits.oxygenY < 1500 && (
          <mesh position={[start[0], limits.oxygenY, start[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[700, 700]} />
            <meshBasicMaterial color="#e8a02f" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} fog={false} />
          </mesh>
        )}

        <Structures
          items={shownItems}
          models={models}
          selected={selectedItemIds}
          targetId={targeting ? aim.targetId : null}
          showBedAreas={showBedAreas}
          noSkirt={false}
        />

        {aim.paste && <PasteGhost paste={aim.paste} models={models} />}

        {aim.preview && ghostDef && !paste && (
          <group
            position={[aim.preview.x * SCALE, (aim.preview.floor || 0) * H + pieceY(ghostDef, ghostModel), aim.preview.y * SCALE]}
            rotation={[0, (-aim.preview.rotation * Math.PI) / 180, 0]}
          >
            <Piece def={ghostDef} model={ghostModel} color="#fff" ghost={aim.valid ? 'ok' : 'bad'} />
          </group>
        )}
      </Canvas>

      <div className={styles.crosshair} data-mode={isDemolish ? 'demolish' : 'build'} aria-hidden />

      {!locked && overlay === 'none' && (
        <div className={styles.lockHint}>
          {lockFailed
            ? t.view3d.lockFailed
            : t.view3d.lockHint}
        </div>
      )}

      <div className={styles.modeBadge} data-ui>
        {walk ? t.view3d.walking : t.view3d.flying} <kbd>{keyLabel(binds.toggleFly, { space: t.keys.space, shift: t.keys.shift })}</kbd>
        {site && <span className={styles.modeMap}>{site.map}</span>}
      </div>

      {/* Zdrowie i tlen: tylko przy chodzeniu (fizyka z gry) */}
      {walk && walkStatus && (
        <div className={styles.vitals} data-ui>
          <div className={styles.vital}>
            <span>{t.view3d.health}</span>
            <span className={styles.bar} data-kind="health"><span style={{ width: `${walkStatus.health}%` }} /></span>
            <strong>{walkStatus.health}</strong>
          </div>
          <div className={styles.vital}>
            <span>{t.view3d.oxygen}</span>
            <span className={styles.bar} data-kind="oxygen"><span style={{ width: `${walkStatus.oxygen}%` }} /></span>
            <strong>{walkStatus.oxygen}</strong>
          </div>
          {(walkStatus.legsBroken || t.view3d.stances[walkStatus.stance]) && (
            <div className={styles.vitalTags}>
              {t.view3d.stances[walkStatus.stance] && <span>{t.view3d.stances[walkStatus.stance]}</span>}
              {walkStatus.legsBroken && <span data-bad>{t.view3d.legsBroken}</span>}
            </div>
          )}
        </div>
      )}
      {walk && walkStatus?.dead && <div className={styles.deathNote}>{t.view3d.dead}</div>}

      {!activeDef && !paste && aim.lookId && (
        <div className={styles.aimStatus} data-ui>
          <kbd>{keyLabel(binds.grab, { space: t.keys.space, shift: t.keys.shift })}</kbd>
          <span>{t.hud.grabHint}</span>
        </div>
      )}

      {paste && (
        <div className={styles.aimStatus} data-ui data-bad={!aim.valid || undefined}>
          <strong>{paste.move ? t.hud.moving(paste.clip.length) : t.hud.pasting(paste.clip.length)}</strong>
          {aim.paste ? (aim.valid ? t.view3d.fits : t.view3d.collides) : t.view3d.aimAtGrid}
          <span>{t.hud.pasteKeys(keyLabel(binds.rotate, { space: t.keys.space, shift: t.keys.shift }))}</span>
        </div>
      )}

      {isDemolish && !paste && (
        <div className={styles.aimStatus} data-ui data-demolish>
          <strong>{t.hud.demolish}</strong>
          {t.hud.demolishHint}
        </div>
      )}

      {/* Stan celownika nad paskiem: trzymany element i czy pasuje */}
      {activeDef && !isDemolish && !paste && (
        <div className={styles.aimStatus} data-ui data-bad={!aim.valid || undefined}>
          <strong>{itemLabel(activeDef, t)}</strong>
          {aim.reason ? t.view3d.reasons[aim.reason] : aim.warn ? t.view3d.warns[aim.warn] : aim.preview ? (aim.valid ? t.view3d.fits : t.view3d.collides) : t.view3d.aimAtGrid}
          {aim.above !== null && aim.preview && (
            <span>{aim.above < 0.5 ? t.view3d.ground : t.view3d.above(aim.above.toFixed(1))}</span>
          )}
        </div>
      )}
    </div>
  );
}
