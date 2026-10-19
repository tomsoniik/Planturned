"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import styles from './Builder3D.module.css';
import {
  LEVEL_HEIGHT,
  SIDE,
  TRI_H,
  computePlacement,
  findDef,
  findSlabSlotByRay,
  findSlotByRay,
  isPlacementValid,
  wallMissingPillars,
  isRoofLayer,
  type BuildItem,
  type PlacedItem,
} from '@/lib/builder';
import { loadGameModels, type GameModel } from '@/lib/gameModels';
import { loadMap, mapOverviewUrl, mapTileUrl, tilesInRange, type MapData, type Site } from '@/lib/terrain';
import { DEFAULT_SCENE, type SceneSettings } from '@/lib/scene';
import { itemLabel, type AimReason, type AimWarn } from '@/lib/i18n';
import { useT } from './I18nProvider';
import { keyLabel, useKeybinds } from '@/lib/keybinds';
import {
  AIR_ACCEL, AIR_DECEL, EYES, EYES_LERP, FALL_DAMAGE_MAX, FALL_DAMAGE_SPEED, GRAVITY, HEIGHT, JUMP_SPEED, MAX_SLOPE_DEG,
  RADIUS, SLIDE_ACCEL, SPEED, SWIM_BODY_DEPTH, SWIM_MULTIPLIER, SWIM_SURFACE_OFFSET, SWIM_UP_SPEED, TERMINAL_VELOCITY, TICK,
  breathAtHeight, oxygenTick, type OxygenState, type Stance, type Vitals,
} from '@/lib/playerPhysics';
import { Meadow, SkyAndLight, meadowHeight } from './Scenery';
import MapObjects from './MapObjects';
import { GameRoads, useGroundMaterial } from './GameGround';

// --- Wymiary w metrach (zgodne z modelami gry) ---
export const SCALE = 1 / 10; // jednostki planu -> metry
const S = SIDE * SCALE; // bok podłogi: 6 m
const H = LEVEL_HEIGHT; // wysokość poziomu: 4,5 m
const TOP = 0.25; // wierzch podłogi nad jej pivotem
const WALL_BASE = 0.125; // spód ścian, filarów i słupków nad poziomem
const TERRAIN_SPAN = 680; // bok wycinka terenu w 3D
const OBJECT_RADIUS = 330; // promień, w którym wczytujemy obiekty mapy

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
  const shadow = !ghost;

  if (model) {
    return (
      <mesh geometry={model.geometry} castShadow={shadow} receiveShadow={shadow} userData={{ itemId }}>
        {material}
      </mesh>
    );
  }
  const triangle = def.shape === 'triangle';
  return (
    <mesh
      position={triangle ? [0, -0.25, 0] : fallbackOffset(def)}
      rotation={triangle ? [-Math.PI / 2, 0, 0] : undefined}
      castShadow={shadow}
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

// --- Teren mapy z gry ---

function TerrainPatch({ site, map }: { site: Site; map: MapData }) {
  const { meta, heightAt } = map;
  // Tekstury terenu z gry (splatmapy); bez nich (stary eksport) satelita z Map.png
  const ground = useGroundMaterial(map, site);

  const geometry = useMemo(() => {
    const seg = Math.round(TERRAIN_SPAN / 2.5);
    const g = new THREE.PlaneGeometry(TERRAIN_SPAN, TERRAIN_SPAN, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(site.x + x, site.z - z) - site.elevation);
    }
    g.computeVertexNormals();
    return g;
  }, [site.x, site.z, site.elevation, heightAt]);

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    if (meta.terrain) return;
    let alive = true;
    const half = TERRAIN_SPAN / 2;
    const metersPerPx = meta.extent / (meta.tiles * 512);
    const px = Math.ceil(TERRAIN_SPAN / metersPerPx);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#3c4a2c';
    ctx.fillRect(0, 0, px, px);
    const tiles = tilesInRange(meta, site.x, site.z, half);
    Promise.all(
      tiles.map(
        (t) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              // Lewy górny róg kafla względem lewego górnego rogu wycinka (zachód, północ).
              const dx = (t.left - (site.x - half)) / metersPerPx;
              const dy = (site.z + half - t.top) / metersPerPx;
              ctx.drawImage(img, dx, dy, t.size / metersPerPx, t.size / metersPerPx);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = mapTileUrl(meta.id, t.tx, t.ty);
          }),
      ),
    ).then(() => {
      if (!alive) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      setTexture(tex);
    });
    return () => {
      alive = false;
    };
  }, [meta, site.x, site.z]);

  return (
    <>
      {ground ? (
        <mesh geometry={geometry} material={ground} receiveShadow userData={{ terrain: true }} />
      ) : (
        <mesh geometry={geometry} receiveShadow userData={{ terrain: true }}>
          {/* key: materiał musi się przekompilować, gdy dochodzi tekstura (map z null na teksturę) */}
          <meshStandardMaterial key={texture ? 'tex' : 'plain'} map={texture} color={texture ? '#ffffff' : '#3c4a2c'} roughness={1} />
        </mesh>
      )}
      <GameRoads site={site} map={map} span={TERRAIN_SPAN / 2 + 40} />
      <FarTerrain site={site} map={map} ground={ground} />
      {meta.seaLevel !== null && (
        <mesh position={[0, meta.seaLevel - site.elevation, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[meta.extent * 2.5, meta.extent * 2.5]} />
          <meshStandardMaterial color="#2c4a5e" transparent opacity={0.78} roughness={0.15} metalness={0.1} />
        </mesh>
      )}
    </>
  );
}

const FAR_STEP = 16; // rozdzielczość terenu całej mapy (m)

/**
 * Reszta mapy poza wycinkiem: cała mapa w niskiej rozdzielczości z podglądem satelity.
 * Widać ją głównie ze skybase; środek (szczegółowy wycinek) jest wycięty, a całość lekko obniżona, żeby nie przebijała.
 */
function FarTerrain({ site, map, ground }: { site: Site; map: MapData; ground: THREE.MeshStandardMaterial | null }) {
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
    // Pomijamy kwadraty leżące w całości wewnątrz szczegółowego wycinka.
    const inner = TERRAIN_SPAN / 2 - FAR_STEP;
    const inside = (k: number) => Math.abs(pos[k * 3]) < inner && Math.abs(pos[k * 3 + 2]) < inner;
    const index: number[] = [];
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const a = r * n + c, b = a + 1, d = a + n, e = d + 1;
        if (inside(a) && inside(b) && inside(d) && inside(e)) continue;
        index.push(a, d, b, b, d, e);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, [meta.extent, site.x, site.z, site.elevation, heightAt]);

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

  if (ground) return <mesh geometry={geometry} material={ground} receiveShadow />;
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial key={texture ? 'tex' : 'plain'} map={texture} color={texture ? '#ffffff' : '#3c4a2c'} roughness={1} />
    </mesh>
  );
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
  onStatus,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  start: [number, number, number];
  walk: boolean;
  groundAt: (x: number, z: number) => number;
  env: WalkEnv;
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
  // ?debug w adresie: stan kamery i postaci do testów (window.__planturned)
  useEffect(() => {
    if (!window.location.search.includes('debug')) return;
    const probe = () => {
      const p = camera.position;
      const ray = new THREE.Raycaster(new THREE.Vector3(p.x, p.y - phys.current.eyes + 0.5, p.z), new THREE.Vector3(0, -1, 0), 0, 80);
      const hits: THREE.Object3D[] = [];
      scene.traverse((o) => (o as THREE.Mesh).isMesh && hits.push(o));
      return ray.intersectObjects(hits, false).slice(0, 3).map((h) => ({ y: h.point.y, data: h.object.userData, name: h.object.type }));
    };
    (window as unknown as { __planturned: unknown }).__planturned = { camera, phys: phys.current, groundAt, probe };
  }, [camera, groundAt, scene]);
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
      if (document.pointerLockElement === container) return;
      try {
        const res = container?.requestPointerLock() as unknown as Promise<void> | undefined;
        res?.catch?.(() => markLockFailed());
      } catch {
        markLockFailed();
      }
    };
    const onLockError = () => markLockFailed();
    const keyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
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
      if ((o as THREE.Mesh).isMesh && (o.userData.itemId || o.userData.road || o.userData.mapObject)) meshes.push(o);
    });
    const solids = meshes.filter((m) => !m.userData.road);
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
  /** Poziom powierzchni, na którą celujemy (0 = ziemia). */
  surface: number | null;
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

const EMPTY_AIM: Aim = { preview: null, valid: false, targetId: null, surface: null };

/** Siatki postawionych struktur (do celowania i kolizji). */
function structureMeshes(scene: THREE.Scene) {
  const out: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.userData.itemId) out.push(o);
  });
  return out;
}

function AimController({
  containerRef,
  activeDef,
  items,
  mode,
  limits,
  turn,
  onAim,
  onPlace,
  onDelete,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeDef?: BuildItem;
  items: PlacedItem[];
  mode: SceneSettings['mode'];
  limits: SceneLimits;
  turn: number;
  onAim: (aim: Aim) => void;
  onPlace: (item: Omit<PlacedItem, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const { camera, scene } = useThree();
  const aimRef = useRef<Aim>(EMPTY_AIM);
  const lastKey = useRef('');
  const downRay = useMemo(() => new THREE.Raycaster(), []);

  /** Zasady z gry dla punktu stawiania (UseableHousingUtils, HousingConnections). */
  const gameRule = (def: BuildItem, preview: PlacedItem, surface: number): AimReason | undefined => {
    const px = preview.x * SCALE, pz = preview.y * SCALE;
    const base = surface * H;
    if (limits.inSafezone(px, base + 1, pz)) return 'safezone';
    if (limits.nearSpawn(px, base + 1, pz)) return 'spawn';
    if (wallMissingPillars(def, preview, items)) return 'missingPillar';
    if (!limits.groundY) return undefined;
    const floorPart = def.part === 'floor' || def.part === 'tri_floor';
    if (floorPart) {
      // IsFloorAboveGround: teren albo duży obiekt mapy najwyżej 10 m pod środkiem podłogi
      let ground = limits.groundY(px, pz);
      downRay.set(new THREE.Vector3(px, base + 1, pz), new THREE.Vector3(0, -1, 0));
      downRay.far = 11;
      const objs: THREE.Object3D[] = [];
      scene.traverse((o) => (o as THREE.Mesh).isMesh && o.userData.mapObject && !o.userData.tree && objs.push(o));
      const hit = downRay.intersectObjects(objs, false)[0];
      if (hit) ground = Math.max(ground, hit.point.y);
      if (ground < base - 10) return 'missingGround';
    } else if (limits.undergroundBlocked && def.shape !== 'bed' && def.shape !== 'hatch') {
      // UndergroundAllowlist: element w całości pod terenem
      const r = (preview.rotation * Math.PI) / 180;
      const pts = def.shape === 'wall'
        ? [-3, 0, 3].map((o) => [px + o * Math.cos(r), pz + o * Math.sin(r)])
        : [[px, pz]];
      const topY = def.shape === 'wall' || def.shape === 'pillar' ? base + H : base;
      if (pts.every(([x, z]) => topY < limits.groundY!(x, z))) return 'underground';
    }
    return undefined;
  };
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const center = useMemo(() => new THREE.Vector2(0, 0), []);

  useFrame(() => {
    raycaster.setFromCamera(center, camera);
    let next: Aim = EMPTY_AIM;
    const hit = raycaster.intersectObjects(structureMeshes(scene), false).find((h) => h.distance < 90);

    if (!activeDef || activeDef.shape === 'remover') {
      if (activeDef) {
        next = { ...EMPTY_AIM, targetId: hit ? (hit.object.userData.itemId as string) : null };
      }
    } else {
      // Ściany i filary jak w grze: wolny slot najbliżej celownika (do 8 m), nawet gdy promień trafia w pustkę.
      const o = raycaster.ray.origin, d = raycaster.ray.direction;
      const slot = findSlotByRay(activeDef, items, { origin: { x: o.x, y: o.y, z: o.z }, dir: { x: d.x, y: d.y, z: d.z } }, turn);
      if (slot) {
        const surface = slot.floor || 0;
        const top = surface * H + H;
        let reason: AimReason | undefined;
        let warn: AimWarn | undefined;
        if (top > limits.limitY) reason = 'mapLimit';
        else if (limits.inClip(slot.x * SCALE, surface * H + 1, slot.y * SCALE)) reason = 'noBuildZone';
        else reason = gameRule(activeDef, slot, surface);
        if (!reason && limits.oxygenY !== null && top > limits.oxygenY) warn = 'oxygen';
        next = { preview: slot, valid: isPlacementValid(activeDef, slot, items) && !reason, targetId: null, surface, reason, warn };
      }
    }
    if (activeDef && activeDef.shape !== 'remover' && !next.preview) {
      // Poziom z celownika: górna połowa ściany albo wierzch dachu to kolejna kondygnacja.
      const roofLike = isRoofLayer(activeDef) || activeDef.shape === 'hatch';
      // Podłogi i dachy jak w grze: wolne miejsce przy krawędzi najbliżej celownika, na poziomie tej krawędzi.
      const o = raycaster.ray.origin, d = raycaster.ray.direction;
      const slabSlot = findSlabSlotByRay(activeDef, items, { origin: { x: o.x, y: o.y, z: o.z }, dir: { x: d.x, y: d.y, z: d.z } }, turn);
      let surface = hit ? Math.max(0, Math.round((hit.point.y - TOP) / H)) : mode === 'sky' ? 1 : 0;
      if (roofLike && surface < 1) surface = 1;
      if (slabSlot?.preview) surface = (slabSlot.preview.floor || 0) + (roofLike ? 1 : 0);
      const level = roofLike ? surface - 1 : surface;
      const planeY = surface * H + TOP;
      const point = new THREE.Vector3();
      const onPlane = slabSlot ? null : raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), point);
      if (!onPlane && hit) point.copy(hit.point);
      if (slabSlot || ((onPlane || hit) && camera.position.distanceTo(point) < 120)) {
        const res = slabSlot ?? computePlacement({
          def: activeDef,
          items,
          cursor: { x: point.x / SCALE, y: point.z / SCALE },
          floor: level,
          turn,
        });
        const floorPart = activeDef.part === 'floor' || activeDef.part === 'tri_floor';
        let reason: AimReason | undefined;
        let warn: AimWarn | undefined;
        const top = surface * H + H;
        const px = (res.preview?.x ?? 0) * SCALE, pz = (res.preview?.y ?? 0) * SCALE;
        if (floorPart && mode === 'sky') reason = 'skyFloor';
        else if (floorPart && level > 0) reason = 'floorGroundOnly';
        else if (top > limits.limitY) reason = 'mapLimit';
        else if (limits.inClip(px, surface * H + 1, pz)) reason = 'noBuildZone';
        else if (res.preview) reason = gameRule(activeDef, res.preview, level);
        if (!reason && limits.oxygenY !== null && top > limits.oxygenY) warn = 'oxygen';
        next = { preview: res.preview, valid: res.valid && !reason, targetId: null, surface, reason, warn };
      }
    }

    aimRef.current = next;
    const p = next.preview;
    const key = `${next.targetId}|${next.valid}|${next.surface}|${p ? `${p.itemId},${Math.round(p.x)},${Math.round(p.y)},${p.rotation},${p.floor}` : ''}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      onAim(next);
    }
  });

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // Pierwszy klik tylko przejmuje kamerę; przy przechwyconej myszce target to kontener, nie canvas.
      const locked = document.pointerLockElement === containerRef.current;
      const fallback = lockState.failed && e.target instanceof HTMLCanvasElement;
      if (!locked && !fallback) return;
      const aim = aimRef.current;
      if (activeDef?.shape === 'remover') {
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
  }, [activeDef, onPlace, onDelete, containerRef]);

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
  onPlaceItem: (item: Omit<PlacedItem, 'id'>) => void;
  onDeleteItem: (id: string) => void;
}

export default function Builder3D({
  placedItems,
  activeItem,
  turn,
  showBedAreas,
  selectedItemIds,
  scene = DEFAULT_SCENE,
  site,
  onPlaceItem,
  onDeleteItem,
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
  const activeDef = activeItem ? findDef(activeItem) : undefined;
  const isDemolish = activeDef?.shape === 'remover';
  const siteMap = site?.map;
  const sky = scene.mode === 'sky';
  // Skybase: baza zostaje w (0,0,0), a cały świat opuszczamy o wysokość zawieszenia.
  const lift = sky ? scene.skyHeight : 0;
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
    const onChange = () => setLocked(document.pointerLockElement === containerRef.current);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === flyKeyRef.current) setWalk((w) => !w);
    };
    document.addEventListener('pointerlockchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      lockState.listeners.delete(onFail);
      document.removeEventListener('pointerlockchange', onChange);
      window.removeEventListener('keydown', onKey);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, []);

  // Środek bazy liczony raz przy wejściu w 3D (kamera startuje przed bazą).
  const [start] = useState<[number, number, number]>(() => {
    const baseY = sky ? H : 0;
    if (placedItems.length === 0) return [0, baseY, 0];
    const xs = placedItems.map((i) => i.x * SCALE);
    const zs = placedItems.map((i) => i.y * SCALE);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, baseY, (Math.min(...zs) + Math.max(...zs)) / 2];
  });

  const activeMap = site && map && map.meta.id === site.map ? map : null;

  // Limity wysokości (docs/sky-limits.md). Bez mapy: teren i woda na 0 m.
  const limits = useMemo<SceneLimits>(() => {
    const meta = activeMap?.meta;
    const baseWorld = (site && activeMap ? site.elevation : 0) + lift;
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
  }, [activeMap, site, lift]);
  // Woda i tlen dla chodzenia: poziom wody w układzie sceny, przesunięcie sceny względem świata gry
  const walkEnv = useMemo(() => {
    const meta = activeMap?.meta;
    const baseWorld = (site && activeMap ? site.elevation : 0) + lift;
    const sea = meta?.seaLevel ?? null;
    return {
      waterY: sea === null ? null : sea - baseWorld,
      waterWorld: sea ?? 0,
      baseWorld,
      legacyOxygen: meta ? meta.oxygen !== false : true,
    };
  }, [activeMap, site, lift]);
  const [walkStatus, setWalkStatus] = useState<WalkStatus | null>(null);
  const groundAt = useMemo(() => {
    if (site && activeMap) return (x: number, z: number) => activeMap.heightAt(site.x + x, site.z - z) - site.elevation - lift;
    return (x: number, z: number) => meadowHeight(x, z) - lift;
  }, [site, activeMap, lift]);

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
        <SkyAndLight time={scene.time} focus={start} extend={sky ? lift * 1.6 + 260 : 0} />
        {night && <pointLight position={[start[0], start[1] + 7, start[2]]} intensity={70} distance={60} color="#ffb070" />}

        <PlayerCamera containerRef={containerRef} start={start} walk={walk} groundAt={groundAt} env={walkEnv} onStatus={setWalkStatus} />
        <AimController
          containerRef={containerRef}
          activeDef={activeDef}
          items={placedItems}
          mode={scene.mode}
          limits={limits}
          turn={turn}
          onAim={setAim}
          onPlace={onPlaceItem}
          onDelete={onDeleteItem}
        />

        {site && activeMap ? (
          <>
            <TerrainPatch site={{ ...site, elevation: site.elevation + lift }} map={activeMap} />
            <MapObjects site={site} lift={lift} radius={OBJECT_RADIUS} />
          </>
        ) : (
          <Meadow lift={lift} night={night} />
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

        {placedItems.map((item) => (
          <Item3D
            key={item.id}
            item={item}
            models={models}
            isSelected={selectedItemIds.includes(item.id)}
            isTargeted={targeting && aim.targetId === item.id}
            showBedAreas={showBedAreas}
            noSkirt={sky}
          />
        ))}

        {aim.preview && ghostDef && (
          <group
            position={[aim.preview.x * SCALE, (aim.preview.floor || 0) * H + pieceY(ghostDef, ghostModel), aim.preview.y * SCALE]}
            rotation={[0, (-aim.preview.rotation * Math.PI) / 180, 0]}
          >
            <Piece def={ghostDef} model={ghostModel} color="#fff" ghost={aim.valid ? 'ok' : 'bad'} />
          </group>
        )}
      </Canvas>

      <div className={styles.crosshair} data-mode={isDemolish ? 'demolish' : 'build'} aria-hidden />

      {!locked && (
        <div className={styles.lockHint}>
          {lockFailed
            ? t.view3d.lockFailed
            : t.view3d.lockHint}
        </div>
      )}

      <div className={styles.modeBadge} data-ui>
        {walk ? t.view3d.walking : t.view3d.flying} <kbd>{keyLabel(binds.toggleFly, { space: t.keys.space, shift: t.keys.shift })}</kbd>
        {sky && <span className={styles.modeMap}>Skybase {scene.skyHeight} m</span>}
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

      {/* Stan celownika: tylko gdy trzymasz element, skróty są w zakładce Skróty */}
      {activeDef && !isDemolish && (
        <div className={styles.aimStatus} data-ui data-bad={!aim.valid || undefined}>
          <strong>{itemLabel(activeDef, t)}</strong>
          {aim.reason ? t.view3d.reasons[aim.reason] : aim.warn ? t.view3d.warns[aim.warn] : aim.preview ? (aim.valid ? t.view3d.fits : t.view3d.collides) : t.view3d.aimAtGrid}
          {aim.surface !== null && (
            <span>{aim.surface === 0 ? t.view3d.ground : t.view3d.level(aim.surface)}, {(aim.surface * H).toFixed(1)} m</span>
          )}
        </div>
      )}
    </div>
  );
}
