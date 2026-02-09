import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useVehicleStore } from '../../stores/useVehicleStore';

const PARTICLE_COUNT = 150;

function createSmokeSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function TireSmoke() {
  const pointsRef = useRef<THREE.Points>(null);
  const velocities = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const ages = useMemo(() => new Float32Array(PARTICLE_COUNT).fill(999), []);
  const nextIdx = useRef(0);
  const smokeSprite = useMemo(() => createSmokeSprite(), []);

  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) pos[i] = -1000;
    return pos;
  }, []);

  const sizes = useMemo(() => new Float32Array(PARTICLE_COUNT).fill(0), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const wheels = useVehicleStore.getState().wheels;

    // Spawn smoke from wheels with slip
    for (let w = 0; w < 4 && w < wheels.length; w++) {
      const wheel = wheels[w];
      if (!wheel.onGround) continue;
      const totalSlip = Math.abs(wheel.slipAngle) + Math.abs(wheel.slipRatio);
      if (totalSlip > 0.08 && Math.random() < totalSlip * 3) {
        const idx = nextIdx.current;
        const i3 = idx * 3;
        positions[i3] = wheel.contactPoint.x + (Math.random() - 0.5) * 0.5;
        positions[i3 + 1] = wheel.contactPoint.y + 0.1;
        positions[i3 + 2] = wheel.contactPoint.z + (Math.random() - 0.5) * 0.5;
        velocities[i3] = (Math.random() - 0.5) * 0.8;
        velocities[i3 + 1] = 0.6 + Math.random() * 0.8;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.8;
        ages[idx] = 0;
        sizes[idx] = 1.5;
        nextIdx.current = (nextIdx.current + 1) % PARTICLE_COUNT;
      }
    }

    // Update particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      ages[i] += dt;
      if (ages[i] > 2.5) {
        sizes[i] = 0;
        continue;
      }
      const i3 = i * 3;
      positions[i3] += velocities[i3] * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;
      velocities[i3 + 1] += 0.15 * dt; // gentle rise
      // Grow and fade
      const life = ages[i] / 2.5;
      sizes[i] = Math.max(0, (1 - life * 0.5) * 5);
    }

    if (pointsRef.current) {
      const geo = pointsRef.current.geometry;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={PARTICLE_COUNT} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} count={PARTICLE_COUNT} />
      </bufferGeometry>
      <pointsMaterial
        map={smokeSprite}
        color="#cccccc"
        transparent
        opacity={0.5}
        size={4}
        sizeAttenuation
        depthWrite={false}
        alphaTest={0.01}
      />
    </points>
  );
}
