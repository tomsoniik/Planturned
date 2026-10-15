"use client";

import { useLayoutEffect, useMemo, useRef } from 'react';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { TimeOfDay } from '@/lib/scene';

// --- Szum wartości (deterministyczny, bez zależności) ---

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const FLAT = 75; // promień płaskiego placu budowy
const SPAN = 1000;

/** Wysokość łąki (m) w punkcie (x, z) sceny; w środku płasko, dalej pagórki i góry na horyzoncie. */
export function meadowHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  const t = Math.min(1, Math.max(0, (r - FLAT) / 70));
  const k = t * t * (3 - 2 * t);
  let h = noise(x / 90, z / 90) * 16 + noise(x / 32, z / 32) * 4 + noise(x / 11, z / 11) * 0.7 - 7;
  const far = Math.max(0, (r - 280) / 180);
  h += far * far * 55 * (0.4 + noise(x / 140 + 7, z / 140 + 3));
  return k * h;
}

// --- Pory dnia ---

export interface TimeLook {
  sky: string;
  fog: [number, number];
  sun: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  hemi: [string, string, number];
  ambient: number;
}

export const TIME_LOOK: Record<TimeOfDay, TimeLook> = {
  day: {
    sky: '#b8cfe2',
    fog: [160, 520],
    sun: [120, 160, 70],
    sunColor: '#fff3df',
    sunIntensity: 2.4,
    hemi: ['#d6e8ff', '#4f5f34', 0.85],
    ambient: 0.25,
  },
  dusk: {
    sky: '#d9a183',
    fog: [120, 420],
    sun: [-200, 18, 90],
    sunColor: '#ffae6b',
    sunIntensity: 1.6,
    hemi: ['#ffc8a0', '#3b2e22', 0.55],
    ambient: 0.18,
  },
  night: {
    sky: '#070b14',
    fog: [70, 300],
    sun: [-60, 140, -90],
    sunColor: '#9fb6ff',
    sunIntensity: 0.4,
    hemi: ['#2c3a5c', '#0b0d10', 0.25],
    ambient: 0.1,
  },
};

/** Niebo, światło i mgła dla wybranej pory dnia. */
export function SkyAndLight({
  time,
  focus,
  extend = 0,
}: {
  time: TimeOfDay;
  focus: [number, number, number];
  /** Minimalny zasięg mgły (skybase: ziemia daleko w dole ma być widoczna). */
  extend?: number;
}) {
  const look = TIME_LOOK[time];
  const fogFar = Math.max(look.fog[1], extend);
  const fogNear = Math.max(look.fog[0], extend * 0.45);
  const sunPos = useMemo(() => new THREE.Vector3(...look.sun).normalize().multiplyScalar(400), [look]);
  const light = useRef<THREE.DirectionalLight>(null);

  // Cień liczony wokół bazy: światło i jego cel przesuwają się razem z punktem focus.
  useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    l.position.set(focus[0] + look.sun[0], focus[1] + look.sun[1], focus[2] + look.sun[2]);
    l.target.position.set(focus[0], focus[1], focus[2]);
    l.target.updateMatrixWorld();
  }, [focus, look]);

  return (
    <>
      <color attach="background" args={[look.sky]} />
      <fog attach="fog" args={[look.sky, fogNear, fogFar]} />
      {time === 'night' ? (
        <Stars radius={400} depth={80} count={5000} factor={5} saturation={0} fade speed={0.3} />
      ) : (
        <Sky
          distance={4500}
          sunPosition={sunPos}
          turbidity={time === 'dusk' ? 9 : 3.5}
          rayleigh={time === 'dusk' ? 3 : 1.2}
          mieCoefficient={0.006}
          mieDirectionalG={0.85}
        />
      )}
      <ambientLight intensity={look.ambient} />
      <hemisphereLight args={look.hemi} />
      <directionalLight
        ref={light}
        intensity={look.sunIntensity}
        color={look.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={600}
        shadow-bias={-0.0004}
      />
    </>
  );
}

// --- Łąka z drzewami i skałami (gdy projekt nie ma mapy z gry) ---

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function Meadow({ lift, night }: { lift: number; night: boolean }) {
  const ground = useMemo(() => {
    const seg = 200;
    const g = new THREE.PlaneGeometry(SPAN, SPAN, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color('#5d7a35'), dry = new THREE.Color('#8a8a4a'), dirt = new THREE.Color('#6b5a3e'), rock = new THREE.Color('#7b7a74');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = meadowHeight(x, z);
      pos.setY(i, h);
      const n = noise(x / 18, z / 18);
      c.copy(grass).lerp(dry, n * 0.6);
      if (Math.hypot(x, z) < FLAT * 0.85) c.lerp(dirt, 0.18 + 0.12 * noise(x / 6, z / 6));
      if (h > 35) c.lerp(rock, Math.min(1, (h - 35) / 25));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  const trees = useMemo(() => {
    const rnd = seeded(42);
    const list: { x: number; z: number; y: number; s: number; r: number }[] = [];
    while (list.length < 520) {
      const a = rnd() * Math.PI * 2;
      const d = FLAT + 12 + Math.sqrt(rnd()) * 380;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (noise(x / 60 + 11, z / 60 + 5) < 0.42) continue; // polany
      list.push({ x, z, y: meadowHeight(x, z), s: 0.75 + rnd() * 0.6, r: rnd() * Math.PI });
    }
    return list;
  }, []);

  const rocks = useMemo(() => {
    const rnd = seeded(7);
    return Array.from({ length: 90 }, () => {
      const a = rnd() * Math.PI * 2;
      const d = FLAT * 0.6 + rnd() * 350;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      return { x, z, y: meadowHeight(x, z), s: 0.5 + rnd() * 1.8, r: rnd() * Math.PI };
    });
  }, []);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const leaf2Ref = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    trees.forEach((t, i) => {
      m.position.set(t.x, t.y + 1.6 * t.s, t.z);
      m.rotation.set(0, t.r, 0);
      m.scale.setScalar(t.s);
      m.updateMatrix();
      trunkRef.current?.setMatrixAt(i, m.matrix);
      m.position.set(t.x, t.y + 5 * t.s, t.z);
      m.updateMatrix();
      leafRef.current?.setMatrixAt(i, m.matrix);
      m.position.set(t.x, t.y + 7.6 * t.s, t.z);
      m.updateMatrix();
      leaf2Ref.current?.setMatrixAt(i, m.matrix);
    });
    rocks.forEach((r, i) => {
      m.position.set(r.x, r.y + r.s * 0.3, r.z);
      m.rotation.set(r.r, r.r * 2, 0);
      m.scale.set(r.s, r.s * 0.7, r.s);
      m.updateMatrix();
      rockRef.current?.setMatrixAt(i, m.matrix);
    });
    [trunkRef, leafRef, leaf2Ref, rockRef].forEach((ref) => {
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    });
  }, [trees, rocks]);

  const leaf = night ? '#1f3324' : '#2f5a2c';

  return (
    <group position={[0, -lift, 0]}>
      <mesh geometry={ground} receiveShadow userData={{ terrain: true }}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </mesh>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.25, 0.4, 3.2, 6]} />
        <meshStandardMaterial color="#5a4330" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[2.6, 5.2, 7]} />
        <meshStandardMaterial color={leaf} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={leaf2Ref} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[1.8, 3.8, 7]} />
        <meshStandardMaterial color={leaf} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={rockRef} args={[undefined, undefined, rocks.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#87857f" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
