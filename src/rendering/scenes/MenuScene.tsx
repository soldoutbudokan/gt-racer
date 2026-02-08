import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ProceduralCar } from '../components/ProceduralCar';
import { useGameStore } from '../../stores/useGameStore';
import sedanConfig from '../../data/cars/sedan-sport.json';
import type { VehicleConfig } from '../../physics/types';

export function MenuScene() {
  const scene = useGameStore((s) => s.scene);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  if (scene !== 'menu' && scene !== 'settings') return null;

  return (
    <>
      <color attach="background" args={['#0a0a1a']} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} color="#fff5e6" />
      <spotLight position={[-3, 5, 0]} intensity={1} angle={0.3} penumbra={0.5} color="#4488ff" />
      <spotLight position={[3, 5, 0]} intensity={0.8} angle={0.3} penumbra={0.5} color="#ff4444" />

      {/* Reflective floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#111122" metalness={0.8} roughness={0.2} />
      </mesh>

      <group ref={groupRef} position={[0, 0, 0]}>
        <ProceduralCar config={sedanConfig as unknown as VehicleConfig} />
      </group>
    </>
  );
}
