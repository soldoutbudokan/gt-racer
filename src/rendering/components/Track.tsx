import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { CatmullRomSpline } from '../../utils/spline';

interface TrackProps {
  splinePoints: number[][];
  widths: number[];
  bankAngles: number[];
}

// %% Procedural textures

function createAsphaltTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 25;
    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
    imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
    imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 80);
  return texture;
}

function createBarrierTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#cc2222' : '#ffffff';
    ctx.fillRect(0, i * 8, 64, 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 4);
  return tex;
}

// %% Track geometry

function interpolateWidth(widths: number[], t: number): number {
  const idx = Math.floor(t * (widths.length - 1));
  const frac = t * (widths.length - 1) - idx;
  return widths[idx] + (widths[Math.min(idx + 1, widths.length - 1)] - widths[idx]) * frac;
}

function createTrackGeometry(spline: CatmullRomSpline, widths: number[], bankAngles: number[], segments: number = 300): THREE.BufferGeometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pos = spline.interpolate(t);
    const tan = spline.tangent(t);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();

    const bankIdx = Math.floor(t * (bankAngles.length - 1));
    const bankT = t * (bankAngles.length - 1) - bankIdx;
    const bankDeg = bankAngles[bankIdx] + (bankAngles[Math.min(bankIdx + 1, bankAngles.length - 1)] - bankAngles[bankIdx]) * bankT;
    const bankRad = (bankDeg * Math.PI) / 180;

    if (Math.abs(bankRad) > 0.001) {
      right.applyAxisAngle(tan, bankRad);
      up.applyAxisAngle(tan, bankRad);
    }

    const width = interpolateWidth(widths, t);
    const halfWidth = width / 2;

    const left = pos.clone().add(right.clone().multiplyScalar(-halfWidth));
    const rightPt = pos.clone().add(right.clone().multiplyScalar(halfWidth));

    vertices.push(left.x, left.y, left.z);
    vertices.push(rightPt.x, rightPt.y, rightPt.z);

    normals.push(up.x, up.y, up.z, up.x, up.y, up.z);
    uvs.push(0, t * 20, 1, t * 20);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// %% Center line dashes (merged geometry, 1 draw call)

function createCenterLineGeo(spline: CatmullRomSpline, segments: number = 300): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  const lineWidth = 0.12;
  const yOffset = 0.015;
  const dashEvery = 4; // draw every other N segments

  for (let i = 0; i < segments; i++) {
    // dash pattern: draw for dashEvery, skip for dashEvery
    const cycle = Math.floor(i / dashEvery) % 2;
    if (cycle !== 0) continue;

    const t = i / segments;
    const tNext = (i + 1) / segments;
    const pos = spline.interpolate(t);
    const posNext = spline.interpolate(tNext);
    const tan = spline.tangent(t);
    const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    const hw = lineWidth / 2;

    const baseIdx = vertices.length / 3;
    vertices.push(
      pos.x - right.x * hw, pos.y + yOffset, pos.z - right.z * hw,
      pos.x + right.x * hw, pos.y + yOffset, pos.z + right.z * hw,
      posNext.x - right.x * hw, posNext.y + yOffset, posNext.z - right.z * hw,
      posNext.x + right.x * hw, posNext.y + yOffset, posNext.z + right.z * hw,
    );
    indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx + 1, baseIdx + 3, baseIdx + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// %% Curb data for InstancedMesh

interface CurbData {
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
  count: number;
}

function createCurbData(
  spline: CatmullRomSpline,
  widths: number[],
  side: 'left' | 'right',
  count: number = 120,
): CurbData {
  const matrices: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const red = new THREE.Color('#cc0000');
  const white = new THREE.Color('#f5f5f5');

  const curbWidth = 0.8;
  const curbHeight = 0.06;

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const tNext = (i + 1) / count;
    const pos = spline.interpolate(t);
    const posNext = spline.interpolate(tNext);
    const tan = posNext.clone().sub(pos).normalize();
    const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();

    const width = interpolateWidth(widths, t);
    const halfWidth = width / 2;
    const offset = side === 'left' ? -(halfWidth + curbWidth / 2) : (halfWidth + curbWidth / 2);

    const center = pos.clone().add(posNext).multiplyScalar(0.5);
    center.y += curbHeight / 2 + 0.01;
    center.add(right.clone().multiplyScalar(offset));

    const segLen = pos.distanceTo(posNext);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      tan,
    );
    const matrix = new THREE.Matrix4();
    matrix.compose(center, quat, new THREE.Vector3(curbWidth, curbHeight, Math.max(0.3, segLen)));
    matrices.push(matrix);
    colors.push(i % 2 === 0 ? red : white);
  }

  return { matrices, colors, count };
}

// %% Start/finish line geometry

function createStartLineData(spline: CatmullRomSpline, widths: number[]) {
  const pos = spline.interpolate(0);
  const tan = spline.tangent(0);
  const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
  const width = interpolateWidth(widths, 0);
  const rotY = Math.atan2(tan.x, tan.z);
  return {
    position: [pos.x, 0.02, pos.z] as [number, number, number],
    rotationY: rotY,
    width,
  };
}

// %% Wall geometry

function createWallGeometry(spline: CatmullRomSpline, widths: number[], side: 'left' | 'right', segments: number = 200, wallHeight: number = 1.0): THREE.BufferGeometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pos = spline.interpolate(t);
    const tan = spline.tangent(t);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();

    const width = interpolateWidth(widths, t);
    const halfWidth = width / 2;

    const offset = side === 'left' ? -halfWidth : halfWidth;
    const wallBase = pos.clone().add(right.clone().multiplyScalar(offset));
    const wallTop = wallBase.clone().add(up.clone().multiplyScalar(wallHeight));

    vertices.push(wallBase.x, wallBase.y, wallBase.z);
    vertices.push(wallTop.x, wallTop.y, wallTop.z);

    const wallNormal = side === 'left' ? right.clone() : right.clone().negate();
    normals.push(wallNormal.x, wallNormal.y, wallNormal.z);
    normals.push(wallNormal.x, wallNormal.y, wallNormal.z);

    uvs.push(t * 20, 0, t * 20, 1);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1);
      indices.push(base + 1, base + 2, base + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// %% Curb instanced component

function CurbStrip({ data }: { data: CurbData }) {
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, data.count]} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.6} vertexColors />
    </instancedMesh>
  );
}

// %% Main Track component

export function Track({ splinePoints, widths, bankAngles }: TrackProps) {
  const spline = useMemo(
    () => new CatmullRomSpline(splinePoints.map((p) => new THREE.Vector3(p[0], p[1], p[2])), true),
    [splinePoints]
  );

  const asphaltTexture = useMemo(() => createAsphaltTexture(), []);
  const barrierTexture = useMemo(() => createBarrierTexture(), []);
  const trackGeo = useMemo(() => createTrackGeometry(spline, widths, bankAngles), [spline, widths, bankAngles]);
  const centerLineGeo = useMemo(() => createCenterLineGeo(spline), [spline]);
  const leftCurbData = useMemo(() => createCurbData(spline, widths, 'left'), [spline, widths]);
  const rightCurbData = useMemo(() => createCurbData(spline, widths, 'right'), [spline, widths]);
  const startLine = useMemo(() => createStartLineData(spline, widths), [spline, widths]);
  const leftWallGeo = useMemo(() => createWallGeometry(spline, widths, 'left'), [spline, widths]);
  const rightWallGeo = useMemo(() => createWallGeometry(spline, widths, 'right'), [spline, widths]);

  return (
    <group>
      {/* Track surface with asphalt texture */}
      <mesh geometry={trackGeo} receiveShadow>
        <meshStandardMaterial
          map={asphaltTexture}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Dashed center line */}
      <mesh geometry={centerLineGeo} receiveShadow>
        <meshStandardMaterial color="#f0f0f0" roughness={0.5} />
      </mesh>

      {/* Curbs (InstancedMesh) */}
      <CurbStrip data={leftCurbData} />
      <CurbStrip data={rightCurbData} />

      {/* Start/finish line */}
      <mesh
        position={startLine.position}
        rotation={[0, startLine.rotationY, 0]}
        receiveShadow
      >
        <boxGeometry args={[startLine.width, 0.02, 1.2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>

      {/* Checkered pattern on start line */}
      <mesh
        position={[startLine.position[0], startLine.position[1] + 0.005, startLine.position[2]]}
        rotation={[0, startLine.rotationY, 0]}
        receiveShadow
      >
        <boxGeometry args={[startLine.width, 0.01, 0.3]} />
        <meshStandardMaterial color="#111111" roughness={0.5} />
      </mesh>

      {/* Barriers with red/white stripes */}
      <mesh geometry={leftWallGeo}>
        <meshStandardMaterial map={barrierTexture} roughness={0.6} />
      </mesh>
      <mesh geometry={rightWallGeo}>
        <meshStandardMaterial map={barrierTexture} roughness={0.6} />
      </mesh>
    </group>
  );
}

export { CatmullRomSpline };
