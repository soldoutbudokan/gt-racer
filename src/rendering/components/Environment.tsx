import { useMemo } from 'react';
import * as THREE from 'three';
import { CatmullRomSpline } from '../../utils/spline';

interface EnvironmentProps {
  splinePoints: number[][];
  widths: number[];
}

function PalmTree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.25, 6, 8]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      {/* Leaves */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[0, 6, 0]} rotation={[0.4, (i * Math.PI * 2) / 6, 0.8]}>
          <planeGeometry args={[0.6, 3]} />
          <meshStandardMaterial color="#2d5a1e" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function Building({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <mesh position={[position[0], position[1] + size[1] / 2, position[2]]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

export function TrackEnvironment({ splinePoints, widths }: EnvironmentProps) {
  const objects = useMemo(() => {
    const spline = new CatmullRomSpline(
      splinePoints.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      true
    );

    const trees: [number, number, number][] = [];
    const buildings: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [];

    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const pos = spline.interpolate(t);
      const tan = spline.tangent(t);
      const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();

      const widthIdx = Math.floor(t * (widths.length - 1));
      const width = widths[widthIdx];

      // Trees on left side
      const treeOffset = width / 2 + 3 + Math.random() * 5;
      trees.push([pos.x - right.x * treeOffset, 0, pos.z - right.z * treeOffset]);

      // Trees on right side
      if (Math.random() > 0.4) {
        const rOffset = width / 2 + 3 + Math.random() * 5;
        trees.push([pos.x + right.x * rOffset, 0, pos.z + right.z * rOffset]);
      }

      // Occasional buildings
      if (i % 5 === 0) {
        const bOffset = width / 2 + 10 + Math.random() * 8;
        const side = Math.random() > 0.5 ? 1 : -1;
        const h = 4 + Math.random() * 8;
        const colors = ['#e8dcc8', '#d4c4a8', '#c8b898', '#f0e6d2'];
        buildings.push({
          pos: [pos.x + right.x * bOffset * side, 0, pos.z + right.z * bOffset * side],
          size: [3 + Math.random() * 4, h, 3 + Math.random() * 4],
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }

    return { trees, buildings };
  }, [splinePoints, widths]);

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#3a6b35" roughness={0.95} />
      </mesh>

      {/* Sky gradient - hemisphere */}
      <hemisphereLight args={['#87CEEB', '#3a6b35', 0.4]} />

      {/* Trees */}
      {objects.trees.map((pos, i) => (
        <PalmTree key={`tree-${i}`} position={pos} />
      ))}

      {/* Buildings */}
      {objects.buildings.map((b, i) => (
        <Building key={`building-${i}`} position={b.pos} size={b.size} color={b.color} />
      ))}
    </group>
  );
}
