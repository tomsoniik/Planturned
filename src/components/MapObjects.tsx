"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { instanceMatrix, loadMapScene, loadSceneryModel, type MapScene, type SceneryModel } from '@/lib/mapScene';
import type { Site } from '@/lib/terrain';

// Jeden materiał dla wszystkich obiektów mapy: kolory z palety gry siedzą w wierzchołkach.
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });

/**
 * Jedna część modelu (bryła albo liście) we wszystkich widocznych wystąpieniach typu.
 * Pojemność to liczba wszystkich wystąpień typu na mapie, więc przy ruchu kamery siatka się nie przebudowuje:
 * zmienia się tylko lista macierzy (`visible`: indeksy instancji w `matrices`).
 */
function InstancedPart({
  geometry,
  mat,
  matrices,
  visible,
  capacity,
  userData,
}: {
  geometry: THREE.BufferGeometry;
  mat: THREE.Material;
  matrices: Float32Array;
  visible: Int32Array;
  capacity: number;
  userData: Record<string, boolean>;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const attr = mesh.instanceMatrix;
    attr.setUsage(THREE.DynamicDrawUsage);
    const out = attr.array as Float32Array;
    for (let i = 0; i < visible.length; i++) {
      const src = visible[i] * 16, dst = i * 16;
      for (let k = 0; k < 16; k++) out[dst + k] = matrices[src + k];
    }
    mesh.count = visible.length;
    mesh.visible = visible.length > 0;
    attr.clearUpdateRanges();
    attr.addUpdateRange(0, visible.length * 16);
    attr.needsUpdate = true;
    if (visible.length) mesh.computeBoundingSphere();
  }, [matrices, visible]);

  return <instancedMesh ref={ref} args={[geometry, mat, capacity]} castShadow receiveShadow userData={userData} />;
}

/** Jeden typ obiektu: InstancedMesh na każdą część modelu. */
function InstancedType({
  guid,
  kind,
  matrices,
  visible,
  capacity,
}: {
  guid: string;
  kind: string;
  matrices: Float32Array;
  visible: Int32Array;
  capacity: number;
}) {
  const [model, setModel] = useState<SceneryModel | null>(null);

  useEffect(() => {
    let alive = true;
    loadSceneryModel(guid).then((g) => alive && setModel(g));
    return () => {
      alive = false;
    };
  }, [guid]);

  if (!model) return null;
  const tree = kind === 'tree';
  return (
    <>
      {model.solid && (
        // drzewa: w grze kolizja tylko na pniu, więc nie służą za podłoże przy chodzeniu
        <InstancedPart geometry={model.solid} mat={material} matrices={matrices} visible={visible} capacity={capacity} userData={{ mapObject: true, tree }} />
      )}
      {model.cutouts.map((c, i) => (
        // liście i siatki: przezroczyste karty bez kolizji, nie stoi się na nich i nie blokują ruchu
        <InstancedPart
          key={i}
          geometry={c.geometry}
          mat={c.material}
          matrices={matrices}
          visible={visible}
          capacity={capacity}
          userData={{ mapObject: true, tree: true, cutout: true }}
        />
      ))}
    </>
  );
}

const NONE = new Int32Array(0);

/**
 * Budynki, skały i drzewa z mapy gry w promieniu `radius` od `center` (punkt sceny), 1:1 z plików poziomu.
 * Typ, który raz się pojawił, zostaje zamontowany (przy wyjściu z zasięgu ma 0 instancji), więc przesuwanie
 * obszaru nie tworzy siatek od nowa.
 */
export default function MapObjects({
  site,
  radius,
  center,
}: {
  site: Site;
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

  const origin = useMemo(() => ({ x: site.x, y: site.elevation, z: site.z }), [site.x, site.z, site.elevation]);

  // macierze wszystkich instancji mapy, pogrupowane po typie (raz na mapę i miejsce bazy)
  const types = useMemo(() => {
    if (!scene) return [];
    const rows = scene.types.map((): number[][] => []);
    scene.inst.forEach((row) => rows[row[0]].push(row));
    const m = new THREE.Matrix4();
    return rows.map((list, t) => {
      const matrices = new Float32Array(list.length * 16);
      const xz = new Float32Array(list.length * 2);
      list.forEach((row, i) => {
        instanceMatrix(row, origin, m).toArray(matrices, i * 16);
        xz[i * 2] = row[1];
        xz[i * 2 + 1] = row[3];
      });
      return { guid: scene.types[t].guid, kind: scene.types[t].kind, matrices, xz };
    });
  }, [scene, origin]);

  // indeksy wystąpień w zasięgu, dla każdego typu
  const visible = useMemo(() => {
    const r2 = radius * radius;
    const cx = site.x + center[0], cz = site.z - center[1];
    return types.map(({ xz }) => {
      const out: number[] = [];
      for (let i = 0; i < xz.length / 2; i++) {
        const dx = xz[i * 2] - cx, dz = xz[i * 2 + 1] - cz;
        if (dx * dx + dz * dz <= r2) out.push(i);
      }
      return out.length ? Int32Array.from(out) : NONE;
    });
  }, [types, site.x, site.z, radius, center]);

  // typy, które choć raz były w zasięgu: zostają zamontowane do zmiany mapy
  const [seen, setSeen] = useState<{ types: typeof types; ids: Set<number> }>({ types, ids: new Set() });
  let ids = seen.types === types ? seen.ids : new Set<number>();
  if (visible.some((v, t) => v.length && !ids.has(t))) {
    ids = new Set(ids);
    visible.forEach((v, t) => v.length && ids.add(t));
  }
  if (seen.types !== types || seen.ids !== ids) setSeen({ types, ids });

  return (
    <>
      {[...ids].map((t) => (
        <InstancedType
          key={types[t].guid}
          guid={types[t].guid}
          kind={types[t].kind}
          matrices={types[t].matrices}
          visible={visible[t] ?? NONE}
          capacity={Math.max(1, types[t].xz.length / 2)}
        />
      ))}
    </>
  );
}
