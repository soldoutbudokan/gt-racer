import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useVehicleStore } from '../../stores/useVehicleStore';

export function Lighting() {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    if (!dirLightRef.current) return;
    const pos = useVehicleStore.getState().position;
    if (!pos) return;
    dirLightRef.current.position.set(pos.x + 50, 80, pos.z + 30);
    dirLightRef.current.target.position.set(pos.x, 0, pos.z);
    dirLightRef.current.target.updateMatrixWorld();
  });

  return (
    <>
      {/* Sun - follows player for better shadow resolution */}
      <directionalLight
        ref={dirLightRef}
        position={[50, 80, 30]}
        intensity={1.8}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={200}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0005}
        color="#fff5e6"
      />

      {/* Soft fill from opposite side */}
      <directionalLight
        position={[-30, 40, -20]}
        intensity={0.3}
        color="#a0c0e0"
      />

      {/* Ambient fill */}
      <ambientLight intensity={0.25} color="#b0d0f0" />

      {/* Hemisphere for sky/ground bounce */}
      <hemisphereLight args={['#87CEEB', '#556b2f', 0.3]} />
    </>
  );
}
