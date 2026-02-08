import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useVehicleStore } from '../../stores/useVehicleStore';

const MAX_POINTS = 500;

export function SkidMarks() {
  const meshRef = useRef<THREE.Mesh>(null);
  const pointCount = useRef(0);

  const positions = useMemo(() => new Float32Array(MAX_POINTS * 2 * 3), []);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame(() => {
    const wheels = useVehicleStore.getState().wheels;

    for (let w = 2; w < 4 && w < wheels.length; w++) {
      const wheel = wheels[w];
      if (!wheel.onGround) continue;
      const totalSlip = Math.abs(wheel.slipAngle) + Math.abs(wheel.slipRatio);
      if (totalSlip < 0.15) continue;

      const idx = (pointCount.current % MAX_POINTS) * 6;
      const offset = 0.15 * (w === 2 ? -1 : 1);
      positions[idx] = wheel.contactPoint.x + offset;
      positions[idx + 1] = wheel.contactPoint.y + 0.01;
      positions[idx + 2] = wheel.contactPoint.z;
      positions[idx + 3] = wheel.contactPoint.x - offset;
      positions[idx + 4] = wheel.contactPoint.y + 0.01;
      positions[idx + 5] = wheel.contactPoint.z;

      pointCount.current++;

      if (meshRef.current) {
        const count = Math.min(pointCount.current, MAX_POINTS) * 2;
        geometry.setDrawRange(0, count);
        geometry.attributes.position.needsUpdate = true;
      }
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial color="#1a1a1a" transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}
