"use client";

import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import { Item3D, useGameModels } from './Builder3D';
import type { PlacedItem } from '@/lib/builder';

const TARGET = new THREE.Vector3(0, 2, 0);
const START = new THREE.Vector3(34, 27, 40);

/**
 * Kamera bliżej w szerokim kadrze (scena 16:6 na stronie głównej): pionowe FOV jest stałe,
 * więc w niskiej scenie baza robiła się mała. W wąskim kadrze (telefon) zostaje pełna odległość,
 * żeby obracana baza mieściła się w szerokości.
 */
function FitCamera() {
  const { camera, size } = useThree();
  const aspect = size.width / size.height;
  useEffect(() => {
    const k = aspect >= 2.2 ? 0.7 : aspect >= 1.6 ? 0.82 : 1;
    const dir = camera.position.clone().sub(TARGET).normalize();
    camera.position.copy(TARGET).addScaledVector(dir, START.clone().sub(TARGET).length() * k);
  }, [camera, aspect]);
  return null;
}

/** Lekki, obracający się podgląd bazy (bez sterowania FPS). */
export default function BasePreview3D({ items }: { items: PlacedItem[] }) {
  const reduce = useReducedMotion();
  const models = useGameModels();

  return (
    <Canvas shadows="percentage" camera={{ position: START.toArray(), fov: 36 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
      <FitCamera />
      <color attach="background" args={['#111813']} />
      {/* mgła w kolorze tła: krawędź ziemi znika zamiast tworzyć elipsę */}
      <fog attach="fog" args={['#111813', 55, 95]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[20, 30, 12]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        color="#fff4e8"
      />
      <hemisphereLight args={['#eef3e6', '#2c3a24', 0.9]} />

      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        {/* duży promień: w szerokim kadrze strony głównej krawędź musi wypaść za mgłą */}
        <circleGeometry args={[140, 64]} />
        <meshStandardMaterial color="#2b3d24" roughness={0.95} />
      </mesh>
      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={40} blur={2.2} far={8} />

      <group>
        {items.map((item) => (
          <Item3D key={item.id} item={item} models={models} />
        ))}
      </group>

      <OrbitControls
        target={TARGET.toArray()}
        autoRotate={!reduce}
        autoRotateSpeed={0.6}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={0.5}
        maxPolarAngle={1.25}
      />
    </Canvas>
  );
}
