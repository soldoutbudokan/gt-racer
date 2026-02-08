import { useMemo } from 'react';
import * as THREE from 'three';
import type { VehicleConfig, WheelState } from '../../physics/types';

// %% Section 1: Types, constants, material presets
// ---------------------------------------------------------------------------

interface ProceduralCarProps {
  config: VehicleConfig;
  wheelStates?: WheelState[];
  steeringAngle?: number;
  color?: string;
  braking?: boolean;
}

type BodyType = 'sedan' | 'coupe' | 'supercar';

interface Vec2 {
  x: number;
  y: number;
}

interface Station {
  t: number;
  profile: Vec2[];
}

export interface BodyProportions {
  lengthFactor: number;
  bodyHeight: number;
  roofHeight: number;
  bodyWidthScale: number;
}

const PERIMETER_PTS = 48;
const BODY_INSET = 0.02;

// --- Material preset helpers ---

function bodyPaintProps(color: string) {
  return {
    color,
    metalness: 0.9,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.0,
  };
}

const CHROME_PROPS = { color: '#e8e8e8', metalness: 1.0, roughness: 0.05, envMapIntensity: 2.0 };
const DARK_CHROME_PROPS = { color: '#333333', metalness: 0.95, roughness: 0.08 };
const GLASS_PROPS = { color: '#88ccff', transparent: true, opacity: 0.25, metalness: 0.1, roughness: 0.0, envMapIntensity: 1.5, side: THREE.DoubleSide as THREE.Side };
const PLASTIC_PROPS = { color: '#1a1a1a', roughness: 0.85, metalness: 0.05 };
const RUBBER_PROPS = { color: '#111111', roughness: 0.92, metalness: 0.0 };
const INTERIOR_PROPS = { color: '#0d0d0d', roughness: 0.9, metalness: 0.05 };

function caliperProps(color: string) {
  return { color, roughness: 0.3, metalness: 0.7 };
}

// %% Section 2: Proportions + station specs
// ---------------------------------------------------------------------------

export function getProportions(bodyType: BodyType): BodyProportions {
  switch (bodyType) {
    case 'supercar':
      return { lengthFactor: 1.70, bodyHeight: 0.42, roofHeight: 0.75, bodyWidthScale: 1.08 };
    case 'coupe':
      return { lengthFactor: 1.75, bodyHeight: 0.48, roofHeight: 0.85, bodyWidthScale: 1.06 };
    case 'sedan':
    default:
      return { lengthFactor: 1.80, bodyHeight: 0.52, roofHeight: 0.95, bodyWidthScale: 1.05 };
  }
}

interface StationSpec {
  t: number;
  widthScale: number;
  bodyHeightScale: number;
  roofHeightScale: number;
  roofWidthScale: number;
  groundClearance: number;
  fenderBulge: number;
  wheelArchDepth: number;
  fenderFlareWidth: number;
  characterLineStrength: number;
}

function s(
  t: number, ws: number, bhs: number, rhs: number, rws: number,
  gc: number, fb: number, wad = 0, ffw = 0, cls = 0,
): StationSpec {
  return { t, widthScale: ws, bodyHeightScale: bhs, roofHeightScale: rhs, roofWidthScale: rws, groundClearance: gc, fenderBulge: fb, wheelArchDepth: wad, fenderFlareWidth: ffw, characterLineStrength: cls };
}

function getStationSpecs(bodyType: BodyType): StationSpec[] {
  switch (bodyType) {
    case 'supercar':
      return [
        // Rear bumper / diffuser
        s(0.000, 0.55, 0.50, 0.30, 0.35, 0.06, 0.0),
        s(0.020, 0.62, 0.58, 0.36, 0.42, 0.06, 0.0),
        s(0.045, 0.72, 0.68, 0.46, 0.52, 0.06, 0.0),
        // Rear end ramp-up
        s(0.075, 0.82, 0.80, 0.56, 0.60, 0.06, 0.1, 0, 0, 0.3),
        s(0.100, 0.88, 0.86, 0.65, 0.66, 0.06, 0.3, 0, 0, 0.5),
        // Rear wheel arch zone (tight spacing)
        s(0.125, 0.93, 0.90, 0.72, 0.70, 0.06, 0.6, 0.04, 0.04, 0.7),
        s(0.150, 0.96, 0.92, 0.78, 0.75, 0.06, 0.8, 0.06, 0.06, 0.8),
        s(0.175, 0.98, 0.94, 0.82, 0.78, 0.06, 0.7, 0.04, 0.04, 0.7),
        s(0.200, 1.00, 0.96, 0.86, 0.80, 0.06, 0.5, 0.02, 0.02, 0.5),
        // C-pillar / engine deck
        s(0.240, 1.00, 0.98, 0.90, 0.83, 0.06, 0.2, 0, 0, 0.4),
        s(0.280, 1.00, 1.00, 0.94, 0.86, 0.06, 0.1, 0, 0, 0.3),
        s(0.320, 1.00, 1.00, 0.97, 0.88, 0.06, 0.0, 0, 0, 0.2),
        // B-pillar / cabin
        s(0.370, 1.00, 1.00, 1.00, 0.90, 0.06, 0.0, 0, 0, 0.1),
        s(0.420, 1.00, 1.00, 1.00, 0.90, 0.06, 0.0),
        s(0.470, 1.00, 1.00, 1.00, 0.90, 0.06, 0.0),
        // A-pillar
        s(0.520, 1.00, 1.00, 0.98, 0.88, 0.06, 0.0, 0, 0, 0.1),
        s(0.560, 1.00, 0.99, 0.94, 0.85, 0.06, 0.0, 0, 0, 0.3),
        s(0.600, 0.99, 0.98, 0.88, 0.82, 0.06, 0.1, 0, 0, 0.5),
        // Front wheel arch zone
        s(0.640, 0.98, 0.96, 0.82, 0.78, 0.06, 0.3, 0.02, 0.02, 0.6),
        s(0.670, 0.97, 0.94, 0.78, 0.74, 0.06, 0.6, 0.05, 0.04, 0.7),
        s(0.700, 0.96, 0.92, 0.72, 0.70, 0.06, 0.7, 0.06, 0.05, 0.6),
        s(0.730, 0.94, 0.90, 0.66, 0.66, 0.06, 0.5, 0.04, 0.03, 0.5),
        s(0.760, 0.92, 0.86, 0.60, 0.62, 0.06, 0.3, 0.02, 0.01, 0.4),
        // Hood / nose
        s(0.800, 0.88, 0.80, 0.52, 0.55, 0.06, 0.1, 0, 0, 0.3),
        s(0.840, 0.84, 0.72, 0.44, 0.48, 0.06, 0.0, 0, 0, 0.2),
        s(0.875, 0.78, 0.64, 0.38, 0.42, 0.06, 0.0),
        s(0.905, 0.72, 0.56, 0.32, 0.36, 0.06, 0.0),
        // Front bumper zone
        s(0.930, 0.66, 0.50, 0.28, 0.32, 0.05, 0.0),
        s(0.950, 0.60, 0.46, 0.26, 0.28, 0.05, 0.0),
        s(0.965, 0.56, 0.42, 0.24, 0.26, 0.05, 0.0),
        s(0.978, 0.52, 0.40, 0.22, 0.24, 0.05, 0.0),
        s(0.988, 0.48, 0.38, 0.21, 0.22, 0.05, 0.0),
        s(0.995, 0.46, 0.36, 0.20, 0.20, 0.05, 0.0),
        s(1.000, 0.44, 0.34, 0.19, 0.19, 0.05, 0.0),
      ];

    case 'coupe':
      return [
        s(0.000, 0.50, 0.48, 0.30, 0.32, 0.07, 0.0),
        s(0.020, 0.58, 0.54, 0.36, 0.38, 0.07, 0.0),
        s(0.045, 0.68, 0.64, 0.46, 0.48, 0.07, 0.0),
        s(0.075, 0.78, 0.76, 0.58, 0.58, 0.07, 0.1, 0, 0, 0.3),
        s(0.100, 0.85, 0.82, 0.66, 0.64, 0.07, 0.3, 0, 0, 0.5),
        // Rear wheel arch
        s(0.130, 0.92, 0.88, 0.74, 0.70, 0.07, 0.5, 0.03, 0.03, 0.6),
        s(0.155, 0.96, 0.92, 0.80, 0.74, 0.07, 0.7, 0.05, 0.04, 0.7),
        s(0.180, 0.98, 0.94, 0.84, 0.78, 0.07, 0.6, 0.04, 0.03, 0.6),
        s(0.210, 1.00, 0.97, 0.88, 0.80, 0.07, 0.4, 0.02, 0.01, 0.5),
        // C-pillar / fastback
        s(0.250, 1.00, 0.99, 0.93, 0.84, 0.07, 0.2, 0, 0, 0.4),
        s(0.290, 1.00, 1.00, 0.97, 0.87, 0.07, 0.1, 0, 0, 0.3),
        s(0.330, 1.00, 1.00, 1.00, 0.88, 0.07, 0.0, 0, 0, 0.2),
        // B-pillar
        s(0.380, 1.00, 1.00, 1.00, 0.90, 0.07, 0.0, 0, 0, 0.1),
        s(0.430, 1.00, 1.00, 1.00, 0.90, 0.07, 0.0),
        s(0.480, 1.00, 1.00, 1.00, 0.90, 0.07, 0.0),
        // A-pillar
        s(0.530, 1.00, 1.00, 0.97, 0.87, 0.07, 0.0, 0, 0, 0.2),
        s(0.570, 1.00, 0.98, 0.90, 0.82, 0.07, 0.0, 0, 0, 0.4),
        s(0.610, 0.99, 0.96, 0.82, 0.76, 0.07, 0.1, 0, 0, 0.5),
        // Front wheel arch
        s(0.650, 0.97, 0.93, 0.74, 0.70, 0.07, 0.3, 0.02, 0.02, 0.6),
        s(0.680, 0.96, 0.90, 0.68, 0.66, 0.07, 0.5, 0.04, 0.03, 0.7),
        s(0.710, 0.94, 0.86, 0.60, 0.62, 0.07, 0.6, 0.05, 0.04, 0.6),
        s(0.740, 0.92, 0.82, 0.54, 0.56, 0.07, 0.4, 0.03, 0.02, 0.5),
        s(0.770, 0.88, 0.78, 0.48, 0.50, 0.07, 0.2, 0.01, 0, 0.4),
        // Hood / nose
        s(0.810, 0.84, 0.72, 0.42, 0.44, 0.07, 0.0, 0, 0, 0.2),
        s(0.845, 0.78, 0.64, 0.36, 0.38, 0.07, 0.0),
        s(0.880, 0.72, 0.56, 0.30, 0.34, 0.07, 0.0),
        s(0.910, 0.66, 0.50, 0.26, 0.30, 0.06, 0.0),
        // Front bumper
        s(0.935, 0.60, 0.46, 0.24, 0.26, 0.06, 0.0),
        s(0.955, 0.54, 0.42, 0.22, 0.24, 0.06, 0.0),
        s(0.970, 0.50, 0.40, 0.21, 0.22, 0.06, 0.0),
        s(0.982, 0.47, 0.38, 0.20, 0.20, 0.06, 0.0),
        s(0.992, 0.44, 0.36, 0.19, 0.19, 0.06, 0.0),
        s(1.000, 0.42, 0.34, 0.18, 0.18, 0.06, 0.0),
      ];

    case 'sedan':
    default:
      return [
        s(0.000, 0.48, 0.46, 0.28, 0.30, 0.08, 0.0),
        s(0.020, 0.56, 0.52, 0.34, 0.36, 0.08, 0.0),
        s(0.045, 0.66, 0.62, 0.44, 0.46, 0.08, 0.0),
        s(0.070, 0.76, 0.74, 0.56, 0.56, 0.08, 0.1, 0, 0, 0.3),
        s(0.095, 0.84, 0.82, 0.66, 0.64, 0.08, 0.3, 0, 0, 0.5),
        // Rear wheel arch
        s(0.120, 0.90, 0.87, 0.74, 0.68, 0.08, 0.5, 0.03, 0.02, 0.6),
        s(0.145, 0.94, 0.90, 0.80, 0.73, 0.08, 0.6, 0.05, 0.03, 0.7),
        s(0.170, 0.97, 0.93, 0.84, 0.76, 0.08, 0.5, 0.04, 0.02, 0.6),
        s(0.200, 1.00, 0.96, 0.88, 0.80, 0.08, 0.3, 0.02, 0.01, 0.5),
        // Trunk break
        s(0.240, 1.00, 0.99, 0.94, 0.84, 0.08, 0.1, 0, 0, 0.4),
        s(0.280, 1.00, 1.00, 0.97, 0.87, 0.08, 0.0, 0, 0, 0.3),
        // C-pillar
        s(0.320, 1.00, 1.00, 1.00, 0.88, 0.08, 0.0, 0, 0, 0.2),
        // B-pillar
        s(0.370, 1.00, 1.00, 1.00, 0.90, 0.08, 0.0, 0, 0, 0.1),
        s(0.420, 1.00, 1.00, 1.00, 0.90, 0.08, 0.0),
        s(0.470, 1.00, 1.00, 1.00, 0.90, 0.08, 0.0),
        s(0.510, 1.00, 1.00, 1.00, 0.90, 0.08, 0.0),
        // A-pillar
        s(0.550, 1.00, 1.00, 0.96, 0.86, 0.08, 0.0, 0, 0, 0.2),
        s(0.590, 1.00, 0.98, 0.88, 0.80, 0.08, 0.0, 0, 0, 0.4),
        s(0.630, 0.99, 0.96, 0.80, 0.74, 0.08, 0.1, 0, 0, 0.5),
        // Front wheel arch
        s(0.660, 0.97, 0.93, 0.72, 0.68, 0.08, 0.3, 0.02, 0.01, 0.6),
        s(0.690, 0.96, 0.90, 0.66, 0.64, 0.08, 0.5, 0.04, 0.03, 0.7),
        s(0.720, 0.94, 0.86, 0.58, 0.58, 0.08, 0.5, 0.05, 0.03, 0.6),
        s(0.750, 0.92, 0.82, 0.50, 0.52, 0.08, 0.3, 0.03, 0.02, 0.5),
        s(0.780, 0.88, 0.76, 0.44, 0.46, 0.08, 0.1, 0.01, 0, 0.4),
        // Hood / nose
        s(0.820, 0.84, 0.70, 0.38, 0.40, 0.08, 0.0, 0, 0, 0.2),
        s(0.855, 0.78, 0.62, 0.33, 0.35, 0.07, 0.0),
        s(0.890, 0.72, 0.54, 0.28, 0.30, 0.07, 0.0),
        s(0.920, 0.66, 0.48, 0.24, 0.26, 0.07, 0.0),
        // Front bumper
        s(0.945, 0.60, 0.44, 0.22, 0.24, 0.07, 0.0),
        s(0.962, 0.55, 0.40, 0.20, 0.22, 0.07, 0.0),
        s(0.976, 0.52, 0.38, 0.19, 0.20, 0.07, 0.0),
        s(0.988, 0.48, 0.36, 0.18, 0.19, 0.07, 0.0),
        s(0.996, 0.46, 0.35, 0.18, 0.18, 0.07, 0.0),
        s(1.000, 0.45, 0.34, 0.18, 0.18, 0.07, 0.0),
      ];
  }
}

// %% Section 3: Cross-section profile (48 pts, wheel arch, character lines)
// ---------------------------------------------------------------------------

function buildCrossSectionProfile(
  halfWidth: number,
  bodyH: number,
  roofH: number,
  roofHalfWidth: number,
  groundClearance: number,
  fenderBulge: number,
  wheelArchDepth: number,
  fenderFlareWidth: number,
  characterLineStrength: number,
): Vec2[] {
  const yGround = groundClearance;
  const yBody = bodyH;
  const yRoofEdge = bodyH + (roofH - bodyH) * 0.3;
  const yRoof = roofH;

  const wBottom = halfWidth * 0.85;
  const wLowerBody = halfWidth * (1.0 + fenderBulge * 0.04) + fenderFlareWidth;
  const wShoulder = halfWidth + fenderFlareWidth;
  const wUpperBody = roofHalfWidth + (halfWidth - roofHalfWidth) * 0.4;
  const wRoofEdge = roofHalfWidth;
  const wRoofTop = roofHalfWidth * 0.85;

  // Vertical positions
  const lowerMid1Y = yGround + (yBody - yGround) * 0.20;
  const lowerMid2Y = yGround + (yBody - yGround) * 0.40;
  const lowerMid3Y = yGround + (yBody - yGround) * 0.60;
  const lowerMid4Y = yGround + (yBody - yGround) * 0.80;
  const ub1 = yBody + (yRoofEdge - yBody) * 0.25;
  const ub2 = yBody + (yRoofEdge - yBody) * 0.50;
  const ub3 = yBody + (yRoofEdge - yBody) * 0.75;

  // Arch indent for lower body points
  const archIndent = wheelArchDepth;

  // Character line bump (small outward push on upper body)
  const charBump = characterLineStrength * 0.003;

  // Half-profile: 25 points (bottom-centre to top-centre)
  // Full ring = 25 + 23 mirrored = 48 = PERIMETER_PTS
  const half: Vec2[] = [];

  // 0-5: Flat bottom (6 points)
  half.push({ x: 0, y: yGround });
  half.push({ x: wBottom * 0.2, y: yGround });
  half.push({ x: wBottom * 0.4, y: yGround });
  half.push({ x: wBottom * 0.6, y: yGround });
  half.push({ x: wBottom * 0.8, y: yGround });
  half.push({ x: wBottom, y: yGround + 0.004 });

  // 6-9: Lower body with arch indent zone (4 points)
  half.push({ x: (wLowerBody * 0.96) - archIndent, y: lowerMid1Y });
  half.push({ x: (wLowerBody * 0.98) - archIndent * 0.8, y: lowerMid2Y });
  half.push({ x: wLowerBody - archIndent * 0.4, y: lowerMid3Y });
  half.push({ x: wLowerBody, y: lowerMid4Y });

  // 10-11: Shoulder (2 points, widest)
  half.push({ x: wShoulder, y: yBody * 0.95 });
  half.push({ x: wShoulder, y: yBody });

  // 12-14: Upper body with character line (3 points)
  half.push({ x: wUpperBody + (wShoulder - wUpperBody) * 0.7 + charBump, y: ub1 });
  half.push({ x: wUpperBody + (wShoulder - wUpperBody) * 0.4 + charBump * 0.5, y: ub2 });
  half.push({ x: wUpperBody + (wShoulder - wUpperBody) * 0.15, y: ub3 });

  // 15-16: Roof edge (2 points)
  half.push({ x: wRoofEdge + 0.005, y: yRoofEdge * 0.98 });
  half.push({ x: wRoofEdge, y: yRoofEdge });

  // 17-24: Roof arc (8 points)
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    const rx = wRoofTop + (wRoofEdge - wRoofTop) * Math.cos(a);
    const ry = yRoofEdge + (yRoof - yRoofEdge) * Math.sin(a);
    half.push({ x: rx, y: ry });
  }
  half[24] = { x: 0, y: yRoof }; // exact top-centre

  // Full ring: right side 0..24, left side mirror 23..1
  const ring: Vec2[] = [];
  for (let i = 0; i <= 24; i++) {
    ring.push(half[i]);
  }
  for (let i = 23; i >= 1; i--) {
    ring.push({ x: -half[i].x, y: half[i].y });
  }
  // ring.length = 25 + 23 = 48 = PERIMETER_PTS

  return ring;
}

// %% Section 4: Core geometry generators
// ---------------------------------------------------------------------------

function buildStations(
  bodyType: BodyType,
  halfWidth: number,
  bodyHeight: number,
  roofHeight: number,
  roofHalfWidth: number,
): Station[] {
  const specs = getStationSpecs(bodyType);
  const stations: Station[] = [];

  for (const sp of specs) {
    const hw = halfWidth * sp.widthScale;
    const bh = bodyHeight * sp.bodyHeightScale;
    const rh = roofHeight * sp.roofHeightScale;
    const rhw = roofHalfWidth * sp.roofWidthScale;
    const gc = sp.groundClearance;
    const fb = sp.fenderBulge;
    const effectiveRoofH = Math.max(rh, bh + 0.01);
    const profile = buildCrossSectionProfile(
      hw, bh + gc, effectiveRoofH + gc, rhw, gc, fb,
      sp.wheelArchDepth, sp.fenderFlareWidth, sp.characterLineStrength,
    );
    stations.push({ t: sp.t, profile });
  }

  return stations;
}

function createLoftedBody(config: VehicleConfig): THREE.BufferGeometry {
  const bodyType = (config.bodyType || 'sedan') as BodyType;
  const props = getProportions(bodyType);
  const length = config.dimensions.wheelbase * props.lengthFactor;
  const halfWidth = (config.dimensions.trackWidth * props.bodyWidthScale) / 2;
  const bodyHeight = props.bodyHeight;
  const roofHeight = props.roofHeight;
  const roofHalfWidth = halfWidth * 0.75;

  const stations = buildStations(bodyType, halfWidth, bodyHeight, roofHeight, roofHalfWidth);
  const halfLength = length / 2;
  const nStations = stations.length;
  const nPeri = PERIMETER_PTS;

  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let si = 0; si < nStations; si++) {
    const station = stations[si];
    const z = station.t * length - halfLength;
    const profile = station.profile;

    for (let p = 0; p < nPeri; p++) {
      const pt = profile[p];
      vertices.push(pt.x, pt.y, z);

      const prev = profile[(p - 1 + nPeri) % nPeri];
      const next = profile[(p + 1) % nPeri];
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      let nx = ty;
      let ny = -tx;
      const len = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= len;
      ny /= len;
      normals.push(nx, ny, 0);
    }
  }

  for (let si = 0; si < nStations - 1; si++) {
    for (let p = 0; p < nPeri; p++) {
      const curr = si * nPeri + p;
      const next = si * nPeri + ((p + 1) % nPeri);
      const currNext = (si + 1) * nPeri + p;
      const nextNext = (si + 1) * nPeri + ((p + 1) % nPeri);
      indices.push(curr, currNext, next);
      indices.push(next, currNext, nextNext);
    }
  }

  // Cap rear
  const rearCenterIdx = vertices.length / 3;
  const rearStation = stations[0];
  let rearAvgY = 0;
  for (const pt of rearStation.profile) rearAvgY += pt.y;
  rearAvgY /= rearStation.profile.length;
  vertices.push(0, rearAvgY, -halfLength);
  normals.push(0, 0, -1);
  for (let p = 0; p < nPeri; p++) {
    const next = (p + 1) % nPeri;
    indices.push(rearCenterIdx, next, p);
  }

  // Cap front
  const frontCenterIdx = vertices.length / 3;
  const frontStation = stations[nStations - 1];
  let frontAvgY = 0;
  for (const pt of frontStation.profile) frontAvgY += pt.y;
  frontAvgY /= frontStation.profile.length;
  vertices.push(0, frontAvgY, halfLength);
  normals.push(0, 0, 1);
  const frontBase = (nStations - 1) * nPeri;
  for (let p = 0; p < nPeri; p++) {
    const next = (p + 1) % nPeri;
    indices.push(frontCenterIdx, frontBase + p, frontBase + next);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// --- Window geometry with trim ---

function createWindowGeometry(config: VehicleConfig): THREE.BufferGeometry {
  const bodyType = (config.bodyType || 'sedan') as BodyType;
  const props = getProportions(bodyType);
  const length = config.dimensions.wheelbase * props.lengthFactor;
  const halfWidth = (config.dimensions.trackWidth * props.bodyWidthScale) / 2;
  const bodyHeight = props.bodyHeight;
  const roofHeight = props.roofHeight;
  const roofHalfWidth = halfWidth * 0.75;

  const stations = buildStations(bodyType, halfWidth, bodyHeight, roofHeight, roofHalfWidth);
  const halfLength = length / 2;

  const vertices: number[] = [];
  const indices: number[] = [];

  const windowStartT = bodyType === 'supercar' ? 0.30 : bodyType === 'coupe' ? 0.28 : 0.26;
  const windowEndT = bodyType === 'supercar' ? 0.56 : bodyType === 'coupe' ? 0.56 : 0.56;

  const windowStations: { z: number; profile: Vec2[] }[] = [];
  for (const st of stations) {
    if (st.t >= windowStartT - 0.01 && st.t <= windowEndT + 0.01) {
      windowStations.push({ z: st.t * length - halfLength, profile: st.profile });
    }
  }

  if (windowStations.length < 2) return new THREE.BufferGeometry();

  const beltIdx = 11; // shoulder top
  const roofIdx = 17; // first roof arc point

  // Side windows
  for (const side of [-1, 1]) {
    const baseVtx = vertices.length / 3;
    const nSteps = windowStations.length;

    for (let i = 0; i < nSteps; i++) {
      const ws = windowStations[i];
      const z = ws.z;
      const profile = ws.profile;

      let beltPt: Vec2;
      let roofPt: Vec2;

      if (side > 0) {
        beltPt = profile[beltIdx];
        roofPt = profile[roofIdx];
      } else {
        const leftBeltIdx = PERIMETER_PTS - beltIdx;
        const leftRoofIdx = PERIMETER_PTS - roofIdx;
        beltPt = profile[leftBeltIdx];
        roofPt = profile[leftRoofIdx];
      }

      const insetDir = side > 0 ? -BODY_INSET : BODY_INSET;
      vertices.push(beltPt.x + insetDir, beltPt.y + 0.01, z);
      vertices.push(roofPt.x + insetDir, roofPt.y - 0.01, z);
    }

    for (let i = 0; i < nSteps - 1; i++) {
      const bl = baseVtx + i * 2;
      const tl = bl + 1;
      const br = bl + 2;
      const tr = bl + 3;
      if (side > 0) {
        indices.push(bl, br, tl);
        indices.push(tl, br, tr);
      } else {
        indices.push(bl, tl, br);
        indices.push(tl, tr, br);
      }
    }
  }

  // Windshield
  {
    const aPillarIdx = windowStations.length - 1;
    const aStation = windowStations[aPillarIdx];
    const windshieldStations: { z: number; profile: Vec2[] }[] = [];
    for (const st of stations) {
      if (st.t > windowEndT && st.t < windowEndT + 0.15) {
        windshieldStations.push({ z: st.t * length - halfLength, profile: st.profile });
      }
    }
    if (windshieldStations.length >= 1) {
      const topStation = aStation;
      const bottomStation = windshieldStations[windshieldStations.length - 1];
      const baseVtx = vertices.length / 3;

      const topRoofPtR = topStation.profile[roofIdx];
      const topRoofPtL = topStation.profile[PERIMETER_PTS - roofIdx];
      const botBeltPtR = bottomStation.profile[beltIdx];
      const botBeltPtL = bottomStation.profile[PERIMETER_PTS - beltIdx];

      vertices.push(botBeltPtL.x + BODY_INSET, botBeltPtL.y + 0.01, bottomStation.z);
      vertices.push(botBeltPtR.x - BODY_INSET, botBeltPtR.y + 0.01, bottomStation.z);
      vertices.push(topRoofPtL.x + BODY_INSET, topRoofPtL.y - 0.01, topStation.z);
      vertices.push(topRoofPtR.x - BODY_INSET, topRoofPtR.y - 0.01, topStation.z);

      const allRows: number[] = [baseVtx, baseVtx + 1];
      const midStations = windshieldStations.slice(0, -1);
      if (midStations.length > 0) {
        for (const ms of midStations) {
          const mIdx = Math.min(beltIdx + 1, 14);
          const mBeltR = ms.profile[mIdx];
          const mBeltL = ms.profile[PERIMETER_PTS - mIdx];
          const midBase = vertices.length / 3;
          vertices.push(mBeltL.x + BODY_INSET, mBeltL.y, ms.z);
          vertices.push(mBeltR.x - BODY_INSET, mBeltR.y, ms.z);
          allRows.push(midBase, midBase + 1);
        }
      }
      allRows.push(baseVtx + 2, baseVtx + 3);

      for (let i = 0; i < allRows.length - 2; i += 2) {
        const bl = allRows[i];
        const br = allRows[i + 1];
        const tl = allRows[i + 2];
        const tr = allRows[i + 3];
        indices.push(bl, tl, br);
        indices.push(br, tl, tr);
      }
    }
  }

  // Rear window
  {
    const cPillarStation = windowStations[0];
    const rearWindowStations: { z: number; profile: Vec2[] }[] = [];
    for (const st of stations) {
      if (st.t < windowStartT && st.t > windowStartT - 0.15) {
        rearWindowStations.push({ z: st.t * length - halfLength, profile: st.profile });
      }
    }
    if (rearWindowStations.length >= 1) {
      const topStation = cPillarStation;
      const bottomStation = rearWindowStations[0];
      const baseVtx = vertices.length / 3;

      const topRoofPtR = topStation.profile[roofIdx];
      const topRoofPtL = topStation.profile[PERIMETER_PTS - roofIdx];
      const botBeltPtR = bottomStation.profile[beltIdx];
      const botBeltPtL = bottomStation.profile[PERIMETER_PTS - beltIdx];

      vertices.push(botBeltPtL.x + BODY_INSET, botBeltPtL.y + 0.01, bottomStation.z);
      vertices.push(botBeltPtR.x - BODY_INSET, botBeltPtR.y + 0.01, bottomStation.z);
      vertices.push(topRoofPtL.x + BODY_INSET, topRoofPtL.y - 0.01, topStation.z);
      vertices.push(topRoofPtR.x - BODY_INSET, topRoofPtR.y - 0.01, topStation.z);

      indices.push(baseVtx, baseVtx + 2, baseVtx + 1);
      indices.push(baseVtx + 1, baseVtx + 2, baseVtx + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// --- Window trim (chrome border around windows) ---

function createWindowTrimGeometry(config: VehicleConfig): THREE.BufferGeometry {
  const bodyType = (config.bodyType || 'sedan') as BodyType;
  const props = getProportions(bodyType);
  const length = config.dimensions.wheelbase * props.lengthFactor;
  const halfWidth = (config.dimensions.trackWidth * props.bodyWidthScale) / 2;
  const roofHalfWidth = halfWidth * 0.75;

  const stations = buildStations(bodyType, halfWidth, props.bodyHeight, props.roofHeight, roofHalfWidth);
  const halfLength = length / 2;

  const vertices: number[] = [];
  const indices: number[] = [];

  const windowStartT = bodyType === 'supercar' ? 0.30 : bodyType === 'coupe' ? 0.28 : 0.26;
  const windowEndT = bodyType === 'supercar' ? 0.56 : bodyType === 'coupe' ? 0.56 : 0.56;

  const windowStations: { z: number; profile: Vec2[] }[] = [];
  for (const st of stations) {
    if (st.t >= windowStartT - 0.01 && st.t <= windowEndT + 0.01) {
      windowStations.push({ z: st.t * length - halfLength, profile: st.profile });
    }
  }

  if (windowStations.length < 2) return new THREE.BufferGeometry();

  const beltIdx = 11;
  const roofIdx = 17;
  const trimThickness = 0.004;

  // Chrome trim along belt line and roof line for each side
  for (const side of [-1, 1]) {
    const baseVtx = vertices.length / 3;
    const nSteps = windowStations.length;

    for (let i = 0; i < nSteps; i++) {
      const ws = windowStations[i];
      const z = ws.z;
      const profile = ws.profile;

      let beltPt: Vec2;
      let roofPt: Vec2;

      if (side > 0) {
        beltPt = profile[beltIdx];
        roofPt = profile[roofIdx];
      } else {
        beltPt = profile[PERIMETER_PTS - beltIdx];
        roofPt = profile[PERIMETER_PTS - roofIdx];
      }

      const insetDir = side > 0 ? -1 : 1;
      // Belt line trim (outer and inner edges)
      vertices.push(beltPt.x + insetDir * 0.001, beltPt.y + 0.008, z);
      vertices.push(beltPt.x + insetDir * 0.001, beltPt.y + 0.008 + trimThickness, z);
      // Roof line trim
      vertices.push(roofPt.x + insetDir * 0.001, roofPt.y - 0.008, z);
      vertices.push(roofPt.x + insetDir * 0.001, roofPt.y - 0.008 - trimThickness, z);
    }

    for (let i = 0; i < nSteps - 1; i++) {
      const b = baseVtx + i * 4;
      // Belt trim strip
      if (side > 0) {
        indices.push(b, b + 4, b + 1);
        indices.push(b + 1, b + 4, b + 5);
      } else {
        indices.push(b, b + 1, b + 4);
        indices.push(b + 1, b + 5, b + 4);
      }
      // Roof trim strip
      if (side > 0) {
        indices.push(b + 2, b + 6, b + 3);
        indices.push(b + 3, b + 6, b + 7);
      } else {
        indices.push(b + 2, b + 3, b + 6);
        indices.push(b + 3, b + 7, b + 6);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// --- Interior silhouette ---

function InteriorSilhouette({ config }: { config: VehicleConfig }) {
  const bodyType = (config.bodyType || 'sedan') as BodyType;
  const props = getProportions(bodyType);
  const length = config.dimensions.wheelbase * props.lengthFactor;
  const halfWidth = (config.dimensions.trackWidth * props.bodyWidthScale) / 2;
  const halfLength = length / 2;

  const dashY = props.bodyHeight * 0.75;
  const dashZ = halfLength * 0.15;
  const seatY = props.bodyHeight * 0.45;
  const seatZ = -halfLength * 0.05;
  const steeringY = props.bodyHeight * 0.72;
  const steeringZ = halfLength * 0.08;

  return (
    <group>
      {/* Dashboard */}
      <mesh position={[0, dashY, dashZ]}>
        <boxGeometry args={[halfWidth * 1.4, 0.12, 0.25]} />
        <meshStandardMaterial {...INTERIOR_PROPS} />
      </mesh>
      {/* Center console */}
      <mesh position={[0, seatY - 0.05, seatZ]}>
        <boxGeometry args={[0.12, 0.15, length * 0.2]} />
        <meshStandardMaterial {...INTERIOR_PROPS} />
      </mesh>
      {/* Left seat */}
      <mesh position={[-halfWidth * 0.3, seatY, seatZ]}>
        <boxGeometry args={[0.28, 0.30, 0.35]} />
        <meshStandardMaterial {...INTERIOR_PROPS} />
      </mesh>
      {/* Right seat */}
      <mesh position={[halfWidth * 0.3, seatY, seatZ]}>
        <boxGeometry args={[0.28, 0.30, 0.35]} />
        <meshStandardMaterial {...INTERIOR_PROPS} />
      </mesh>
      {/* Steering wheel */}
      <mesh position={[-halfWidth * 0.25, steeringY, steeringZ]} rotation={[0.35, 0, 0]}>
        <torusGeometry args={[0.09, 0.012, 8, 16]} />
        <meshStandardMaterial {...INTERIOR_PROPS} />
      </mesh>
    </group>
  );
}

// %% Section 5: Detail components
// ---------------------------------------------------------------------------

// --- Headlight (multi-element) ---

function Headlight({ position, side, bodyType }: {
  position: [number, number, number];
  side: 1 | -1;
  bodyType: BodyType;
}) {
  const housingW = bodyType === 'supercar' ? 0.22 : 0.20;
  const housingH = bodyType === 'supercar' ? 0.055 : 0.065;
  const drlRadius = housingH * 0.35;

  return (
    <group position={position}>
      {/* Dark housing */}
      <mesh>
        <boxGeometry args={[housingW, housingH, 0.06]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} metalness={0.3} />
      </mesh>
      {/* DRL ring */}
      <mesh position={[side * housingW * 0.15, 0, 0.025]} rotation={[0, 0, 0]}>
        <torusGeometry args={[drlRadius, 0.004, 8, 24]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffcc" emissiveIntensity={3.0} roughness={0.1} />
      </mesh>
      {/* Projector lens */}
      <mesh position={[side * housingW * 0.15, 0, 0.028]}>
        <sphereGeometry args={[drlRadius * 0.55, 12, 8]} />
        <meshPhysicalMaterial color="#ffffff" emissive="#ffffdd" emissiveIntensity={2.0} roughness={0.0} metalness={0.2} transparent opacity={0.8} />
      </mesh>
      {/* Turn signal strip */}
      <mesh position={[-side * housingW * 0.25, -housingH * 0.25, 0.025]}>
        <boxGeometry args={[housingW * 0.35, housingH * 0.18, 0.008]} />
        <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={0.5} roughness={0.2} />
      </mesh>
      {/* Glass cover */}
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[housingW * 0.95, housingH * 0.9]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.12} roughness={0.0} metalness={0.0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// --- Taillight assembly (LED bar) ---

function TailLightAssembly({ position, side, bodyType, braking }: {
  position: [number, number, number];
  side: 1 | -1;
  bodyType: BodyType;
  braking: boolean;
}) {
  const housingW = bodyType === 'supercar' ? 0.26 : 0.24;
  const housingH = 0.06;
  const intensity = braking ? 4.0 : 1.5;
  const ledCount = bodyType === 'supercar' ? 7 : 5;
  const ledW = housingW * 0.8 / ledCount;

  return (
    <group position={position}>
      {/* Dark housing */}
      <mesh>
        <boxGeometry args={[housingW, housingH, 0.04]} />
        <meshStandardMaterial color="#1a0000" roughness={0.85} metalness={0.2} />
      </mesh>
      {/* LED strips */}
      {Array.from({ length: ledCount }).map((_, i) => {
        const x = -housingW * 0.4 + (i + 0.5) * (housingW * 0.8 / ledCount);
        return (
          <mesh key={`led-${i}`} position={[x, 0, 0.018]}>
            <boxGeometry args={[ledW * 0.7, housingH * 0.5, 0.005]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={intensity} roughness={0.2} metalness={0.1} transparent opacity={0.9} />
          </mesh>
        );
      })}
      {/* Amber turn signal section */}
      <mesh position={[-side * housingW * 0.35, -housingH * 0.15, 0.018]}>
        <boxGeometry args={[housingW * 0.15, housingH * 0.3, 0.005]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff8800" emissiveIntensity={0.3} roughness={0.2} />
      </mesh>
    </group>
  );
}

// --- Third brake light ---

function ThirdBrakeLight({ position, width, braking }: {
  position: [number, number, number];
  width: number;
  braking: boolean;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={[width, 0.012, 0.008]} />
      <meshStandardMaterial
        color="#ff0000"
        emissive="#ff0000"
        emissiveIntensity={braking ? 3.0 : 0.5}
        roughness={0.2}
      />
    </mesh>
  );
}

// --- Grille ---

function Grille({ width, height, position, bodyType }: {
  width: number;
  height: number;
  position: [number, number, number];
  bodyType: BodyType;
}) {
  const isHoneycomb = bodyType === 'supercar';
  const slotCount = bodyType === 'supercar' ? 3 : bodyType === 'coupe' ? 4 : 5;
  const slatColor = bodyType === 'sedan' ? '#999' : '#1a1a1a';

  const slats = [];
  const slatHeight = height / (slotCount * 2 - 1);
  const startY = -height / 2 + slatHeight / 2;

  for (let i = 0; i < slotCount; i++) {
    const y = startY + i * slatHeight * 2;
    slats.push(
      <mesh key={`slat-${i}`} position={[0, y, 0]}>
        <boxGeometry args={[width * 0.95, slatHeight * 0.6, 0.01]} />
        <meshStandardMaterial color={slatColor} roughness={isHoneycomb ? 0.7 : 0.9} metalness={isHoneycomb ? 0.3 : (bodyType === 'sedan' ? 0.8 : 0.4)} />
      </mesh>,
    );
    if (i < slotCount - 1) {
      slats.push(
        <mesh key={`gap-${i}`} position={[0, y + slatHeight, -0.005]}>
          <boxGeometry args={[width * 0.90, slatHeight * 0.4, 0.005]} />
          <meshStandardMaterial color="#050505" roughness={1.0} metalness={0.0} />
        </mesh>,
      );
    }
  }

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.005]}>
        <boxGeometry args={[width, height, 0.01]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} metalness={0.3} />
      </mesh>
      {slats}
    </group>
  );
}

// --- Side mirror ---

function SideMirror({ position, side, color }: {
  position: [number, number, number];
  side: 1 | -1;
  color: string;
}) {
  const armLength = 0.07;
  const mirrorWidth = 0.10;
  const mirrorHeight = 0.055;
  const mirrorDepth = 0.06;

  return (
    <group position={position}>
      {/* Mounting arm */}
      <mesh position={[side * armLength * 0.4, 0, 0]} rotation={[0, 0, side * 0.15]}>
        <boxGeometry args={[armLength, 0.022, 0.025]} />
        <meshPhysicalMaterial {...bodyPaintProps(color)} />
      </mesh>
      {/* Mirror housing */}
      <mesh position={[side * armLength, 0, -0.005]} scale={[1, mirrorHeight / mirrorWidth, mirrorDepth / mirrorWidth]}>
        <sphereGeometry args={[mirrorWidth * 0.55, 12, 8]} />
        <meshPhysicalMaterial {...bodyPaintProps(color)} />
      </mesh>
      {/* Mirror face */}
      <mesh position={[side * (armLength + 0.002), 0, -0.01]} rotation={[0, side * 0.1, 0]}>
        <planeGeometry args={[mirrorWidth * 0.7, mirrorHeight * 0.7]} />
        <meshStandardMaterial color="#333" roughness={0.0} metalness={1.0} side={THREE.DoubleSide} />
      </mesh>
      {/* LED turn signal strip */}
      <mesh position={[side * armLength * 0.8, -mirrorHeight * 0.35, 0]} rotation={[0, side * 0.1, 0]}>
        <boxGeometry args={[mirrorWidth * 0.5, 0.006, 0.015]} />
        <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={0.3} roughness={0.3} />
      </mesh>
    </group>
  );
}

// --- Door handle ---

function DoorHandle({ position, side, color }: {
  position: [number, number, number];
  side: 1 | -1;
  color: string;
}) {
  return (
    <group position={position}>
      {/* Handle recess */}
      <mesh>
        <boxGeometry args={[0.003, 0.025, 0.10]} />
        <meshStandardMaterial color="#050505" roughness={1} />
      </mesh>
      {/* Handle bar */}
      <mesh position={[side * 0.004, 0, 0.01]}>
        <boxGeometry args={[0.006, 0.012, 0.08]} />
        <meshStandardMaterial {...DARK_CHROME_PROPS} />
      </mesh>
    </group>
  );
}

// --- Spoiler ---

function Spoiler({ width, position, color, bodyType }: {
  width: number;
  position: [number, number, number];
  color: string;
  bodyType: BodyType;
}) {
  const airfoilShape = useMemo(() => {
    const shape = new THREE.Shape();
    const chord = bodyType === 'supercar' ? 0.12 : 0.10;
    const thickness = bodyType === 'supercar' ? 0.028 : 0.025;
    shape.moveTo(0, 0);
    shape.bezierCurveTo(chord * 0.1, thickness * 0.8, chord * 0.3, thickness, chord * 0.5, thickness * 0.9);
    shape.bezierCurveTo(chord * 0.7, thickness * 0.7, chord * 0.9, thickness * 0.2, chord, 0);
    shape.bezierCurveTo(chord * 0.9, -thickness * 0.1, chord * 0.5, -thickness * 0.15, chord * 0.2, -thickness * 0.1);
    shape.bezierCurveTo(chord * 0.05, -thickness * 0.05, 0, 0, 0, 0);
    return shape;
  }, [bodyType]);

  const wingGeo = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(airfoilShape, {
      depth: width,
      bevelEnabled: false,
      curveSegments: 8,
    });
    geo.translate(-0.05, 0, -width / 2);
    return geo;
  }, [airfoilShape, width]);

  const endplateH = bodyType === 'supercar' ? 0.08 : 0.06;
  const endplateD = bodyType === 'supercar' ? 0.14 : 0.12;
  const pylonH = bodyType === 'supercar' ? 0.16 : 0.12;

  return (
    <group position={position}>
      <mesh geometry={wingGeo} rotation={[0.05, 0, 0]} castShadow>
        <meshPhysicalMaterial {...bodyPaintProps(color)} />
      </mesh>
      {/* Endplates */}
      <mesh position={[0, -endplateH * 0.3, -width / 2]}>
        <boxGeometry args={[endplateD, endplateH, 0.008]} />
        <meshPhysicalMaterial {...bodyPaintProps(color)} />
      </mesh>
      <mesh position={[0, -endplateH * 0.3, width / 2]}>
        <boxGeometry args={[endplateD, endplateH, 0.008]} />
        <meshPhysicalMaterial {...bodyPaintProps(color)} />
      </mesh>
      {/* Pylons */}
      <mesh position={[0.01, -pylonH * 0.55, -width * 0.3]}>
        <boxGeometry args={[0.015, pylonH, 0.02]} />
        <meshPhysicalMaterial {...bodyPaintProps(color)} />
      </mesh>
      <mesh position={[0.01, -pylonH * 0.55, width * 0.3]}>
        <boxGeometry args={[0.015, pylonH, 0.02]} />
        <meshPhysicalMaterial {...bodyPaintProps(color)} />
      </mesh>
    </group>
  );
}

// --- Front bumper with splitter and fog lights ---

function FrontBumper({ config, color }: { config: VehicleConfig; color: string }) {
  const bodyType = (config.bodyType || 'sedan') as BodyType;
  const props = getProportions(bodyType);
  const length = config.dimensions.wheelbase * props.lengthFactor;
  const halfLength = length / 2;
  const halfWidth = (config.dimensions.trackWidth * props.bodyWidthScale) / 2;

  const splitterW = halfWidth * 1.6;
  const splitterZ = halfLength * 0.98;
  const intakeW = halfWidth * 0.35;
  const intakeH = bodyType === 'supercar' ? 0.06 : 0.05;

  return (
    <group>
      {/* Splitter lip */}
      <mesh position={[0, 0.03, splitterZ]} castShadow>
        <boxGeometry args={[splitterW, 0.008, 0.06]} />
        <meshStandardMaterial {...PLASTIC_PROPS} />
      </mesh>
      {/* Air intakes - left */}
      <mesh position={[-halfWidth * 0.4, 0.10, splitterZ - 0.01]}>
        <boxGeometry args={[intakeW, intakeH, 0.03]} />
        <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
      </mesh>
      {/* Air intakes - right */}
      <mesh position={[halfWidth * 0.4, 0.10, splitterZ - 0.01]}>
        <boxGeometry args={[intakeW, intakeH, 0.03]} />
        <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
      </mesh>
      {/* Fog light recesses */}
      <mesh position={[-halfWidth * 0.6, 0.12, splitterZ]}>
        <cylinderGeometry args={[0.015, 0.015, 0.02, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffcc" emissiveIntensity={0.5} roughness={0.1} />
      </mesh>
      <mesh position={[halfWidth * 0.6, 0.12, splitterZ]}>
        <cylinderGeometry args={[0.015, 0.015, 0.02, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffcc" emissiveIntensity={0.5} roughness={0.1} />
      </mesh>
    </group>
  );
}

// --- Rear bumper with diffuser ---

function RearBumper({ config, color }: { config: VehicleConfig; color: string }) {
  const bodyType = (config.bodyType || 'sedan') as BodyType;
  const props = getProportions(bodyType);
  const length = config.dimensions.wheelbase * props.lengthFactor;
  const halfLength = length / 2;
  const halfWidth = (config.dimensions.trackWidth * props.bodyWidthScale) / 2;
  const hw = config.dimensions.trackWidth / 2;

  const diffuserZ = -halfLength * 0.98;
  const finCount = bodyType === 'supercar' ? 5 : bodyType === 'coupe' ? 3 : 2;
  const diffuserW = halfWidth * 1.2;

  return (
    <group>
      {/* Diffuser base */}
      <mesh position={[0, 0.03, diffuserZ]}>
        <boxGeometry args={[diffuserW, 0.008, 0.08]} />
        <meshStandardMaterial {...PLASTIC_PROPS} />
      </mesh>
      {/* Diffuser fins */}
      {Array.from({ length: finCount }).map((_, i) => {
        const x = -diffuserW * 0.35 + (i + 0.5) * (diffuserW * 0.7 / finCount);
        return (
          <mesh key={`fin-${i}`} position={[x, 0.04, diffuserZ - 0.02]} rotation={[0.15, 0, 0]}>
            <boxGeometry args={[0.006, 0.04, 0.06]} />
            <meshStandardMaterial {...PLASTIC_PROPS} />
          </mesh>
        );
      })}
      {/* Reflector strip */}
      <mesh position={[0, 0.065, diffuserZ + 0.005]}>
        <boxGeometry args={[diffuserW * 0.6, 0.008, 0.004]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} roughness={0.3} />
      </mesh>
      {/* Exhaust pipes */}
      <mesh position={[-hw * 0.3, 0.06, diffuserZ]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.032, 0.07, 12]} />
        <meshStandardMaterial color="#444444" roughness={0.25} metalness={0.92} />
      </mesh>
      <mesh position={[hw * 0.3, 0.06, diffuserZ]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.032, 0.07, 12]} />
        <meshStandardMaterial color="#444444" roughness={0.25} metalness={0.92} />
      </mesh>
      {/* Exhaust inner */}
      <mesh position={[-hw * 0.3, 0.06, diffuserZ - 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.02, 12]} />
        <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.5} />
      </mesh>
      <mesh position={[hw * 0.3, 0.06, diffuserZ - 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.02, 12]} />
        <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.5} />
      </mesh>
    </group>
  );
}

// --- Side skirts ---

function SideSkirts({ config, color }: { config: VehicleConfig; color: string }) {
  const bodyType = (config.bodyType || 'sedan') as BodyType;
  const props = getProportions(bodyType);
  const length = config.dimensions.wheelbase * props.lengthFactor;
  const halfWidth = (config.dimensions.trackWidth * props.bodyWidthScale) / 2;
  const skirtLength = length * 0.5;

  return (
    <group>
      <mesh position={[-halfWidth * 0.95, 0.06, 0]}>
        <boxGeometry args={[0.015, 0.04, skirtLength]} />
        <meshStandardMaterial {...PLASTIC_PROPS} />
      </mesh>
      <mesh position={[halfWidth * 0.95, 0.06, 0]}>
        <boxGeometry args={[0.015, 0.04, skirtLength]} />
        <meshStandardMaterial {...PLASTIC_PROPS} />
      </mesh>
    </group>
  );
}

// %% Section 6: Wheel components
// ---------------------------------------------------------------------------

function Wheel({ position, radius, steering = 0, spin = 0, side = 1 }: {
  position: [number, number, number];
  radius: number;
  steering?: number;
  spin?: number;
  side?: 1 | -1;
}) {
  const tireWidth = radius * 0.35;
  const rimRadius = radius * 0.62;
  const rimDepth = radius * 0.28;
  const spokeCount = 7;

  // Tire with LatheGeometry for realistic cross-section
  const tireGeo = useMemo(() => {
    // Cross-section profile for tire: flat contact patch, sidewall bulge, bead
    const pts: THREE.Vector2[] = [];
    const outerR = radius;
    const innerR = rimRadius + 0.005;
    const w = tireWidth;
    const steps = 16;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI; // 0 to PI (half the tire cross-section)

      // Parameterize the cross-section
      let r: number;
      let z: number;

      if (t < 0.1) {
        // Inner bead
        r = innerR + (outerR - innerR) * 0.1 * (t / 0.1);
        z = -w / 2 + w * t;
      } else if (t < 0.25) {
        // Inner sidewall
        const st = (t - 0.1) / 0.15;
        r = innerR + (outerR - innerR) * (0.1 + 0.4 * st);
        z = -w / 2 + w * t;
        // Sidewall bulge
        r += Math.sin(st * Math.PI) * 0.008;
      } else if (t < 0.75) {
        // Contact patch / tread (flattened)
        const st = (t - 0.25) / 0.5;
        r = outerR;
        z = -w / 2 + w * t;
      } else if (t < 0.9) {
        // Outer sidewall
        const st = (t - 0.75) / 0.15;
        r = innerR + (outerR - innerR) * (0.5 - 0.4 * st);
        z = -w / 2 + w * t;
        r += Math.sin(st * Math.PI) * 0.008;
      } else {
        // Outer bead
        r = innerR + (outerR - innerR) * 0.1 * ((1 - t) / 0.1);
        z = -w / 2 + w * t;
      }

      pts.push(new THREE.Vector2(r, z));
    }

    const geo = new THREE.LatheGeometry(pts, 32);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, [radius, rimRadius, tireWidth]);

  // Multi-spoke rim geometry
  const spokeGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const idxs: number[] = [];

    const innerR = rimRadius * 0.22;
    const outerR = rimRadius * 0.92;
    const spokeW = 0.014;
    const spokeD = rimDepth * 0.35;
    const spokeThickness = 0.008;

    for (let si = 0; si < spokeCount; si++) {
      const angle = (si / spokeCount) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const cos90 = Math.cos(angle + Math.PI / 2);
      const sin90 = Math.sin(angle + Math.PI / 2);

      // Tapered spoke (wider at hub, narrower at rim)
      const innerW = spokeW * 1.3;
      const outerW = spokeW * 0.8;

      const baseIdx = verts.length / 3;

      // Inner end
      const ix = cos * innerR;
      const iy = sin * innerR;
      verts.push(ix - cos90 * innerW, iy - sin90 * innerW, -spokeD / 2);
      verts.push(ix + cos90 * innerW, iy + sin90 * innerW, -spokeD / 2);
      verts.push(ix + cos90 * innerW, iy + sin90 * innerW, spokeD / 2);
      verts.push(ix - cos90 * innerW, iy - sin90 * innerW, spokeD / 2);

      // Outer end
      const ox = cos * outerR;
      const oy = sin * outerR;
      verts.push(ox - cos90 * outerW, oy - sin90 * outerW, -spokeD / 2);
      verts.push(ox + cos90 * outerW, oy + sin90 * outerW, -spokeD / 2);
      verts.push(ox + cos90 * outerW, oy + sin90 * outerW, spokeD / 2);
      verts.push(ox - cos90 * outerW, oy - sin90 * outerW, spokeD / 2);

      const b = baseIdx;
      idxs.push(b, b + 1, b + 5); idxs.push(b, b + 5, b + 4);
      idxs.push(b + 3, b + 7, b + 6); idxs.push(b + 3, b + 6, b + 2);
      idxs.push(b + 1, b + 2, b + 6); idxs.push(b + 1, b + 6, b + 5);
      idxs.push(b, b + 4, b + 7); idxs.push(b, b + 7, b + 3);
      idxs.push(b, b + 3, b + 2); idxs.push(b, b + 2, b + 1);
      idxs.push(b + 4, b + 5, b + 6); idxs.push(b + 4, b + 6, b + 7);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idxs);
    geo.computeVertexNormals();
    return geo;
  }, [rimRadius, rimDepth, spokeCount]);

  // Ventilated brake disc
  const discGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const idxs: number[] = [];

    const discR = rimRadius * 0.75;
    const discInnerR = rimRadius * 0.35;
    const segments = 32;
    const thickness = 0.014;

    // Outer ring
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      verts.push(c * discR, sn * discR, -thickness / 2);
      verts.push(c * discR, sn * discR, thickness / 2);
      verts.push(c * discInnerR, sn * discInnerR, -thickness / 2);
      verts.push(c * discInnerR, sn * discInnerR, thickness / 2);
    }

    for (let i = 0; i < segments; i++) {
      const b = i * 4;
      const n = (i + 1) * 4;
      // Outer face
      idxs.push(b, n, b + 1); idxs.push(b + 1, n, n + 1);
      // Inner face
      idxs.push(b + 2, b + 3, n + 2); idxs.push(b + 3, n + 3, n + 2);
      // Front face
      idxs.push(b, b + 2, n); idxs.push(n, b + 2, n + 2);
      // Back face
      idxs.push(b + 1, n + 1, b + 3); idxs.push(b + 3, n + 1, n + 3);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idxs);
    geo.computeVertexNormals();
    return geo;
  }, [rimRadius]);

  const lugCount = 5;

  return (
    <group position={position} rotation={[0, steering, 0]}>
      <group rotation={[spin, 0, 0]}>
        {/* Tire */}
        <mesh geometry={tireGeo} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial {...RUBBER_PROPS} />
        </mesh>

        {/* Rim barrel */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[rimRadius, rimRadius, rimDepth, 32]} />
          <meshStandardMaterial color="#b8b8b8" roughness={0.08} metalness={0.95} />
        </mesh>

        {/* Hub */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[rimRadius * 0.22, rimRadius * 0.22, rimDepth * 0.5, 16]} />
          <meshStandardMaterial color="#a0a0a0" roughness={0.1} metalness={0.95} />
        </mesh>

        {/* Spokes */}
        <mesh geometry={spokeGeo} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#d0d0d0" roughness={0.08} metalness={0.95} />
        </mesh>

        {/* Brake disc */}
        <mesh geometry={discGeo} rotation={[0, 0, Math.PI / 2]} position={[side * rimDepth * 0.3, 0, 0]}>
          <meshStandardMaterial color="#555555" roughness={0.35} metalness={0.85} />
        </mesh>

        {/* Brake caliper */}
        <group position={[side * rimDepth * 0.25, rimRadius * 0.45, 0]}>
          <mesh>
            <boxGeometry args={[0.04, 0.065, 0.055]} />
            <meshStandardMaterial {...caliperProps('#cc1111')} />
          </mesh>
          {/* Caliper mounting bracket */}
          <mesh position={[0, -0.03, 0]}>
            <boxGeometry args={[0.03, 0.02, 0.06]} />
            <meshStandardMaterial color="#444" roughness={0.4} metalness={0.7} />
          </mesh>
        </group>

        {/* Lug nuts */}
        {Array.from({ length: lugCount }).map((_, i) => {
          const a = (i / lugCount) * Math.PI * 2;
          const lugR = rimRadius * 0.15;
          return (
            <mesh
              key={`lug-${i}`}
              position={[side * rimDepth * 0.26, Math.sin(a) * lugR, Math.cos(a) * lugR]}
            >
              <cylinderGeometry args={[0.006, 0.006, 0.012, 6]} />
              <meshStandardMaterial color="#888" roughness={0.15} metalness={0.9} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// %% Section 7: Main ProceduralCar component
// ---------------------------------------------------------------------------

export function ProceduralCar({ config, wheelStates, steeringAngle = 0, color, braking = false }: ProceduralCarProps) {
  const bodyGeo = useMemo(() => createLoftedBody(config), [config]);
  const windowGeo = useMemo(() => createWindowGeometry(config), [config]);
  const windowTrimGeo = useMemo(() => createWindowTrimGeometry(config), [config]);

  const carColor = color || config.color || '#C41E3A';
  const bodyType = (config.bodyType || 'sedan') as BodyType;
  const props = getProportions(bodyType);

  const length = config.dimensions.wheelbase * props.lengthFactor;
  const halfLength = length / 2;
  const hw = config.dimensions.trackWidth / 2;
  const hwb = config.dimensions.wheelbase / 2;
  const tireRadius = config.tires.front.radius;
  const halfWidth = (config.dimensions.trackWidth * props.bodyWidthScale) / 2;

  const hasWing = config.aero.downforceCoefficient > 0.2;

  const getWheelY = (index: number) => {
    if (wheelStates && wheelStates[index]) {
      return wheelStates[index].visualPosition.y;
    }
    return -0.15;
  };

  // Detail positions
  const headlightY = bodyType === 'supercar' ? 0.22 : bodyType === 'coupe' ? 0.28 : 0.32;
  const headlightZ = halfLength * 0.93;
  const headlightX = halfWidth * 0.58;

  const taillightY = bodyType === 'supercar' ? 0.24 : bodyType === 'coupe' ? 0.30 : 0.34;
  const taillightZ = -halfLength * 0.96;
  const taillightX = halfWidth * 0.55;

  const grilleY = bodyType === 'supercar' ? 0.14 : bodyType === 'coupe' ? 0.18 : 0.20;
  const grilleZ = halfLength * 0.97;
  const grilleW = halfWidth * 0.85;
  const grilleH = bodyType === 'supercar' ? 0.08 : 0.11;

  const mirrorY = props.bodyHeight * 0.95;
  const mirrorZ = halfLength * 0.18;

  const wingY = props.roofHeight + 0.08;
  const wingZ = -halfLength * 0.78;
  const wingWidth = config.dimensions.trackWidth * 0.75;

  const thirdBrakeY = props.roofHeight * 0.85;
  const thirdBrakeZ = -halfLength * 0.72;

  return (
    <group>
      {/* Body shell */}
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial {...bodyPaintProps(carColor)} />
      </mesh>

      {/* Windows */}
      <mesh geometry={windowGeo}>
        <meshPhysicalMaterial {...GLASS_PROPS} />
      </mesh>

      {/* Window chrome trim */}
      <mesh geometry={windowTrimGeo}>
        <meshStandardMaterial {...CHROME_PROPS} />
      </mesh>

      {/* Interior */}
      <InteriorSilhouette config={config} />

      {/* Headlights */}
      <Headlight position={[-headlightX, headlightY, headlightZ]} side={-1} bodyType={bodyType} />
      <Headlight position={[headlightX, headlightY, headlightZ]} side={1} bodyType={bodyType} />

      {/* Taillights */}
      <TailLightAssembly position={[-taillightX, taillightY, taillightZ]} side={-1} bodyType={bodyType} braking={braking} />
      <TailLightAssembly position={[taillightX, taillightY, taillightZ]} side={1} bodyType={bodyType} braking={braking} />

      {/* Third brake light */}
      <ThirdBrakeLight position={[0, thirdBrakeY, thirdBrakeZ]} width={halfWidth * 0.6} braking={braking} />

      {/* Grille */}
      <Grille width={grilleW} height={grilleH} position={[0, grilleY, grilleZ]} bodyType={bodyType} />

      {/* Front bumper */}
      <FrontBumper config={config} color={carColor} />

      {/* Rear bumper + diffuser */}
      <RearBumper config={config} color={carColor} />

      {/* Side skirts */}
      <SideSkirts config={config} color={carColor} />

      {/* Door seams */}
      {bodyType === 'sedan' ? (
        <>
          {/* Front door seam */}
          <mesh position={[-halfWidth * 0.985, props.bodyHeight * 0.6, halfLength * 0.08]}>
            <boxGeometry args={[0.003, props.bodyHeight * 0.45, length * 0.15]} />
            <meshStandardMaterial color="#111111" roughness={1} />
          </mesh>
          <mesh position={[halfWidth * 0.985, props.bodyHeight * 0.6, halfLength * 0.08]}>
            <boxGeometry args={[0.003, props.bodyHeight * 0.45, length * 0.15]} />
            <meshStandardMaterial color="#111111" roughness={1} />
          </mesh>
          {/* Rear door seam */}
          <mesh position={[-halfWidth * 0.985, props.bodyHeight * 0.6, -halfLength * 0.08]}>
            <boxGeometry args={[0.003, props.bodyHeight * 0.45, length * 0.15]} />
            <meshStandardMaterial color="#111111" roughness={1} />
          </mesh>
          <mesh position={[halfWidth * 0.985, props.bodyHeight * 0.6, -halfLength * 0.08]}>
            <boxGeometry args={[0.003, props.bodyHeight * 0.45, length * 0.15]} />
            <meshStandardMaterial color="#111111" roughness={1} />
          </mesh>
        </>
      ) : (
        <>
          {/* Single long door seam for coupe/supercar */}
          <mesh position={[-halfWidth * 0.985, props.bodyHeight * 0.6, halfLength * 0.02]}>
            <boxGeometry args={[0.003, props.bodyHeight * 0.45, length * 0.25]} />
            <meshStandardMaterial color="#111111" roughness={1} />
          </mesh>
          <mesh position={[halfWidth * 0.985, props.bodyHeight * 0.6, halfLength * 0.02]}>
            <boxGeometry args={[0.003, props.bodyHeight * 0.45, length * 0.25]} />
            <meshStandardMaterial color="#111111" roughness={1} />
          </mesh>
        </>
      )}

      {/* Door handles */}
      <DoorHandle position={[-halfWidth * 0.99, props.bodyHeight * 0.65, halfLength * 0.05]} side={-1} color={carColor} />
      <DoorHandle position={[halfWidth * 0.99, props.bodyHeight * 0.65, halfLength * 0.05]} side={1} color={carColor} />
      {bodyType === 'sedan' && (
        <>
          <DoorHandle position={[-halfWidth * 0.99, props.bodyHeight * 0.65, -halfLength * 0.12]} side={-1} color={carColor} />
          <DoorHandle position={[halfWidth * 0.99, props.bodyHeight * 0.65, -halfLength * 0.12]} side={1} color={carColor} />
        </>
      )}

      {/* Hood seam */}
      <mesh position={[0, props.bodyHeight * 0.88, halfLength * 0.30]}>
        <boxGeometry args={[halfWidth * 1.5, 0.003, 0.003]} />
        <meshStandardMaterial color="#111111" roughness={1} />
      </mesh>

      {/* Trunk seam */}
      <mesh position={[0, props.bodyHeight * 0.82, -halfLength * 0.30]}>
        <boxGeometry args={[halfWidth * 1.4, 0.003, 0.003]} />
        <meshStandardMaterial color="#111111" roughness={1} />
      </mesh>

      {/* Side mirrors */}
      <SideMirror position={[-halfWidth * 0.95, mirrorY, mirrorZ]} side={-1} color={carColor} />
      <SideMirror position={[halfWidth * 0.95, mirrorY, mirrorZ]} side={1} color={carColor} />

      {/* Spoiler / wing */}
      {hasWing && (
        <Spoiler width={wingWidth} position={[0, wingY, wingZ]} color={carColor} bodyType={bodyType} />
      )}

      {/* Side intakes (supercar only) */}
      {bodyType === 'supercar' && (
        <>
          <mesh position={[-halfWidth * 0.98, props.bodyHeight * 0.5, -halfLength * 0.05]}>
            <boxGeometry args={[0.008, 0.08, 0.18]} />
            <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
          </mesh>
          <mesh position={[halfWidth * 0.98, props.bodyHeight * 0.5, -halfLength * 0.05]}>
            <boxGeometry args={[0.008, 0.08, 0.18]} />
            <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
          </mesh>
        </>
      )}

      {/* Underbody */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[config.dimensions.trackWidth * 0.9, 0.01, length * 0.85]} />
        <meshStandardMaterial {...PLASTIC_PROPS} />
      </mesh>

      {/* Wheels */}
      <Wheel position={[-hw, getWheelY(0), hwb]} radius={tireRadius} steering={steeringAngle} side={-1} />
      <Wheel position={[hw, getWheelY(1), hwb]} radius={tireRadius} steering={steeringAngle} side={1} />
      <Wheel position={[-hw, getWheelY(2), -hwb]} radius={tireRadius} side={-1} />
      <Wheel position={[hw, getWheelY(3), -hwb]} radius={tireRadius} side={1} />
    </group>
  );
}
