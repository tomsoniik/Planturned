"use client";

import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import { Item3D, useGameModels } from './Builder3D';
import type { PlacedItem } from '@/lib/builder';

/** Lekki, obracający się podgląd bazy (bez sterowania FPS). */
export default function BasePreview3D({ items }: { items: PlacedItem[] }) {
  const reduce = useReducedMotion();
  const models = useGameModels();

  return (
    <Canvas shadows="percentage" camera={{ position: [34, 27, 40], fov: 36 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
      <color attach="background" args={['#141518']} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[20, 30, 12]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        color="#fff4e8"
      />
      <hemisphereLight args={['#e9eef5', '#2a2622', 0.9]} />

      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#17181b" roughness={0.95} />
      </mesh>
      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={40} blur={2.2} far={8} />

      <group>
        {items.map((item) => (
          <Item3D key={item.id} item={item} models={models} />
        ))}
      </group>

      <OrbitControls
        target={[0, 2, 0]}
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
