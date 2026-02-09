import { useMemo } from 'react';
import * as THREE from 'three';
import { CatmullRomSpline } from '../../utils/spline';

interface TrackProps {
  splinePoints: number[][];
  widths: number[];
  bankAngles: number[];
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

    // Interpolate bank angle
    const bankIdx = Math.floor(t * (bankAngles.length - 1));
    const bankT = t * (bankAngles.length - 1) - bankIdx;
    const bankDeg = bankAngles[bankIdx] + (bankAngles[Math.min(bankIdx + 1, bankAngles.length - 1)] - bankAngles[bankIdx]) * bankT;
    const bankRad = (bankDeg * Math.PI) / 180;

    // Apply banking rotation around tangent
    if (Math.abs(bankRad) > 0.001) {
      right.applyAxisAngle(tan, bankRad);
      up.applyAxisAngle(tan, bankRad);
    }

    const widthIdx = Math.floor(t * (widths.length - 1));
    const widthT = t * (widths.length - 1) - widthIdx;
    const width = widths[widthIdx] + (widths[Math.min(widthIdx + 1, widths.length - 1)] - widths[widthIdx]) * widthT;
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

interface CurbSegment {
  position: [number, number, number];
  rotationY: number;
  length: number;
  color: string;
}

interface CenterLineSegment {
  position: [number, number, number];
  rotationY: number;
  length: number;
}

function createCurbSegments(
  spline: CatmullRomSpline,
  widths: number[],
  segments: number = 140,
): { left: CurbSegment[]; right: CurbSegment[] } {
  const left: CurbSegment[] = [];
  const right: CurbSegment[] = [];
  const curbWidth = 0.35;
  const curbHeight = 0.06;

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const tNext = (i + 1) / segments;
    const pos = spline.interpolate(t);
    const next = spline.interpolate(tNext);
    const tan = next.clone().sub(pos).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const rightVec = new THREE.Vector3().crossVectors(tan, up).normalize();

    const widthIdx = Math.floor(t * (widths.length - 1));
    const widthT = t * (widths.length - 1) - widthIdx;
    const width = widths[widthIdx] + (widths[Math.min(widthIdx + 1, widths.length - 1)] - widths[widthIdx]) * widthT;
    const offset = width / 2 + curbWidth / 2;

    const center = pos.clone().add(next).multiplyScalar(0.5);
    const rotationY = Math.atan2(tan.x, tan.z);
    const length = Math.max(0.6, pos.distanceTo(next));
    const color = i % 2 === 0 ? '#f5f5f5' : '#d93a2f';
    const y = curbHeight / 2 + 0.01;

    left.push({
      position: [center.x - rightVec.x * offset, y, center.z - rightVec.z * offset],
      rotationY,
      length,
      color,
    });
    right.push({
      position: [center.x + rightVec.x * offset, y, center.z + rightVec.z * offset],
      rotationY,
      length,
      color,
    });
  }

  return { left, right };
}

function createCenterLineSegments(
  spline: CatmullRomSpline,
  segments: number = 160,
): CenterLineSegment[] {
  const line: CenterLineSegment[] = [];
  for (let i = 0; i < segments; i++) {
    if (i % 2 !== 0) continue;
    const t = i / segments;
    const tNext = (i + 1) / segments;
    const pos = spline.interpolate(t);
    const next = spline.interpolate(tNext);
    const center = pos.clone().add(next).multiplyScalar(0.5);
    const tan = next.clone().sub(pos).normalize();
    const rotationY = Math.atan2(tan.x, tan.z);
    const length = Math.max(0.6, pos.distanceTo(next));
    line.push({
      position: [center.x, 0.03, center.z],
      rotationY,
      length,
    });
  }
  return line;
}

function createWallGeometry(spline: CatmullRomSpline, widths: number[], side: 'left' | 'right', segments: number = 200, wallHeight: number = 1.0): THREE.BufferGeometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pos = spline.interpolate(t);
    const tan = spline.tangent(t);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();

    const widthIdx = Math.floor(t * (widths.length - 1));
    const widthT = t * (widths.length - 1) - widthIdx;
    const width = widths[widthIdx] + (widths[Math.min(widthIdx + 1, widths.length - 1)] - widths[widthIdx]) * widthT;
    const halfWidth = width / 2;

    const offset = side === 'left' ? -halfWidth : halfWidth;
    const wallBase = pos.clone().add(right.clone().multiplyScalar(offset));
    const wallTop = wallBase.clone().add(up.clone().multiplyScalar(wallHeight));

    vertices.push(wallBase.x, wallBase.y, wallBase.z);
    vertices.push(wallTop.x, wallTop.y, wallTop.z);

    const wallNormal = side === 'left' ? right.clone() : right.clone().negate();
    normals.push(wallNormal.x, wallNormal.y, wallNormal.z);
    normals.push(wallNormal.x, wallNormal.y, wallNormal.z);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1);
      indices.push(base + 1, base + 2, base + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

export function Track({ splinePoints, widths, bankAngles }: TrackProps) {
  const spline = useMemo(
    () => new CatmullRomSpline(splinePoints.map((p) => new THREE.Vector3(p[0], p[1], p[2])), true),
    [splinePoints]
  );

  const trackGeo = useMemo(() => createTrackGeometry(spline, widths, bankAngles), [spline, widths, bankAngles]);
  const leftWallGeo = useMemo(() => createWallGeometry(spline, widths, 'left'), [spline, widths]);
  const rightWallGeo = useMemo(() => createWallGeometry(spline, widths, 'right'), [spline, widths]);
  const curbSegments = useMemo(() => createCurbSegments(spline, widths), [spline, widths]);
  const centerLineSegments = useMemo(() => createCenterLineSegments(spline), [spline]);

  return (
    <group>
      {/* Track surface */}
      <mesh geometry={trackGeo} receiveShadow>
        <meshStandardMaterial
          color="#333333"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Track center line */}
      <mesh geometry={trackGeo} position={[0, 0.01, 0]}>
        <meshStandardMaterial
          color="#444444"
          roughness={0.9}
        />
      </mesh>

      {/* Center line dashes */}
      {centerLineSegments.map((segment, index) => (
        <mesh
          key={`centerline-${index}`}
          position={segment.position}
          rotation={[0, segment.rotationY, 0]}
          receiveShadow
        >
          <boxGeometry args={[0.15, 0.02, segment.length * 0.7]} />
          <meshStandardMaterial color="#f5f5f5" roughness={0.6} />
        </mesh>
      ))}

      {/* Curbs */}
      {curbSegments.left.map((segment, index) => (
        <mesh
          key={`curb-left-${index}`}
          position={segment.position}
          rotation={[0, segment.rotationY, 0]}
          receiveShadow
        >
          <boxGeometry args={[0.35, 0.06, segment.length]} />
          <meshStandardMaterial color={segment.color} roughness={0.6} />
        </mesh>
      ))}
      {curbSegments.right.map((segment, index) => (
        <mesh
          key={`curb-right-${index}`}
          position={segment.position}
          rotation={[0, segment.rotationY, 0]}
          receiveShadow
        >
          <boxGeometry args={[0.35, 0.06, segment.length]} />
          <meshStandardMaterial color={segment.color} roughness={0.6} />
        </mesh>
      ))}

      {/* Barriers */}
      <mesh geometry={leftWallGeo}>
        <meshStandardMaterial color="#cc3333" roughness={0.6} />
      </mesh>
      <mesh geometry={rightWallGeo}>
        <meshStandardMaterial color="#cc3333" roughness={0.6} />
      </mesh>
    </group>
  );
}

export { CatmullRomSpline };
