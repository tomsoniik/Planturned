"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { instanceMatrix, loadMapScene, loadSceneryModel, type MapScene, type SceneryModel } from '@/lib/mapScene';
import type { Site } from '@/lib/terrain';

// Jeden materiał dla wszystkich obiektów mapy: kolory z palety gry siedzą w wierzchołkach.
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });

interface Group {
  guid: string;
  kind: string;
  rows: number[][];
}

/** Jedna część modelu (bryła albo liście) we wszystkich wystąpieniach typu. */
function InstancedPart({
  geometry,
  mat,
  matrices,
  userData,
}: {
  geometry: THREE.BufferGeometry;
  mat: THREE.Material;
  matrices: Float32Array;
  userData: Record<string, boolean>;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.array.set(matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);

  return <instancedMesh ref={ref} args={[geometry, mat, matrices.length / 16]} castShadow receiveShadow userData={userData} />;
}

/** Jeden typ obiektu: wszystkie jego wystąpienia w wycinku jako InstancedMesh (po jednym na część modelu). */
function InstancedType({ group, origin }: { group: Group; origin: { x: number; y: number; z: number } }) {
  const [model, setModel] = useState<SceneryModel | null>(null);

  useEffect(() => {
    let alive = true;
    loadSceneryModel(group.guid).then((g) => alive && setModel(g));
    return () => {
      alive = false;
    };
  }, [group.guid]);

  const matrices = useMemo(() => {
    const out = new Float32Array(group.rows.length * 16);
    const m = new THREE.Matrix4();
    group.rows.forEach((row, i) => instanceMatrix(row, origin, m).toArray(out, i * 16));
    return out;
  }, [group.rows, origin]);

  if (!model) return null;
  const tree = group.kind === 'tree';
  return (
    <>
      {model.solid && (
        // drzewa: w grze kolizja tylko na pniu, więc nie służą za podłoże przy chodzeniu
        <InstancedPart geometry={model.solid} mat={material} matrices={matrices} userData={{ mapObject: true, tree }} />
      )}
      {model.cutouts.map((c, i) => (
        // liście i siatki: przezroczyste karty bez kolizji, nie stoi się na nich i nie blokują ruchu
        <InstancedPart key={i} geometry={c.geometry} mat={c.material} matrices={matrices} userData={{ mapObject: true, tree: true, cutout: true }} />
      ))}
    </>
  );
}

/**
 * Budynki, skały i drzewa z mapy gry w promieniu `radius` od `center` (punkt sceny), 1:1 z plików poziomu.
 * `lift`: skybase opuszcza świat o tę wysokość.
 */
export default function MapObjects({
  site,
  lift,
  radius,
  center,
}: {
  site: Site;
  lift: number;
  radius: number;
  center: [number, number];
}) {
  const [scene, setScene] = useState<MapScene | null>(null);

  useEffect(() => {
    let alive = true;
    loadMapScene(site.map).then((s) => alive && setScene(s));
    return () => {
      alive = false;
    };
  }, [site.map]);

  const groups = useMemo(() => {
    if (!scene) return [];
    const byType = new Map<number, number[][]>();
    const r2 = radius * radius;
    const cx = site.x + center[0], cz = site.z - center[1];
    scene.inst.forEach((row) => {
      const dx = row[1] - cx, dz = row[3] - cz;
      if (dx * dx + dz * dz > r2) return;
      let list = byType.get(row[0]);
      if (!list) byType.set(row[0], (list = []));
      list.push(row);
    });
    return [...byType.entries()].map(([t, rows]): Group => ({ guid: scene.types[t].guid, kind: scene.types[t].kind, rows }));
  }, [scene, site.x, site.z, radius, center]);

  const origin = useMemo(() => ({ x: site.x, y: site.elevation + lift, z: site.z }), [site.x, site.z, site.elevation, lift]);

  return (
    <>
      {groups.map((g) => (
        <InstancedType key={`${g.guid}-${g.rows.length}`} group={g} origin={origin} />
      ))}
    </>
  );
}
