import { useRef } from 'react';
import * as THREE from 'three';

export function Lighting() {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);

  return (
    <>
      {/* Sun */}
      <directionalLight
        ref={dirLightRef}
        position={[50, 80, 30]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-bias={-0.001}
        color="#fff5e6"
      />

      {/* Ambient fill */}
      <ambientLight intensity={0.3} color="#a0c0e0" />

      {/* Hemisphere for sky/ground bounce */}
      <hemisphereLight args={['#87CEEB', '#556b2f', 0.3]} />
    </>
  );
}
