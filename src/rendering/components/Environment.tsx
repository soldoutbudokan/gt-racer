import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Cloud } from '@react-three/drei';
import { CatmullRomSpline } from '../../utils/spline';

interface EnvironmentProps {
  splinePoints: number[][];
  widths: number[];
}

// %% Procedural grass texture

function createGrassTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3a6b35';
  ctx.fillRect(0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 30;
    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise * 0.3));
    imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
    imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise * 0.2));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(50, 50);
  return texture;
}

// %% Instanced trees

interface TreeInstanceData {
  trunkMatrices: THREE.Matrix4[];
  trunkCount: number;
  leafMatrices: THREE.Matrix4[];
  leafCount: number;
}

function computeTreeInstances(positions: [number, number, number][]): TreeInstanceData {
  const trunkMatrices: THREE.Matrix4[] = [];
  const leafMatrices: THREE.Matrix4[] = [];

  positions.forEach((pos) => {
    const trunkHeight = 5 + Math.random() * 2;
    const trunkM = new THREE.Matrix4();
    trunkM.compose(
      new THREE.Vector3(pos[0], trunkHeight / 2, pos[2]),
      new THREE.Quaternion(),
      new THREE.Vector3(0.3, trunkHeight, 0.3),
    );
    trunkMatrices.push(trunkM);

    for (let i = 0; i < 6; i++) {
      const leafM = new THREE.Matrix4();
      const angle = (i * Math.PI * 2) / 6;
      const leafQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.3 + Math.random() * 0.3, angle, 0.6 + Math.random() * 0.3),
      );
      leafM.compose(
        new THREE.Vector3(pos[0], trunkHeight, pos[2]),
        leafQ,
        new THREE.Vector3(0.8, 3.5, 1.2),
      );
      leafMatrices.push(leafM);
    }
  });

  return {
    trunkMatrices,
    trunkCount: trunkMatrices.length,
    leafMatrices,
    leafCount: leafMatrices.length,
  };
}

function InstancedTrees({ data }: { data: TreeInstanceData }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (trunkRef.current) {
      data.trunkMatrices.forEach((m, i) => trunkRef.current!.setMatrixAt(i, m));
      trunkRef.current.instanceMatrix.needsUpdate = true;
    }
    if (leafRef.current) {
      data.leafMatrices.forEach((m, i) => leafRef.current!.setMatrixAt(i, m));
      leafRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [data]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, data.trunkCount]} castShadow>
        <cylinderGeometry args={[0.12, 0.22, 1, 8]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[undefined, undefined, data.leafCount]} castShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#2d5a1e" roughness={0.8} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}

// %% Instanced buildings

interface BuildingData {
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
  count: number;
}

function computeBuildingInstances(
  buildings: { pos: [number, number, number]; size: [number, number, number]; color: string }[],
): BuildingData {
  const matrices: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];

  buildings.forEach((b) => {
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(b.pos[0], b.size[1] / 2, b.pos[2]),
      new THREE.Quaternion(),
      new THREE.Vector3(b.size[0], b.size[1], b.size[2]),
    );
    matrices.push(m);
    colors.push(new THREE.Color(b.color));
  });

  return { matrices, colors, count: matrices.length };
}

function InstancedBuildings({ data }: { data: BuildingData }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    data.matrices.forEach((m, i) => {
      meshRef.current!.setMatrixAt(i, m);
      meshRef.current!.setColorAt(i, data.colors[i]);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [data]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, data.count]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.7} vertexColors />
    </instancedMesh>
  );
}

// %% Grandstand

function Grandstand({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Tier 1 */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[18, 2, 4]} />
        <meshStandardMaterial color="#777777" roughness={0.7} />
      </mesh>
      {/* Tier 2 */}
      <mesh position={[0, 3, -1.5]} castShadow receiveShadow>
        <boxGeometry args={[18, 2, 3]} />
        <meshStandardMaterial color="#888888" roughness={0.7} />
      </mesh>
      {/* Tier 3 */}
      <mesh position={[0, 5, -3]} castShadow receiveShadow>
        <boxGeometry args={[18, 2, 2.5]} />
        <meshStandardMaterial color="#999999" roughness={0.7} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 7, -1.5]} castShadow>
        <boxGeometry args={[20, 0.3, 8]} />
        <meshStandardMaterial color="#555555" roughness={0.6} />
      </mesh>
      {/* Support pillars */}
      {[-8, 0, 8].map((x) => (
        <mesh key={x} position={[x, 3.5, 2]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 7, 8]} />
          <meshStandardMaterial color="#666666" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// %% Main environment component

export function TrackEnvironment({ splinePoints, widths }: EnvironmentProps) {
  const grassTexture = useMemo(() => createGrassTexture(), []);

  const objects = useMemo(() => {
    const spline = new CatmullRomSpline(
      splinePoints.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      true,
    );

    const trees: [number, number, number][] = [];
    const buildings: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [];

    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      const pos = spline.interpolate(t);
      const tan = spline.tangent(t);
      const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();

      const widthIdx = Math.floor(t * (widths.length - 1));
      const width = widths[widthIdx];

      // Trees on left side
      const treeOffset = width / 2 + 3 + Math.random() * 6;
      trees.push([pos.x - right.x * treeOffset, 0, pos.z - right.z * treeOffset]);

      // Trees on right side
      if (Math.random() > 0.3) {
        const rOffset = width / 2 + 3 + Math.random() * 6;
        trees.push([pos.x + right.x * rOffset, 0, pos.z + right.z * rOffset]);
      }

      // Occasional second row of trees
      if (Math.random() > 0.6) {
        const farOffset = width / 2 + 12 + Math.random() * 8;
        const side = Math.random() > 0.5 ? 1 : -1;
        trees.push([pos.x + right.x * farOffset * side, 0, pos.z + right.z * farOffset * side]);
      }

      // Buildings
      if (i % 5 === 0) {
        const bOffset = width / 2 + 14 + Math.random() * 10;
        const side = Math.random() > 0.5 ? 1 : -1;
        const h = 4 + Math.random() * 10;
        const colors = ['#e8dcc8', '#d4c4a8', '#c8b898', '#f0e6d2', '#b8a888', '#ddd0bc'];
        buildings.push({
          pos: [pos.x + right.x * bOffset * side, 0, pos.z + right.z * bOffset * side],
          size: [3 + Math.random() * 5, h, 3 + Math.random() * 5],
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }

    // Grandstand positions near start/finish (t=0)
    const startPos = spline.interpolate(0);
    const startTan = spline.tangent(0);
    const startRight = new THREE.Vector3().crossVectors(startTan, new THREE.Vector3(0, 1, 0)).normalize();
    const startWidth = widths[0];
    const grandstandRotY = Math.atan2(startTan.x, startTan.z);

    const grandstand1Pos: [number, number, number] = [
      startPos.x + startRight.x * (startWidth / 2 + 8),
      0,
      startPos.z + startRight.z * (startWidth / 2 + 8),
    ];
    const grandstand2Pos: [number, number, number] = [
      startPos.x - startRight.x * (startWidth / 2 + 8),
      0,
      startPos.z - startRight.z * (startWidth / 2 + 8),
    ];

    return { trees, buildings, grandstand1Pos, grandstand2Pos, grandstandRotY };
  }, [splinePoints, widths]);

  const treeData = useMemo(() => computeTreeInstances(objects.trees), [objects.trees]);
  const buildingData = useMemo(() => computeBuildingInstances(objects.buildings), [objects.buildings]);

  return (
    <group>
      {/* Ground plane with grass texture */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial map={grassTexture} roughness={0.95} />
      </mesh>

      {/* Instanced trees */}
      <InstancedTrees data={treeData} />

      {/* Instanced buildings */}
      <InstancedBuildings data={buildingData} />

      {/* Grandstands near start/finish */}
      <Grandstand
        position={objects.grandstand1Pos}
        rotation={[0, objects.grandstandRotY, 0]}
      />
      <Grandstand
        position={objects.grandstand2Pos}
        rotation={[0, objects.grandstandRotY + Math.PI, 0]}
      />

      {/* Clouds */}
      <Cloud position={[-50, 60, 80]} speed={0.1} opacity={0.4} bounds={[30, 5, 5]} segments={10} />
      <Cloud position={[70, 70, 160]} speed={0.15} opacity={0.35} bounds={[25, 4, 4]} segments={8} />
      <Cloud position={[0, 55, -40]} speed={0.08} opacity={0.3} bounds={[35, 6, 6]} segments={10} />
      <Cloud position={[100, 65, 50]} speed={0.12} opacity={0.35} bounds={[28, 5, 5]} segments={8} />
      <Cloud position={[-80, 75, 200]} speed={0.1} opacity={0.25} bounds={[40, 6, 6]} segments={10} />
      <Cloud position={[40, 58, -80]} speed={0.07} opacity={0.3} bounds={[30, 4, 4]} segments={8} />
    </group>
  );
}
