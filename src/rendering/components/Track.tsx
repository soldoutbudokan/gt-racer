import { useMemo } from 'react';
import * as THREE from 'three';
import { CatmullRomSpline } from '../../utils/spline';

interface TrackProps {
  splinePoints: number[][];
  widths: number[];
  bankAngles: number[];
}

function createTrackGeometry(spline: CatmullRomSpline, widths: number[], _bankAngles: number[], segments: number = 200): THREE.BufferGeometry {
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

    const widthIdx = Math.floor(t * (widths.length - 1));
    const widthT = t * (widths.length - 1) - widthIdx;
    const width = widths[widthIdx] + (widths[Math.min(widthIdx + 1, widths.length - 1)] - widths[widthIdx]) * widthT;
    const halfWidth = width / 2;

    const left = pos.clone().add(right.clone().multiplyScalar(-halfWidth));
    const rightPt = pos.clone().add(right.clone().multiplyScalar(halfWidth));

    vertices.push(left.x, left.y, left.z);
    vertices.push(rightPt.x, rightPt.y, rightPt.z);

    normals.push(0, 1, 0, 0, 1, 0);
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
