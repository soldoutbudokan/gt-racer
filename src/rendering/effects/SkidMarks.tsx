import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useVehicleStore } from '../../stores/useVehicleStore';

const MAX_POINTS = 1000;

export function SkidMarks() {
  const meshRef = useRef<THREE.Mesh>(null);
  const pointCount = useRef(0);

  const positions = useMemo(() => new Float32Array(MAX_POINTS * 2 * 3), []);
  const alphas = useMemo(() => new Float32Array(MAX_POINTS * 2).fill(0), []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    return geo;
  }, [positions, alphas]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          if (vAlpha < 0.01) discard;
          gl_FragColor = vec4(0.1, 0.1, 0.1, vAlpha);
        }
      `,
    });
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const wheels = useVehicleStore.getState().wheels;

    // Fade existing marks
    for (let i = 0; i < MAX_POINTS * 2; i++) {
      if (alphas[i] > 0) {
        alphas[i] = Math.max(0, alphas[i] - dt * 0.04);
      }
    }

    for (let w = 2; w < 4 && w < wheels.length; w++) {
      const wheel = wheels[w];
      if (!wheel.onGround) continue;
      const totalSlip = Math.abs(wheel.slipAngle) + Math.abs(wheel.slipRatio);
      if (totalSlip < 0.12) continue;

      const idx = (pointCount.current % MAX_POINTS) * 6;
      const alphaIdx = (pointCount.current % MAX_POINTS) * 2;
      const offset = 0.15 * (w === 2 ? -1 : 1);
      positions[idx] = wheel.contactPoint.x + offset;
      positions[idx + 1] = wheel.contactPoint.y + 0.01;
      positions[idx + 2] = wheel.contactPoint.z;
      positions[idx + 3] = wheel.contactPoint.x - offset;
      positions[idx + 4] = wheel.contactPoint.y + 0.01;
      positions[idx + 5] = wheel.contactPoint.z;

      const intensity = Math.min(1, totalSlip * 2);
      alphas[alphaIdx] = 0.8 * intensity;
      alphas[alphaIdx + 1] = 0.8 * intensity;

      pointCount.current++;

      if (meshRef.current) {
        const count = Math.min(pointCount.current, MAX_POINTS) * 2;
        geometry.setDrawRange(0, count);
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.alpha.needsUpdate = true;
      }
    }
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}
