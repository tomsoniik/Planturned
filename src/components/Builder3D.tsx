"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Bone, Heart, PersonSimple, PersonSimpleRun, PersonSimpleSwim, Wind } from '@phosphor-icons/react';
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
  isClaim,
  isDoorLike,
  isGlass,
  isOpenable,
  isLadder,
  openStyle,
  type OpenStyle,
  findDoorSlot,
  findLadderSlot,
  type BuildItem,
  type PasteResult,
  type PlacedItem,
} from '@/lib/builder';
import { resolveLighting } from '@/lib/lighting';
import { loadGameModels, loadedPropModels, onPropModels, requestPropModels, type GameModel } from '@/lib/gameModels';
import { loadProps, usePropsStore } from '@/lib/props';
import { DEFAULT_SWING, itemSound, loadSoundTable, playItemSound, preloadItemSounds, resumeAudio, setListener } from '@/lib/sounds';
import { useSettings3D } from '@/lib/settings3d';
import { loadTexture } from '@/lib/textures';
import { castFirst, createNearby, headroom, markSceneDirty, moveCapsule, pushOut, sceneMeshes } from '@/lib/collision';
import { loadMap, mapOverviewUrl, type MapData, type Site } from '@/lib/terrain';
import { DEFAULT_SCENE, type SceneSettings } from '@/lib/scene';
import { itemLabel, type AimReason, type AimWarn } from '@/lib/i18n';
import { useT } from './I18nProvider';
import RaidInfo from './RaidInfo';
import { keyLabel, useKeybinds } from '@/lib/keybinds';
import { onSceneCommand, registerCameraProbe, registerContainer, sendSceneCommand, useView3D } from '@/lib/view3d';
import {
  AIR_ACCEL, AIR_DECEL, EYES, EYES_LERP, FALL_DAMAGE_MAX, FALL_DAMAGE_SPEED, GRAVITY, HEIGHT, JUMP_SPEED, MAX_SLOPE_DEG,
  CLIMB_SPEED, LADDER_REACH, RADIUS, SLIDE_ACCEL, SPEED, SWIM_BODY_DEPTH, SWIM_MULTIPLIER, SWIM_SURFACE_OFFSET, SWIM_UP_SPEED, TERMINAL_VELOCITY, TICK,
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

/** Struktury z eksportu gry + wczytane już rekwizyty (dochodzą na żądanie, requestPropModels). */
export function useGameModels() {
  const [models, setModels] = useState<Models>(new Map());
  useEffect(() => {
    let alive = true;
    let structures: Models = new Map();
    const merge = () => alive && setModels(new Map([...structures, ...loadedPropModels()]));
    loadGameModels().then((m) => {
      structures = m;
      merge();
    });
    const off = onPropModels(merge);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return models;
}

/** Wysokość pivotu elementu nad poziomem (konwencje z gry). */
function pieceY(def: BuildItem, model?: GameModel) {
  if (def.shape === 'bed') return TOP;
  if (def.shape === 'prop') return 0; // spód modelu na y = 0, stoi na powierzchni pod celownikiem
  if (def.shape === 'hatch') return H - 0.1; // w otworze dachu
  if (def.shape === 'wall' || def.shape === 'pillar') return WALL_BASE - (model ? model.minY : 0);
  if (isRoofLayer(def)) return H;
  return 0;
}

/**
 * Otwarcie w lokalnym układzie elementu (styl z openStyle, jak animacje z gry); `amount` 0..1 to postęp otwarcia.
 * Drzwi i skrzydła obracają się o 90° na pionowej krawędzi, brama unosi się na górnej, klapa na krawędzi +Z.
 * Wszystko otwiera się na stronę -Z (R przy stawianiu przekłada element na drugą stronę ściany).
 * Kolizja liczy się z siatki, więc otwarty element sam przestaje blokować przejście.
 */
function openMatrix(style: OpenStyle, def: BuildItem, model: GameModel | undefined, leaf: number, amount: number, out: THREE.Matrix4): THREE.Matrix4 {
  const bb = model?.geometry.boundingBox;
  const w = (def.size?.[0] ?? 2) / 2;
  const angle = (Math.PI / 2) * amount;
  let hx = 0, hy = 0, hz = 0;
  if (style === 'hatch') {
    hz = bb ? bb.max.z : 0.8;
    swingTmp.makeRotationX(angle);
  } else if (style === 'gate') {
    hy = bb ? bb.max.y : def.size?.[1] ?? 3.75;
    swingTmp.makeRotationX(angle);
  } else if (style === 'double' && leaf === 1) {
    hx = bb ? bb.max.x : w;
    swingTmp.makeRotationY(-angle);
  } else {
    hx = bb ? bb.min.x : -w;
    swingTmp.makeRotationY(angle);
  }
  return out.makeTranslation(hx, hy, hz).multiply(swingTmp).multiply(swingTmp2.makeTranslation(-hx, -hy, -hz));
}
const swingTmp = new THREE.Matrix4();
const swingTmp2 = new THREE.Matrix4();

/**
 * Połowa siatki po jednej stronie płaszczyzny x = 0 (side -1: lewa, 1: prawa), z dociętymi trójkątami
 * i zaślepką w miejscu cięcia. Okiennice i drzwi podwójne są w eksporcie jedną bryłą, a w grze mają dwa skrzydła.
 */
function splitAtX(geometry: THREE.BufferGeometry, side: -1 | 1) {
  const pos = geometry.getAttribute('position');
  const col = geometry.getAttribute('color');
  const outP: number[] = [], outC: number[] = [];
  let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const cutColor = [0, 0, 0];
  let cuts = 0;
  type V = { p: number[]; c: number[] };
  const vert = (k: number): V => ({
    p: [pos.getX(k), pos.getY(k), pos.getZ(k)],
    c: col ? [col.getX(k), col.getY(k), col.getZ(k)] : [],
  });
  const lerp = (a: V, b: V, t: number): V => ({
    p: a.p.map((v, n) => v + (b.p[n] - v) * t),
    c: a.c.map((v, n) => v + (b.c[n] - v) * t),
  });
  const onCut = (v: V) => {
    y0 = Math.min(y0, v.p[1]); y1 = Math.max(y1, v.p[1]);
    z0 = Math.min(z0, v.p[2]); z1 = Math.max(z1, v.p[2]);
    v.c.forEach((c, n) => (cutColor[n] += c));
    cuts++;
  };
  for (let k = 0; k < pos.count; k += 3) {
    const tri = [vert(k), vert(k + 1), vert(k + 2)];
    // Sutherland-Hodgman dla jednej płaszczyzny: zostaje część, gdzie side * x >= 0
    const poly: V[] = [];
    for (let n = 0; n < 3; n++) {
      const a = tri[n], b = tri[(n + 1) % 3];
      const da = side * a.p[0], db = side * b.p[0];
      if (da >= 0) poly.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const v = lerp(a, b, da / (da - db));
        v.p[0] = 0;
        onCut(v);
        poly.push(v);
      }
    }
    for (let n = 1; n + 1 < poly.length; n++) {
      for (const v of [poly[0], poly[n], poly[n + 1]]) {
        outP.push(...v.p);
        outC.push(...v.c);
      }
    }
  }
  if (cuts > 0) {
    // zaślepka: prostokąt przekroju zwrócony na zewnątrz skrzydła (normalna -side * X)
    const c = cutColor.map((v) => v / cuts);
    const quad = side > 0
      ? [[y0, z0], [y1, z1], [y1, z0], [y0, z0], [y0, z1], [y1, z1]]
      : [[y0, z0], [y1, z0], [y1, z1], [y0, z0], [y1, z1], [y0, z1]];
    for (const [y, z] of quad) {
      outP.push(0, y, z);
      if (col) outC.push(...c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(outP, 3));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(outC, 3));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Skrzydła modelu (lewe, prawe) liczone raz na geometrię. */
const leafCache = new WeakMap<THREE.BufferGeometry, [GameModel, GameModel]>();
function modelLeaves(model: GameModel): [GameModel, GameModel] {
  let leaves = leafCache.get(model.geometry);
  if (!leaves) {
    leaves = [{ ...model, geometry: splitAtX(model.geometry, -1) }, { ...model, geometry: splitAtX(model.geometry, 1) }];
    leafCache.set(model.geometry, leaves);
  }
  return leaves;
}

/** Drzwi, bramy, okiennice i klapy: płynny ruch do stanu `open`; po wczytaniu projektu od razu w docelowym położeniu. */
function Swing({ def, model, open, render }: { def: BuildItem; model?: GameModel; open: boolean; render: (model?: GameModel) => React.ReactNode }) {
  const style = openStyle(def) ?? 'door';
  const leaves = style === 'double' && model ? modelLeaves(model) : null;
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const progress = useRef(open ? 1 : 0);
  const shown = useRef(-1);
  // zawias zależy od modelu: po jego wczytaniu macierz trzeba policzyć od nowa
  useEffect(() => {
    shown.current = -1;
  }, [def, model]);
  useFrame((_, delta) => {
    const target = open ? 1 : 0;
    const p = progress.current;
    // czas animacji Open/Close tego przedmiotu z gry (drzwi 0,63 s, skarbiec 0,8 s)
    const s = itemSound(def.gameId);
    const time = (open ? s?.open : s?.close) ?? DEFAULT_SWING;
    if (p !== target) progress.current = target > p ? Math.min(1, p + delta / time) : Math.max(0, p - delta / time);
    if (shown.current === progress.current) return;
    shown.current = progress.current;
    // wygładzenie: szybki start, miękkie dojście do framugi
    const t = progress.current;
    const eased = t * t * (3 - 2 * t);
    [left.current, right.current].forEach((g, leaf) => {
      if (!g) return;
      openMatrix(style, def, model, leaf, eased, g.matrix);
      g.matrixWorldNeedsUpdate = true;
    });
  });
  return (
    <>
      <group ref={left} matrixAutoUpdate={false}>
        {render(leaves ? leaves[0] : model)}
      </group>
      {leaves && (
        <group ref={right} matrixAutoUpdate={false}>
          {render(leaves[1])}
        </group>
      )}
    </>
  );
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
    case 'prop': {
      const [w, h, d] = def.size ?? [1, 1, 1];
      return <boxGeometry args={[w, h, d]} />;
    }
    default:
      return <boxGeometry args={[S, 0.5, S]} />;
  }
}

/** Przesunięcie bryły zastępczej względem pivotu (żeby pasowała do konwencji modeli z gry). */
function fallbackOffset(def: BuildItem): [number, number, number] {
  if (def.shape === 'wall') return [0, (def.part === 'rampart' ? 1.5 : 4.25) / 2, 0];
  if (def.shape === 'pillar') return [0, (def.part === 'post' ? 1.86 : 4.25) / 2, 0];
  if (def.shape === 'bed') return [0, 0.25, 0];
  if (def.shape === 'prop') return [0, (def.size?.[1] ?? 1) / 2, 0];
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
/*
  Szyby z gry to pojedyncza płaszczyzna bez grubości: przezroczysty materiał widoczny z obu stron.
  Jednostronna (lustro weneckie): z jednej strony ciemne lustro, z drugiej prawie przezroczysta; R odwraca stronę.
*/
const GLASS: Record<number, { color: string; opacity: number }> = {
  1297: { color: '#a8e4ec', opacity: 0.22 },
  1298: { color: '#c3cbcf', opacity: 0.32 },
  1299: { color: '#5b6a70', opacity: 0.18 },
};

/** Trójkąty siatki zwrócone na +Z albo na -Z (lokalnie): szyby z gry mają każdą ścianę podwójnie, po jednej na stronę. */
function facesBySide(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const front: number[] = [], back: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const count = index ? index.count : pos.count;
  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i, ib = index ? index.getX(i + 1) : i + 1, ic = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    (nz >= 0 ? front : back).push(ia, ib, ic);
  }
  const part = (ids: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', pos);
    if (geometry.getAttribute('normal')) g.setAttribute('normal', geometry.getAttribute('normal'));
    g.setIndex(ids);
    g.computeBoundingSphere();
    return g;
  };
  return front.length && back.length ? { front: part(front), back: part(back) } : null;
}

function GlassPiece({ def, model, highlight, itemId }: { def: BuildItem; model: GameModel; highlight?: 'target' | 'selected'; itemId?: string }) {
  const g = GLASS[def.gameId ?? 0] ?? GLASS[1297];
  const tint = highlight === 'target' ? '#e5484d' : highlight === 'selected' ? '#8dc46f' : g.color;
  const oneWay = def.gameId === 1299;
  const sides = useMemo(() => facesBySide(model.geometry), [model.geometry]);
  useEffect(() => () => {
    sides?.front.dispose();
    sides?.back.dispose();
  }, [sides]);
  const clear = (side: THREE.Side) => (
    <meshStandardMaterial color={tint} transparent opacity={g.opacity} depthWrite={false} roughness={0.05} metalness={0.1} side={side} />
  );
  // Każda strona ma własne trójkąty: rysujemy tylko te zwrócone do kamery (jedna warstwa szkła z każdej strony).
  // Lustro weneckie: strona +Z to ciemne lustro, strona -Z zwykła przezroczysta szyba (R obraca element).
  if (sides) {
    return (
      <>
        <mesh geometry={sides.back} userData={{ itemId }} renderOrder={1}>
          {clear(THREE.FrontSide)}
        </mesh>
        <mesh geometry={sides.front} userData={{ itemId }} renderOrder={1}>
          {oneWay ? <meshStandardMaterial color="#1c2124" roughness={0.08} metalness={0.85} side={THREE.FrontSide} /> : clear(THREE.FrontSide)}
        </mesh>
      </>
    );
  }
  // pojedyncza płaszczyzna (bez podwójnych ścian): widoczna z obu stron
  return (
    <mesh geometry={model.geometry} userData={{ itemId }} renderOrder={1}>
      {clear(THREE.DoubleSide)}
    </mesh>
  );
}

function Piece({ def, model, color, clip, ghost, highlight, itemId }: PieceProps) {
  const palette = !!model?.hasColors && highlight !== 'target';
  if (!ghost && model && isGlass(def)) return <GlassPiece def={def} model={model} highlight={highlight} itemId={itemId} />;
  const material = ghost ? (
    <meshStandardMaterial
      color={ghost === 'ok' ? '#8dc46f' : '#e5484d'}
      transparent
      opacity={0.45}
      depthWrite={false}
      flatShading
      // szyba to płaszczyzna bez grubości: podgląd widać z obu stron
      side={isGlass(def) ? THREE.DoubleSide : THREE.FrontSide}
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
      <mesh geometry={model.geometry} receiveShadow={shadow} userData={ghost ? {} : { itemId, ladder: isLadder(def) }}>
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
  const piece = (m: GameModel | undefined) => (
    <MemoPiece
      def={def}
      model={m}
      color={color}
      clip={clip}
      highlight={isTargeted ? 'target' : isSelected ? 'selected' : undefined}
      itemId={item.id}
    />
  );

  return (
    <group
      position={[item.x * SCALE, (item.floor || 0) * H + pieceY(def, model), item.y * SCALE]}
      rotation={[0, (-item.rotation * Math.PI) / 180, 0]}
    >
      {isOpenable(def) ? <Swing def={def} model={model} open={!!item.open} render={piece} /> : piece(model)}
      {isClaim(def) && showBedAreas && (
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
  /** Drabina: postać się po niej wspina. */
  ladder?: boolean;
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
      m.compose(p, q, one);
      mesh.setMatrixAt(ids.length, m);
      ids.push(item.id);
    }
    mesh.count = ids.length;
    // podgląd wklejania nie jest celem celownika ani podłożem
    mesh.userData = ghost ? {} : { itemIds: ids, ladder: !!group.ladder };
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
      // drzwi i klapy osobno: każde ma własną animację otwierania
      // drzwi i klapy (animacja) oraz szyby (przezroczyste, obie strony) rysujemy osobno
      if (!def || !model || isOpenable(def) || isGlass(def)) {
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
        byKey.set(key, (g = { key, geometry: model.geometry, material, y: pieceY(def, model), items: [], ladder: isLadder(def) }));
      }
      g.items.push(item);
    }
    return { groups: [...byKey.values()], loose };
  }, [items, models, noSkirt]);

  // nowe albo usunięte siatki: listy do kolizji i celowania trzeba przebudować
  useEffect(() => markSceneDirty(), [items, models]);
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
          .filter((i) => isClaim(findDef(i.itemId)))
          .map((i) => (
            <mesh
              key={i.id}
              position={[i.x * SCALE, (i.floor || 0) * H + (findDef(i.itemId)?.shape === 'bed' ? TOP : 0) + 0.05, i.y * SCALE]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
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
    // bez pliku: zieleń zbliżona do podglądu mapy
    loadTexture(mapOverviewUrl(meta.id), '#4d6b3c', (tex) => {
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

// osobne pule brył w pobliżu postaci: ściany do ruchu i podłoże pod stopami
const nearSolids = createNearby();
const nearFloors = createNearby();

/** ?debug: łączny czas (ms) i liczba klatek fizyki postaci i celowania, do porównań wydajności. */
const perf = { phys: { ms: 0, n: 0 }, aim: { ms: 0, n: 0 } };
function timed(key: keyof typeof perf, fn: () => void) {
  const t = performance.now();
  fn();
  perf[key].ms += performance.now() - t;
  perf[key].n++;
}

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

/** Drabina w układzie sceny: środek podstawy, obrót (rad, jak w planie), pół szerokości i grubości, spód i góra. */
interface LadderBox {
  x: number;
  z: number;
  rot: number;
  half: number;
  depth: number;
  bottom: number;
  top: number;
}

/**
 * Drabina, której dotyka postać (PlayerStance.checkLadder: do 0,75 m przed sobą, przodem do drabiny).
 * Zwraca przesunięcie w bok od osi drabiny (do wyśrodkowania postaci w otworze) albo null.
 */
function touchedLadder(ladders: LadderBox[], x: number, feet: number, z: number, fx: number, fz: number) {
  for (const l of ladders) {
    if (feet < l.bottom - 0.5 || feet > l.top - 0.1) continue;
    const dx = x - l.x, dz = z - l.z;
    const c = Math.cos(l.rot), s = Math.sin(l.rot);
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    if (Math.abs(lx) > l.half + 0.15 || Math.abs(lz) > l.depth + LADDER_REACH) continue;
    // przodem do drabiny: kierunek patrzenia w stronę jej płaszczyzny
    const side = lz >= 0 ? 1 : -1;
    const toward = -side * (-s * fx + c * fz);
    if (toward < 0.5) continue;
    return { ladder: l, lx, lz };
  }
  return null;
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
  beds,
  ladders,
  focus,
  touchOnly,
  walk,
  groundAt,
  env,
  origin,
  onStatus,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  start: [number, number, number];
  /** Łóżka w projekcie (punkt stóp w układzie sceny): miejsce odrodzenia po śmierci. */
  beds: [number, number, number][];
  /** Drabiny do wspinania. */
  ladders: LadderBox[];
  /** Środek i promień całego projektu: domyślny cel orbity. */
  focus: { center: [number, number, number]; radius: number };
  /** Urządzenie bez myszy i klawiatury: start na orbicie. */
  touchOnly: boolean;
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
    /** Na drabinie; detach: czas po odskoczeniu, w którym drabina nie łapie. */
    climbing: false,
    detach: 0,
    deathAt: new THREE.Vector3(),
    lastReport: 0,
  });
  const bedsRef = useRef(beds);
  const laddersRef = useRef(ladders);
  useEffect(() => {
    bedsRef.current = beds;
    laddersRef.current = ladders;
  }, [beds, ladders]);
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
    // promień jak w kolizji ruchu: pierwsze trafione bryły (elementy i obiekty mapy) i odległość
    const cast = (x: number, y: number, z: number, dx: number, dy: number, dz: number, far = 6) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(dx, dy, dz).normalize(), 0, far);
      return ray.intersectObjects(sceneMeshes(scene).solids, false).slice(0, 3).map((h) => ({
        d: +h.distance.toFixed(2),
        id: h.object.userData.itemId ?? h.object.userData.itemIds?.[h.instanceId ?? 0] ?? (h.object.userData.mapObject ? 'mapa' : '?'),
      }));
    };
    (window as unknown as { __untmatica: unknown }).__untmatica = {
      camera, phys: phys.current, groundAt, probe, cast, perf, cmd: sendSceneCommand,
      // kolizja kapsuły na aktualnej scenie (testy bez czekania na klatki)
      col: {
        move: (x: number, feet: number, z: number, h: number, dx: number, dz: number) => moveCapsule(sceneMeshes(scene).solids, x, feet, z, RADIUS, h, dx, dz),
        push: (x: number, feet: number, z: number, h: number) => pushOut(sceneMeshes(scene).solids, x, feet, z, RADIUS, h),
        headroom: (x: number, top: number, z: number, up: number) => headroom(sceneMeshes(scene).solids, x, top, z, RADIUS, up),
        // porównanie pracy jednej klatki ruchu: dawniej przejście sceny + 6 promieni, teraz lista w pamięci + kapsuła
        bench: (n = 200) => {
          const p = camera.position;
          const feet = p.y - phys.current.eyes;
          const old = new THREE.Raycaster();
          let t = performance.now();
          for (let i = 0; i < n; i++) {
            const meshes: THREE.Object3D[] = [];
            scene.traverse((o) => {
              if ((o as THREE.Mesh).isMesh && (o.userData.itemId || o.userData.itemIds || o.userData.road || o.userData.mapObject)) meshes.push(o);
            });
            const solids = meshes.filter((m) => !m.userData.road && !m.userData.cutout);
            const floors = meshes.filter((m) => !m.userData.tree);
            for (const [dx, dz] of [[1, 0], [1, 0], [0, 1]]) {
              for (const h of [0.55, 1.7]) {
                old.set(new THREE.Vector3(p.x, feet + h, p.z), new THREE.Vector3(dx, 0, dz));
                old.far = 0.6;
                old.intersectObjects(solids, false);
              }
            }
            old.set(new THREE.Vector3(p.x, feet + 0.5, p.z), new THREE.Vector3(0, -1, 0));
            old.far = 80;
            old.intersectObjects(floors, false);
          }
          const before = (performance.now() - t) / n;
          t = performance.now();
          for (let i = 0; i < n; i++) {
            const all = sceneMeshes(scene);
            const solids = nearSolids(all.solids, p.x, feet + 1, p.z, 4);
            const floors = nearFloors(all.floors, p.x, feet, p.z, 4);
            moveCapsule(solids, p.x, feet, p.z, RADIUS, 2, 0.15, 0.1);
            pushOut(solids, p.x, feet, p.z, RADIUS, 2);
            headroom(solids, p.x, feet + 2, p.z, RADIUS, 0.2);
            castFirst(floors, p.x, feet + 0.5, p.z, 0, -1, 0, 80);
          }
          const after = (performance.now() - t) / n;
          return { przed: +before.toFixed(3), po: +after.toFixed(3) };
        },
        // grunt jak w fizyce: najwyższa powierzchnia do 0,5 m nad stopami albo teren
        ground: (x: number, feet: number, z: number) => Math.max(groundAt(x, z), castFirst(sceneMeshes(scene).floors, x, feet + 0.5, z, 0, -1, 0, 80)?.point.y ?? -Infinity),
      },
    };
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
  // Pole widzenia z ustawień
  const fov = useSettings3D((st) => st.fov);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    // setFocalLength ustawia fov i macierz rzutowania (bez przypisywania pola kamery z hooka)
    cam.setFocalLength(cam.getFilmHeight() / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  }, [camera, fov]);
  // Otwarta nakładka (ekwipunek, czat, menu): puszczamy wszystkie klawisze ruchu
  useEffect(() => useView3D.subscribe((s) => s.overlay !== 'none' && (keys.current = {})), []);
  // Wejście w chodzenie: pełne zdrowie, stopy na wysokości oczu kamery
  useEffect(() => {
    if (!walk) return;
    resetVitals();
    phys.current.eyes = EYES.stand;
  }, [walk]);
  // --- Orbita: kamera krąży wokół bazy (komenda /orbit, przycisk na liście Budowle, telefon i tablet) ---
  const orbit = useRef<{
    target: THREE.Vector3;
    theta: number;
    phi: number;
    dist: number;
    back: { pos: THREE.Vector3; quat: THREE.Quaternion } | null;
  } | null>(null);
  const focusRef = useRef(focus);
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);
  const orbitApi = useRef({
    start: (target?: [number, number, number], radius?: number) => {
      const f = focusRef.current;
      const t = target ?? f.center;
      const r = radius ?? f.radius;
      // kąt startowy od strony, z której patrzy gracz
      const theta = Math.atan2(camera.position.x - t[0], camera.position.z - t[2]);
      orbit.current = {
        target: new THREE.Vector3(...t),
        theta: Number.isFinite(theta) ? theta : 0,
        phi: 1.0,
        dist: Math.min(400, Math.max(12, r * 2.4)),
        back: orbit.current?.back ?? { pos: camera.position.clone(), quat: camera.quaternion.clone() },
      };
      if (document.pointerLockElement) document.exitPointerLock();
      useView3D.setState({ orbit: true });
    },
    stop: () => {
      const o = orbit.current;
      if (!o) return;
      // powrót do miejsca gracza sprzed orbity
      if (o.back) {
        camera.position.copy(o.back.pos);
        camera.quaternion.copy(o.back.quat);
      }
      orbit.current = null;
      phys.current.vel.set(0, 0, 0);
      useView3D.setState({ orbit: false });
    },
  });
  useEffect(() => {
    const off = onSceneCommand((c) => {
      if (c.kind !== 'orbit') return;
      // /orbit drugi raz kończy orbitę; przycisk przy bazie przełącza cel
      if (c.on && !(orbit.current && !c.target)) orbitApi.current.start(c.target, c.radius);
      else orbitApi.current.stop();
    });
    return () => {
      off();
      useView3D.setState({ orbit: false });
    };
  }, []);
  // Telefon i tablet: bez klawiatury i przechwycenia myszy Sandbox startuje na orbicie sterowanej palcami
  useEffect(() => {
    if (touchOnly) orbitApi.current.start();
  }, [touchOnly]);
  // Sterowanie orbitą: przeciąganie (mysz albo palec) obraca, kółko albo szczypnięcie przybliża
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const down = (e: PointerEvent) => {
      if (!orbit.current || (e.target as HTMLElement).closest('[data-ui]')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      container.setPointerCapture(e.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const drag = (e: PointerEvent) => {
      const o = orbit.current;
      const prev = pointers.get(e.pointerId);
      if (!o || !prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (pointers.size === 1) {
        o.theta -= (cur.x - prev.x) * 0.006;
        o.phi = Math.max(0.15, Math.min(1.5, o.phi - (cur.y - prev.y) * 0.006));
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) o.dist = Math.min(400, Math.max(3, o.dist * (pinch / d)));
        pinch = d;
      }
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      const o = orbit.current;
      if (!o) return;
      e.preventDefault();
      o.dist = Math.min(400, Math.max(3, o.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    };
    const key = (e: KeyboardEvent) => {
      if (!orbit.current || useView3D.getState().overlay !== 'none') return;
      // klawisz latania kończy orbitę (zamiast przełączać latanie)
      if (e.code === bindsRef.current.toggleFly) {
        e.stopImmediatePropagation();
        orbitApi.current.stop();
      }
    };
    container.addEventListener('pointerdown', down);
    container.addEventListener('pointermove', drag);
    container.addEventListener('pointerup', up);
    container.addEventListener('pointercancel', up);
    container.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key, true);
    return () => {
      container.removeEventListener('pointerdown', down);
      container.removeEventListener('pointermove', drag);
      container.removeEventListener('pointerup', up);
      container.removeEventListener('pointercancel', up);
      container.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key, true);
    };
  }, [containerRef]);

  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      camera.position.set(start[0], start[1] + 9, start[2] + 26);
      pitch.current = -Math.atan2(9, 26);
      camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
      initialized.current = true;
    }
    const container = containerRef.current;

    const lock = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]') || lockState.failed || orbit.current) return;
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
      if (useView3D.getState().overlay !== 'none' || orbit.current) return;
      // czułość i odwrócenie osi Y z menu Esc > Ustawienia
      const { sensitivity, invertY } = useSettings3D.getState();
      const k = 0.0025 * sensitivity;
      yaw.current -= e.movementX * k;
      pitch.current = Math.max(-1.52, Math.min(1.52, pitch.current - e.movementY * k * (invertY ? -1 : 1)));
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

  useFrame((_, rawDelta) => timed('phys', () => {
    const delta = Math.min(rawDelta, 0.05);
    const k = keys.current;
    const b = bindsRef.current;
    const pos = camera.position;

    const o = orbit.current;
    if (o) {
      const sp = Math.sin(o.phi);
      pos.set(o.target.x + o.dist * sp * Math.sin(o.theta), o.target.y + o.dist * Math.cos(o.phi), o.target.z + o.dist * sp * Math.cos(o.theta));
      camera.lookAt(o.target);
      return;
    }

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
        // Jak w grze: odrodzenie przy łóżku. Przy kilku łóżkach (baza ekipy) najbliższe miejscu śmierci,
        // bo to zwykle łóżko bazy, w której gracz właśnie był. Bez łóżka: punkt startu.
        resetVitals();
        let bed: [number, number, number] | null = null;
        for (const b of bedsRef.current) {
          if (!bed || Math.hypot(b[0] - p.deathAt.x, b[2] - p.deathAt.z) < Math.hypot(bed[0] - p.deathAt.x, bed[2] - p.deathAt.z)) bed = b;
        }
        // nad łóżkiem: grawitacja postawi postać na nim
        if (bed) pos.set(bed[0], Math.max(bed[1], groundAt(bed[0], bed[2])) + 0.6 + EYES.stand, bed[2]);
        else pos.set(start[0], groundAt(start[0], start[2]) + EYES.stand, start[2]);
      }
      report();
      return;
    }

    // Promienie tylko na struktury, obiekty mapy i drogi (lista w pamięci, BVH); wysokość terenu daje groundAt
    const all = sceneMeshes(scene);
    let feet = pos.y - p.eyes;
    // tylko bryły w zasięgu kilku metrów: kilkadziesiąt promieni na klatkę nie przechodzi przez całą bazę
    const solids = nearSolids(all.solids, pos.x, feet + 1, pos.z, 4 + p.vel.length() * 0.05);
    // podłoże: blisko terenu wystarczą pobliskie siatki (wszystko nad terenem jest w kuli), wysoko pełna lista
    const nearTerrain = feet - groundAt(pos.x, pos.z) < 3;
    const floors = nearTerrain ? nearFloors(all.floors, pos.x, feet, pos.z, 4) : all.floors;

    // Kucanie i czołganie przełączane klawiszem (nie w wodzie). Jak w grze: wyżej tylko, gdy nad głową jest miejsce.
    for (const toggle of toggles.current.splice(0)) {
      if (p.stance === 'swim') continue;
      const next = p.stance === toggle ? 'stand' : toggle;
      const grow = HEIGHT[next] - HEIGHT[p.stance];
      if (grow > 0 && headroom(solids, pos.x, feet + HEIGHT[p.stance], pos.z, RADIUS, grow) < grow) continue;
      p.stance = next;
    }

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
      const hit = castFirst(floors, x, y + 0.5, z, 0, -1, 0, 80);
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

    // Drabina (PlayerStance.checkLadder): drabina tuż przed postacią, w stronę patrzenia. W w górę, S w dół,
    // bez grawitacji; spacja odpycha od drabiny. Na ziemi S odchodzi od niej zwykłym krokiem.
    p.detach = Math.max(0, p.detach - delta);
    const touch =
      p.detach === 0 && p.stance !== 'swim' && p.stance !== 'prone' ? touchedLadder(laddersRef.current, pos.x, feet, pos.z, forward.x, forward.z) : null;
    const onLadder = !!touch;
    const climb = onLadder && (!p.grounded || k[b.forward]);
    if (p.climbing && !onLadder && k[b.forward] && v.y > 0) {
      // koniec drabiny w otworze: podciągnięcie na krawędź, jak skok z ostatniego szczebla
      v.set(forward.x * SPEED.stand, JUMP_SPEED, forward.z * SPEED.stand);
    }
    p.climbing = climb;

    if (climb && touch) {
      const dir = (k[b.forward] ? 1 : 0) - (k[b.back] ? 1 : 0);
      // postać zsuwa się na oś drabiny, żeby zmieściła się w otworze dachu
      const pull = THREE.MathUtils.clamp(-touch.lx * 6, -2, 2);
      v.set(Math.cos(touch.ladder.rot) * pull, dir * CLIMB_SPEED, Math.sin(touch.ladder.rot) * pull);
      if (k[b.up]) {
        v.set(-forward.x * 3, 3, -forward.z * 3);
        p.detach = 0.4;
        p.climbing = false;
      }
      p.grounded = false;
    } else if (p.stance === 'swim') {
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

    // Ruch poziomy: kapsuła postaci, dojście do ściany i ślizg wzdłuż niej, potem wypchnięcie z tego, co w nią weszło
    const height = HEIGHT[p.stance];
    const move = moveCapsule(solids, pos.x, feet, pos.z, RADIUS, height, v.x * delta, v.z * delta);
    pos.x += move.dx;
    pos.z += move.dz;
    if (move.blocked && delta > 0) {
      // prędkość zostaje tylko wzdłuż ściany (w powietrzu nie odbijamy się od niej)
      v.x = move.dx / delta;
      v.z = move.dz / delta;
    }
    const out = pushOut(solids, pos.x, feet, pos.z, RADIUS, height);
    pos.x += out.dx;
    pos.z += out.dz;

    // Ruch pionowy i lądowanie (PlayerLife.onLanded: > 22 m/s = obrażenia i złamane nogi)
    const g2 = groundUnder(pos.x, feet, pos.z);
    let rise = ((vyStart ?? v.y) + v.y) / 2 * delta;
    if (rise > 0) {
      // sufit: skok i wypływanie kończą się na głowie, nie przechodzą przez strop
      const room = headroom(solids, pos.x, feet + height, pos.z, RADIUS, rise);
      if (room < rise) {
        rise = room;
        v.y = 0;
      }
    }
    feet += rise;
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
    if (p.vitals.health <= 0 && p.dead <= 0) {
      p.dead = 3;
      p.deathAt.copy(pos);
    }
    report();
  }));

  return null;
}

// --- Zdjęcie sceny (klawisz F2 albo /screenshot) ---

/**
 * PNG samej sceny: HUD to HTML nad płótnem, więc i tak go nie ma; podgląd stawianego elementu chowamy na jedną klatkę.
 * Render i odczyt w tym samym zadaniu, więc bufor rysowania jest jeszcze pełny (bez preserveDrawingBuffer).
 */
function Screenshot({ name }: { name: string }) {
  const { gl, scene, camera } = useThree();
  const shotKey = useKeybinds((st) => st.binds.screenshot);
  useEffect(() => {
    const shoot = () => {
      const hidden: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (o.userData.hideInShot && o.visible) {
          o.visible = false;
          hidden.push(o);
        }
      });
      gl.render(scene, camera);
      hidden.forEach((o) => (o.visible = true));
      // czas lokalny gracza: RRRR-MM-DD_GG-MM
      const d = new Date();
      const two = (n: number) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}_${two(d.getHours())}-${two(d.getMinutes())}`;
      const file = `${(name || 'untmatica').replace(/[\/:*?"<>|]+/g, '_').trim()} ${stamp}.png`;
      gl.domElement.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== shotKey || e.repeat || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
      shoot();
    };
    const off = onSceneCommand((c) => c.kind === 'screenshot' && shoot());
    window.addEventListener('keydown', onKey);
    return () => {
      off();
      window.removeEventListener('keydown', onKey);
    };
  }, [gl, scene, camera, name, shotKey]);
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
  /** Drzwi albo klapa w zasięgu ręki pod celownikiem (klawisz interakcji). */
  interactId: string | null;
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

const EMPTY_AIM: Aim = { preview: null, valid: false, targetId: null, surface: null, above: null, paste: null, lookId: null, interactId: null };
/** Zasięg interakcji (m): w grze ok. 4 m od kamery. */
const INTERACT_RANGE = 4;

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
  onToggle,
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
  /** Otwiera albo zamyka drzwi / klapę (klawisz interakcji). */
  onToggle: (id: string) => void;
}) {
  const { camera, scene } = useThree();
  const aimRef = useRef<Aim>(EMPTY_AIM);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const itemsRef = useRef(itemsById);
  useEffect(() => {
    itemsRef.current = itemsById;
  }, [itemsById]);
  const interactKey = useKeybinds((s) => s.binds.interact);
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
      const hit = groundProbe.intersectObjects(sceneMeshes(scene).mapSolids, false)[0];
      if (hit) ground = Math.max(ground, hit.point.y);
      if (ground < base - 10) return 'missingGround';
    } else if (limits.undergroundBlocked && def.shape !== 'bed' && def.shape !== 'hatch' && def.shape !== 'prop') {
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

  useFrame(() => timed('aim', () => {
    raycaster.setFromCamera(center, camera);
    const ray = raycaster.ray;
    // słuchacz dźwięków przestrzennych w miejscu kamery
    setListener(ray.origin.x, ray.origin.y, ray.origin.z, ray.direction.x, ray.direction.y, ray.direction.z);
    let next: Aim = EMPTY_AIM;
    const meshes = sceneMeshes(scene);
    const structureHit = raycaster.intersectObjects(meshes.structures, false).find((h) => h.distance < 90);
    const lookId = structureHit ? hitItemId(structureHit) : null;
    if (useView3D.getState().lookId !== lookId) useView3D.setState({ lookId });
    // Drzwi albo klapa w zasięgu ręki: działa niezależnie od tego, co jest w ręku
    const lookItem = lookId ? itemsById.get(lookId) : undefined;
    const interactId =
      structureHit && lookItem && structureHit.distance <= INTERACT_RANGE && isOpenable(findDef(lookItem.itemId)) ? lookItem.id : null;

    if (!activeDef && !paste) {
      next = { ...EMPTY_AIM, lookId };
    } else if (activeDef?.shape === 'remover' && !paste) {
      next = { ...EMPTY_AIM, targetId: structureHit ? hitItemId(structureHit) : null };
    } else {
      // Najbliższe trafienie: struktura, obiekt mapy albo teren
      const hits: AimHit[] = [];
      if (structureHit) hits.push({ point: structureHit.point, distance: structureHit.distance, ground: false });
      const objHit = raycaster.intersectObjects(meshes.mapSolids, false).find((h) => h.distance < AIM_RANGE);
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
        // Drabina w otworze dachu (kwadratowym albo trójkątnym); bez otworu w pobliżu stawia się jak zwykły rekwizyt
        const ladder = isLadder(def) ? findLadderSlot(def, items, ray3, turn) : null;
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
        } else if (ladder) {
          const aim = judge(def, ladder.preview, ladder.preview.floor || 0, ladder.valid);
          next = ladder.valid ? aim : { ...aim, reason: aim.reason ?? 'frameTaken' };
        } else if (isDoorLike(def)) {
          // Drzwi, bramy, okiennice: tylko w otworze pasującej ściany (jak w grze), R przekłada na drugą stronę
          const slot = findDoorSlot(def, items, ray3, turn);
          if (slot) {
            const aim = judge(def, slot.preview, slot.preview.floor || 0, slot.valid);
            next = slot.valid ? aim : { ...aim, reason: aim.reason ?? 'frameTaken' };
          } else {
            next = { ...EMPTY_AIM, reason: 'needsFrame' };
          }
        } else if (def.shape === 'prop' && nearest) {
          // Rekwizyt (barykada): na powierzchni w punkcie trafienia, obrócony jak gracz, R obraca o 90°
          const floor = roundLevel(nearest.point.y / H);
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

    next = { ...next, interactId };
    aimRef.current = next;
    const p = next.preview;
    const key = `${next.targetId}|${next.lookId}|${next.interactId}|${next.valid}|${next.surface}|${next.reason}|${next.warn}|${p ? `${p.itemId},${p.x},${p.y},${p.rotation},${p.floor}` : ''}|${pasteCache.current.key}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      onAim(next);
    }
  }));

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
      if (e.button !== 0 || useView3D.getState().overlay !== 'none' || useView3D.getState().orbit) return;
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

  // Interakcja (domyślnie F, jak w grze): drzwi, bramy, okiennice i klapy w zasięgu ręki
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== interactKey || e.repeat || useView3D.getState().overlay !== 'none') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const locked = document.pointerLockElement === containerRef.current;
      if (!locked && !lockState.failed) return;
      const id = aimRef.current.interactId;
      if (!id) return;
      e.preventDefault();
      // dźwięk z AudioSource tego przedmiotu w grze, ten sam przy otwieraniu i zamykaniu, z miejsca drzwi
      const item = itemsRef.current.get(id);
      const def = item ? findDef(item.itemId) : undefined;
      if (item && def) playItemSound(def.gameId, id, item.x * SCALE, (item.floor || 0) * H + 1.2, item.y * SCALE);
      onToggle(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactKey, onToggle, containerRef]);

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
  /** Klawisz interakcji: otwiera albo zamyka drzwi / klapę. */
  onToggleItem?: (id: string) => void;
  /** Nazwa projektu: nazwa pliku zdjęcia sceny. */
  projectName?: string;
}

const noPaste = () => {};
const noToggle = () => {};

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
  onToggleItem = noToggle,
  projectName = '',
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
  useEffect(() => useView3D.setState({ walk }), [walk]);
  const [lockFailed, setLockFailed] = useState(lockState.failed);
  const [map, setMap] = useState<MapData | null>(null);
  const overlay = useView3D((s) => s.overlay);
  // Lista rekwizytów z eksportu gry: po wczytaniu findDef zna prop_<id>, więc przerysowujemy
  const propsReady = usePropsStore((s) => s.ready);
  useEffect(() => {
    loadProps();
  }, []);
  const activeDef = activeItem ? findDef(activeItem) : undefined;
  const isDemolish = activeDef?.shape === 'remover';

  // Modele rekwizytów tylko dla tego, co stoi na mapie albo jest w ręku
  useEffect(() => {
    const ids = new Set<number>();
    for (const item of placedItems) {
      const d = findDef(item.itemId);
      if (d?.shape === 'prop' && d.gameId !== undefined) ids.add(d.gameId);
    }
    if (activeDef?.shape === 'prop' && activeDef.gameId !== undefined) ids.add(activeDef.gameId);
    requestPropModels(ids);
  }, [placedItems, activeDef, propsReady]);
  // Dźwięki drzwi i klap z gry: tabela raz, klipy dla tego, co stoi w projekcie
  useEffect(() => {
    void loadSoundTable().then(() =>
      preloadItemSounds(placedItems.map((i) => findDef(i.itemId)).filter((d) => isOpenable(d)).map((d) => d!.gameId!).filter((g) => g !== undefined)),
    );
  }, [placedItems]);
  // Przeglądarka wpuszcza dźwięk dopiero po geście: pierwsze kliknięcie w scenę go odblokowuje
  useEffect(() => {
    const el = containerRef.current;
    el?.addEventListener('pointerdown', resumeAudio);
    return () => el?.removeEventListener('pointerdown', resumeAudio);
  }, []);
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
      // Esc oddaje kursor bez zdarzenia klawisza: wtedy widać panele edytora wokół sceny (bez menu pauzy)
      if (wasLocked && !now) useView3D.setState({ changedAt: performance.now() });
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

  // Cel orbity: środek i promień całego projektu (bez elementów: punkt startu)
  const focus = useMemo(() => {
    if (placedItems.length === 0) return { center: [start[0], start[1] + 2, start[2]] as [number, number, number], radius: 10 };
    const xs = placedItems.map((i) => i.x * SCALE), zs = placedItems.map((i) => i.y * SCALE);
    const ys = placedItems.map((i) => (i.floor || 0) * H);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys) + H;
    return {
      center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] as [number, number, number],
      radius: Math.max(8, Math.hypot(x1 - x0, z1 - z0, y1 - y0) / 2),
    };
  }, [placedItems, start]);
  // Tylko dotyk (telefon, tablet): bez klawiatury i przechwycenia myszy budowanie w 3D nie działa, więc orbita
  const [touchOnly] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches);
  const orbiting = useView3D((s) => s.orbit);

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

  // łóżka (nie flaga claimu) jako punkty odrodzenia, wysokość jak pierścień claimu
  const beds = useMemo(
    () =>
      placedItems
        .filter((i) => {
          const d = findDef(i.itemId);
          return d?.shape === 'bed' || d?.build === 'Bed';
        })
        .map((i): [number, number, number] => [i.x * SCALE, (i.floor || 0) * H + (findDef(i.itemId)?.shape === 'bed' ? TOP : 0), i.y * SCALE]),
    [placedItems],
  );
  // drabiny do wspinania (rekwizyty dochodzą z eksportu później, stąd propsReady)
  const ladders = useMemo(
    () =>
      placedItems.flatMap((i): LadderBox[] => {
        const d = findDef(i.itemId);
        if (!isLadder(d)) return [];
        const [w, h, depth] = d!.size ?? [1.26, 4.25, 0.19];
        const bottom = (i.floor || 0) * H;
        return [{ x: i.x * SCALE, z: i.y * SCALE, rot: (i.rotation * Math.PI) / 180, half: w / 2, depth: depth / 2, bottom, top: bottom + h }];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placedItems, propsReady],
  );
  const [dpr, setDpr] = useState(1.5);
  const [contextLost, setContextLost] = useState(false);
  const ghostDef = aim.preview ? findDef(aim.preview.itemId) : undefined;
  const ghostModel = ghostDef?.gameId !== undefined ? models.get(ghostDef.gameId) : undefined;
  const targeting = isDemolish;

  return (
    <div ref={containerRef} className={styles.container}>
      <Canvas
        shadows="percentage"
        // gęstość pikseli najwyżej 1.5 (ekrany retina i 4K), obniżana do 1 przy spadku płynności
        dpr={dpr}
        // near 0.3: postać ma promień 0.4 m, więc kamera nigdy nie jest bliżej ściany; mniej migotania dalekiego terenu
        camera={{ fov: 72, near: 0.3, far: 5000 }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
        }}
      >
        <Screenshot name={projectName} />
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={3} onFallback={() => setDpr(1)} />
        <SkyAndLight time={scene.time} focus={start} lighting={lighting} />
        {night && <pointLight position={[start[0], start[1] + 7, start[2]]} intensity={70} distance={60} color="#ffb070" />}

        <PlayerCamera containerRef={containerRef} start={start} beds={beds} ladders={ladders} focus={focus} touchOnly={touchOnly} walk={walk} groundAt={groundAt} env={walkEnv} origin={origin} onStatus={setWalkStatus} />
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
          onToggle={onToggleItem}
        />

        {site && activeMap ? (
          <MapSurroundings site={site} map={activeMap} />
        ) : (
          <Meadow lift={0} night={night} />
        )}

        <Structures
          items={shownItems}
          models={models}
          selected={selectedItemIds}
          targetId={targeting ? aim.targetId : null}
          showBedAreas={showBedAreas}
          noSkirt={false}
        />

        {aim.paste && (
          <group userData={{ hideInShot: true }}>
            <PasteGhost paste={aim.paste} models={models} />
          </group>
        )}

        {aim.preview && ghostDef && !paste && (
          <group
            userData={{ hideInShot: true }}
            position={[aim.preview.x * SCALE, (aim.preview.floor || 0) * H + pieceY(ghostDef, ghostModel), aim.preview.y * SCALE]}
            rotation={[0, (-aim.preview.rotation * Math.PI) / 180, 0]}
          >
            <Piece def={ghostDef} model={ghostModel} color="#fff" ghost={aim.valid ? 'ok' : 'bad'} />
          </group>
        )}
      </Canvas>

      <div className={styles.crosshair} data-mode={isDemolish ? 'demolish' : 'build'} aria-hidden />

      {!locked && overlay === 'none' && !orbiting && (
        <div className={styles.lockHint}>
          {lockFailed
            ? t.view3d.lockFailed
            : t.view3d.lockHint}
        </div>
      )}

      {/* Stan postaci jak w Unturned: lewy dolny róg, ikona i pasek na wiersz; tylko przy chodzeniu (fizyka z gry) */}
      {walk && walkStatus && (
        <div className={styles.vitals} data-ui>
          {(walkStatus.stance !== 'stand' || walkStatus.legsBroken) && (
            <div className={styles.vitalTags}>
              {t.view3d.stances[walkStatus.stance] && (
                <span>
                  {walkStatus.stance === 'swim' ? <PersonSimpleSwim size={15} weight="fill" /> : walkStatus.stance === 'sprint' ? <PersonSimpleRun size={15} weight="fill" /> : <PersonSimple size={15} weight="fill" />}
                  {t.view3d.stances[walkStatus.stance]}
                </span>
              )}
              {walkStatus.legsBroken && (
                <span data-bad>
                  <Bone size={15} weight="fill" />
                  {t.view3d.legsBroken}
                </span>
              )}
            </div>
          )}
          <div className={styles.vital} data-kind="health" title={t.view3d.health}>
            <span className={styles.vitalIcon}>
              <Heart size={16} weight="fill" />
            </span>
            <span className={styles.bar} aria-label={`${t.view3d.health}: ${walkStatus.health}`}>
              <span style={{ width: `${walkStatus.health}%` }} />
              <em>{walkStatus.health}</em>
            </span>
          </div>
          <div className={styles.vital} data-kind="oxygen" title={t.view3d.oxygen}>
            <span className={styles.vitalIcon}>
              <Wind size={16} weight="bold" />
            </span>
            <span className={styles.bar} aria-label={`${t.view3d.oxygen}: ${walkStatus.oxygen}`}>
              <span style={{ width: `${walkStatus.oxygen}%` }} />
              <em>{walkStatus.oxygen}</em>
            </span>
          </div>
        </div>
      )}
      {walk && walkStatus?.dead && <div className={styles.deathNote}>{beds.length ? t.view3d.deadBed : t.view3d.dead}</div>}
      {orbiting && (
        <div className={styles.orbitBar} data-ui>
          <span>{touchOnly ? t.commands.orbitTouch : t.commands.orbit}</span>
          {!touchOnly && (
            <button type="button" onClick={() => sendSceneCommand({ kind: 'orbit', on: false })}>
              {t.view3d.orbitExit}
            </button>
          )}
        </div>
      )}
      {contextLost && (
        <div className={styles.contextLost} data-ui role="alert">
          <p>{t.view3d.contextLost}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {t.view3d.reload}
          </button>
        </div>
      )}

      {!paste && aim.interactId ? (() => {
        // jak w grze: podpowiedź interakcji tuż pod celownikiem, klawisz w ramce i nazwa przedmiotu
        const item = placedItems.find((i) => i.id === aim.interactId);
        const def = item ? findDef(item.itemId) : undefined;
        return (
          <div className={styles.interact} data-ui>
            <kbd>{keyLabel(binds.interact, { space: t.keys.space, shift: t.keys.shift })}</kbd>
            <span>
              {item?.open ? t.hud.closeHint : t.hud.openHint}
              {def && <strong>{itemLabel(def, t)}</strong>}
            </span>
          </div>
        );
      })() : (
        !activeDef && !paste && aim.lookId && (
          <div className={styles.aimStatus} data-ui>
            <kbd>{keyLabel(binds.grab, { space: t.keys.space, shift: t.keys.shift })}</kbd>
            <span>{t.hud.grabHint}</span>
          </div>
        )
      )}

      {/* Kalkulator raidu: element pod celownikiem (bez niczego w ręku albo przy wyburzaniu) */}
      {!paste && (!activeDef || isDemolish) && (() => {
        const id = isDemolish ? aim.targetId : aim.lookId;
        const item = id ? placedItems.find((i) => i.id === id) : undefined;
        const def = item ? findDef(item.itemId) : undefined;
        return def ? <RaidInfo def={def} className={styles.raidInfo} /> : null;
      })()}

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
