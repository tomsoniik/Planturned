"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { instanceMatrix, loadMapScene, loadSceneryModel, type MapScene } from '@/lib/mapScene';
import type { Site } from '@/lib/terrain';

// Jeden materiał dla wszystkich obiektów mapy: kolory z palety gry siedzą w wierzchołkach.
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });

interface Group {
  guid: string;
  kind: string;
  rows: number[][];
}

/** Jeden typ obiektu: wszystkie jego wystąpienia w wycinku jako InstancedMesh. */
function InstancedType({ group, origin }: { group: Group; origin: { x: number; y: number; z: number } }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    let alive = true;
    loadSceneryModel(group.guid).then((g) => alive && setGeometry(g));
    return () => {
      alive = false;
    };
  }, [group.guid]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || !geometry) return;
    const m = new THREE.Matrix4();
    group.rows.forEach((row, i) => mesh.setMatrixAt(i, instanceMatrix(row, origin, m)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [geometry, group.rows, origin]);

  if (!geometry) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, group.rows.length]}
      castShadow
      receiveShadow
      userData={{ mapObject: true }}
    />
  );
}

/**
 * Budynki, skały i drzewa z mapy gry w promieniu `radius` od miejsca bazy, 1:1 z plików poziomu.
 * `lift`: skybase opuszcza świat o tę wysokość.
 */
export default function MapObjects({ site, lift, radius }: { site: Site; lift: number; radius: number }) {
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
    scene.inst.forEach((row) => {
      const dx = row[1] - site.x, dz = row[3] - site.z;
      if (dx * dx + dz * dz > r2) return;
      let list = byType.get(row[0]);
      if (!list) byType.set(row[0], (list = []));
      list.push(row);
    });
    return [...byType.entries()].map(([t, rows]): Group => ({ guid: scene.types[t].guid, kind: scene.types[t].kind, rows }));
  }, [scene, site.x, site.z, radius]);

  const origin = useMemo(() => ({ x: site.x, y: site.elevation + lift, z: site.z }), [site.x, site.z, site.elevation, lift]);

  return (
    <>
      {groups.map((g) => (
        <InstancedType key={`${g.guid}-${g.rows.length}`} group={g} origin={origin} />
      ))}
    </>
  );
}
