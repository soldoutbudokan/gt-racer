import { useMemo } from 'react';
import * as THREE from 'three';
import type { VehicleConfig, WheelState } from '../../physics/types';

// ---------------------------------------------------------------------------
// Types & interfaces
// ---------------------------------------------------------------------------

interface ProceduralCarProps {
  config: VehicleConfig;
  wheelStates?: WheelState[];
  steeringAngle?: number;
  color?: string;
  braking?: boolean;
}

type BodyType = 'sedan' | 'coupe' | 'supercar';

/** 2-D point used for cross-section profiles */
interface Vec2 {
  x: number;
  y: number;
}

/**
 * A single cross-section along the car's length.
 * `t` is the normalised position along the car (0 = rear, 1 = front).
 * `profile` is the set of perimeter points (x,y) defining the shape at this
 * station, wound counter-clockwise starting from bottom-centre.
 */
interface Station {
  t: number;
  profile: Vec2[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIMETER_PTS = 32; // vertices per cross-section ring
const BODY_INSET = 0.02; // window inset from body surface (metres)

// ---------------------------------------------------------------------------
// Proportion tables – not derived from cgHeight
// ---------------------------------------------------------------------------

interface BodyProportions {
  lengthFactor: number;  // total length = wheelbase * factor
  bodyHeight: number;    // body (shoulder) height from ground in m
  roofHeight: number;    // total roof height from ground in m
  bodyWidthScale: number; // how much wider than trackWidth the body is
}

function getProportions(bodyType: BodyType): BodyProportions {
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

// ---------------------------------------------------------------------------
// Cross-section profile generator
//
// Builds a car-shaped ring of PERIMETER_PTS vertices given width/height params.
// The ring goes counter-clockwise starting from the bottom-centre (0,0).
//
// Regions (by vertex index bands):
//   0..7     flat bottom (undercarriage)
//   8..13    lower body sides (near-vertical, slight fender bulge)
//   14..17   shoulder (widest point at ~55 % height)
//   18..23   upper body (inward taper to roof edge)
//   24..31   roof (rounded top, narrower than shoulder)
// ---------------------------------------------------------------------------

function buildCrossSectionProfile(
  halfWidth: number,
  bodyH: number,
  roofH: number,
  roofHalfWidth: number,
  groundClearance: number,
  fenderBulge: number, // 0-1 amount of extra width at fender
): Vec2[] {
  // Key vertical heights
  const yGround = groundClearance;
  const yBody = bodyH;    // shoulder line ~ 55% visual height
  const yRoofEdge = bodyH + (roofH - bodyH) * 0.3; // where upper body meets roof
  const yRoof = roofH;    // apex

  // Key horizontal widths at each height
  const wBottom = halfWidth * 0.85;                       // undercarriage
  const wLowerBody = halfWidth * (1.0 + fenderBulge * 0.04); // slight fender bulge
  const wShoulder = halfWidth;                            // widest
  const wUpperBody = roofHalfWidth + (halfWidth - roofHalfWidth) * 0.4;
  const wRoofEdge = roofHalfWidth;
  const wRoofTop = roofHalfWidth * 0.85;

  // Intermediate vertical positions
  const lowerMidY = yGround + (yBody - yGround) * 0.33;
  const upperMidY = yGround + (yBody - yGround) * 0.67;
  const ub1 = yBody + (yRoofEdge - yBody) * 0.33;
  const ub2 = yBody + (yRoofEdge - yBody) * 0.67;

  // Build a half-profile of exactly 17 points (bottom-centre to top-centre).
  // Full ring = 2*17 - 2 = 32 = PERIMETER_PTS.
  const half: Vec2[] = [];

  // Flat bottom: 5 points from centre to corner
  half.push({ x: 0, y: yGround });                        // 0: bottom centre
  half.push({ x: wBottom * 0.25, y: yGround });            // 1
  half.push({ x: wBottom * 0.50, y: yGround });            // 2
  half.push({ x: wBottom * 0.75, y: yGround });            // 3
  half.push({ x: wBottom, y: yGround + 0.005 });           // 4: corner

  // Lower body sides: 3 points up
  half.push({ x: wLowerBody * 0.98, y: lowerMidY });       // 5
  half.push({ x: wLowerBody, y: upperMidY });              // 6

  // Shoulder: 1 point
  half.push({ x: wShoulder, y: yBody });                   // 7

  // Upper body taper: 3 points
  half.push({ x: wUpperBody + (wShoulder - wUpperBody) * 0.6, y: ub1 }); // 8
  half.push({ x: wUpperBody, y: ub2 });                    // 9
  half.push({ x: wRoofEdge, y: yRoofEdge });               // 10

  // Roof arc: 6 points from roof edge to top-centre
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    const rx = wRoofTop + (wRoofEdge - wRoofTop) * Math.cos(a);
    const ry = yRoofEdge + (yRoof - yRoofEdge) * Math.sin(a);
    half.push({ x: rx, y: ry });                           // 11..16
  }
  half[16] = { x: 0, y: yRoof }; // exact top-centre       // 16

  // Total half points: 17 (indices 0..16)
  // Full ring: right side 0..16, left side mirror 15..1 => 17 + 15 = 32
  const ring: Vec2[] = [];
  for (let i = 0; i <= 16; i++) {
    ring.push(half[i]);
  }
  for (let i = 15; i >= 1; i--) {
    ring.push({ x: -half[i].x, y: half[i].y });
  }
  // ring.length = 17 + 15 = 32 === PERIMETER_PTS

  return ring;
}

// ---------------------------------------------------------------------------
// Station (cross-section) definitions along the car length
// 20 stations for smooth lengthwise curves
// ---------------------------------------------------------------------------

interface StationSpec {
  t: number;              // 0=rear, 1=front
  widthScale: number;     // multiplier on half-width
  bodyHeightScale: number; // multiplier on bodyHeight
  roofHeightScale: number; // multiplier on roofHeight
  roofWidthScale: number; // multiplier on roof half-width
  groundClearance: number; // ground clearance in metres
  fenderBulge: number;    // 0-1
}

function getStationSpecs(bodyType: BodyType): StationSpec[] {
  switch (bodyType) {
    case 'supercar':
      return [
        // rear bumper lip
        { t: 0.000, widthScale: 0.55, bodyHeightScale: 0.50, roofHeightScale: 0.30, roofWidthScale: 0.35, groundClearance: 0.06, fenderBulge: 0.0 },
        { t: 0.030, widthScale: 0.68, bodyHeightScale: 0.65, roofHeightScale: 0.42, roofWidthScale: 0.48, groundClearance: 0.06, fenderBulge: 0.0 },
        // rear end shape
        { t: 0.080, widthScale: 0.82, bodyHeightScale: 0.82, roofHeightScale: 0.58, roofWidthScale: 0.62, groundClearance: 0.06, fenderBulge: 0.1 },
        // rear wheel fender peak
        { t: 0.150, widthScale: 0.96, bodyHeightScale: 0.92, roofHeightScale: 0.78, roofWidthScale: 0.75, groundClearance: 0.06, fenderBulge: 0.8 },
        { t: 0.210, widthScale: 1.00, bodyHeightScale: 0.96, roofHeightScale: 0.88, roofWidthScale: 0.82, groundClearance: 0.06, fenderBulge: 0.5 },
        // C-pillar
        { t: 0.280, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 0.95, roofWidthScale: 0.86, groundClearance: 0.06, fenderBulge: 0.2 },
        // trunk break
        { t: 0.330, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 0.98, roofWidthScale: 0.88, groundClearance: 0.06, fenderBulge: 0.1 },
        // B-pillar
        { t: 0.400, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 1.00, roofWidthScale: 0.90, groundClearance: 0.06, fenderBulge: 0.0 },
        { t: 0.470, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 1.00, roofWidthScale: 0.90, groundClearance: 0.06, fenderBulge: 0.0 },
        // A-pillar
        { t: 0.540, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 0.98, roofWidthScale: 0.88, groundClearance: 0.06, fenderBulge: 0.0 },
        { t: 0.600, widthScale: 0.99, bodyHeightScale: 0.98, roofHeightScale: 0.92, roofWidthScale: 0.84, groundClearance: 0.06, fenderBulge: 0.1 },
        // front wheel fender peak
        { t: 0.680, widthScale: 0.97, bodyHeightScale: 0.94, roofHeightScale: 0.80, roofWidthScale: 0.76, groundClearance: 0.06, fenderBulge: 0.7 },
        { t: 0.740, widthScale: 0.94, bodyHeightScale: 0.88, roofHeightScale: 0.65, roofWidthScale: 0.65, groundClearance: 0.06, fenderBulge: 0.6 },
        { t: 0.800, widthScale: 0.90, bodyHeightScale: 0.80, roofHeightScale: 0.52, roofWidthScale: 0.55, groundClearance: 0.06, fenderBulge: 0.3 },
        // nose
        { t: 0.860, widthScale: 0.84, bodyHeightScale: 0.70, roofHeightScale: 0.42, roofWidthScale: 0.45, groundClearance: 0.06, fenderBulge: 0.1 },
        { t: 0.910, widthScale: 0.76, bodyHeightScale: 0.60, roofHeightScale: 0.35, roofWidthScale: 0.38, groundClearance: 0.06, fenderBulge: 0.0 },
        { t: 0.945, widthScale: 0.66, bodyHeightScale: 0.52, roofHeightScale: 0.30, roofWidthScale: 0.32, groundClearance: 0.06, fenderBulge: 0.0 },
        // front bumper / air dam
        { t: 0.970, widthScale: 0.58, bodyHeightScale: 0.45, roofHeightScale: 0.26, roofWidthScale: 0.28, groundClearance: 0.05, fenderBulge: 0.0 },
        { t: 0.990, widthScale: 0.50, bodyHeightScale: 0.38, roofHeightScale: 0.22, roofWidthScale: 0.24, groundClearance: 0.05, fenderBulge: 0.0 },
        { t: 1.000, widthScale: 0.45, bodyHeightScale: 0.34, roofHeightScale: 0.20, roofWidthScale: 0.20, groundClearance: 0.05, fenderBulge: 0.0 },
      ];

    case 'coupe':
      return [
        { t: 0.000, widthScale: 0.50, bodyHeightScale: 0.48, roofHeightScale: 0.30, roofWidthScale: 0.32, groundClearance: 0.07, fenderBulge: 0.0 },
        { t: 0.030, widthScale: 0.65, bodyHeightScale: 0.62, roofHeightScale: 0.44, roofWidthScale: 0.45, groundClearance: 0.07, fenderBulge: 0.0 },
        { t: 0.075, widthScale: 0.80, bodyHeightScale: 0.78, roofHeightScale: 0.60, roofWidthScale: 0.60, groundClearance: 0.07, fenderBulge: 0.1 },
        { t: 0.140, widthScale: 0.94, bodyHeightScale: 0.92, roofHeightScale: 0.80, roofWidthScale: 0.74, groundClearance: 0.07, fenderBulge: 0.7 },
        { t: 0.200, widthScale: 1.00, bodyHeightScale: 0.97, roofHeightScale: 0.90, roofWidthScale: 0.80, groundClearance: 0.07, fenderBulge: 0.4 },
        { t: 0.270, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 0.96, roofWidthScale: 0.85, groundClearance: 0.07, fenderBulge: 0.1 },
        // C-pillar / trunk break
        { t: 0.330, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 1.00, roofWidthScale: 0.88, groundClearance: 0.07, fenderBulge: 0.0 },
        // B-pillar
        { t: 0.400, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 1.00, roofWidthScale: 0.90, groundClearance: 0.07, fenderBulge: 0.0 },
        { t: 0.470, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 1.00, roofWidthScale: 0.90, groundClearance: 0.07, fenderBulge: 0.0 },
        // A-pillar
        { t: 0.540, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 0.97, roofWidthScale: 0.87, groundClearance: 0.07, fenderBulge: 0.0 },
        { t: 0.610, widthScale: 0.99, bodyHeightScale: 0.96, roofHeightScale: 0.85, roofWidthScale: 0.78, groundClearance: 0.07, fenderBulge: 0.1 },
        // front wheel fender peak
        { t: 0.690, widthScale: 0.96, bodyHeightScale: 0.90, roofHeightScale: 0.68, roofWidthScale: 0.65, groundClearance: 0.07, fenderBulge: 0.6 },
        { t: 0.750, widthScale: 0.92, bodyHeightScale: 0.84, roofHeightScale: 0.55, roofWidthScale: 0.55, groundClearance: 0.07, fenderBulge: 0.5 },
        { t: 0.810, widthScale: 0.86, bodyHeightScale: 0.75, roofHeightScale: 0.44, roofWidthScale: 0.46, groundClearance: 0.07, fenderBulge: 0.2 },
        // hood / nose
        { t: 0.865, widthScale: 0.78, bodyHeightScale: 0.65, roofHeightScale: 0.36, roofWidthScale: 0.38, groundClearance: 0.07, fenderBulge: 0.0 },
        { t: 0.910, widthScale: 0.70, bodyHeightScale: 0.56, roofHeightScale: 0.30, roofWidthScale: 0.32, groundClearance: 0.07, fenderBulge: 0.0 },
        { t: 0.945, widthScale: 0.60, bodyHeightScale: 0.48, roofHeightScale: 0.26, roofWidthScale: 0.28, groundClearance: 0.06, fenderBulge: 0.0 },
        // bumper
        { t: 0.970, widthScale: 0.52, bodyHeightScale: 0.42, roofHeightScale: 0.23, roofWidthScale: 0.24, groundClearance: 0.06, fenderBulge: 0.0 },
        { t: 0.990, widthScale: 0.46, bodyHeightScale: 0.36, roofHeightScale: 0.20, roofWidthScale: 0.20, groundClearance: 0.06, fenderBulge: 0.0 },
        { t: 1.000, widthScale: 0.42, bodyHeightScale: 0.32, roofHeightScale: 0.18, roofWidthScale: 0.18, groundClearance: 0.06, fenderBulge: 0.0 },
      ];

    case 'sedan':
    default:
      return [
        { t: 0.000, widthScale: 0.48, bodyHeightScale: 0.46, roofHeightScale: 0.28, roofWidthScale: 0.30, groundClearance: 0.08, fenderBulge: 0.0 },
        { t: 0.030, widthScale: 0.62, bodyHeightScale: 0.60, roofHeightScale: 0.42, roofWidthScale: 0.44, groundClearance: 0.08, fenderBulge: 0.0 },
        { t: 0.075, widthScale: 0.78, bodyHeightScale: 0.78, roofHeightScale: 0.62, roofWidthScale: 0.60, groundClearance: 0.08, fenderBulge: 0.1 },
        // rear wheel fender
        { t: 0.140, widthScale: 0.92, bodyHeightScale: 0.90, roofHeightScale: 0.80, roofWidthScale: 0.73, groundClearance: 0.08, fenderBulge: 0.6 },
        { t: 0.200, widthScale: 1.00, bodyHeightScale: 0.96, roofHeightScale: 0.90, roofWidthScale: 0.80, groundClearance: 0.08, fenderBulge: 0.3 },
        // trunk break
        { t: 0.260, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 0.96, roofWidthScale: 0.85, groundClearance: 0.08, fenderBulge: 0.1 },
        // C-pillar
        { t: 0.320, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 1.00, roofWidthScale: 0.88, groundClearance: 0.08, fenderBulge: 0.0 },
        // B-pillar
        { t: 0.390, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 1.00, roofWidthScale: 0.90, groundClearance: 0.08, fenderBulge: 0.0 },
        { t: 0.450, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 1.00, roofWidthScale: 0.90, groundClearance: 0.08, fenderBulge: 0.0 },
        { t: 0.510, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 1.00, roofWidthScale: 0.90, groundClearance: 0.08, fenderBulge: 0.0 },
        // A-pillar
        { t: 0.570, widthScale: 1.00, bodyHeightScale: 1.00, roofHeightScale: 0.96, roofWidthScale: 0.86, groundClearance: 0.08, fenderBulge: 0.0 },
        { t: 0.630, widthScale: 0.99, bodyHeightScale: 0.96, roofHeightScale: 0.82, roofWidthScale: 0.76, groundClearance: 0.08, fenderBulge: 0.1 },
        // front wheel fender
        { t: 0.700, widthScale: 0.96, bodyHeightScale: 0.90, roofHeightScale: 0.65, roofWidthScale: 0.62, groundClearance: 0.08, fenderBulge: 0.5 },
        { t: 0.760, widthScale: 0.92, bodyHeightScale: 0.82, roofHeightScale: 0.50, roofWidthScale: 0.52, groundClearance: 0.08, fenderBulge: 0.4 },
        // hood
        { t: 0.820, widthScale: 0.86, bodyHeightScale: 0.72, roofHeightScale: 0.40, roofWidthScale: 0.42, groundClearance: 0.08, fenderBulge: 0.1 },
        { t: 0.870, widthScale: 0.78, bodyHeightScale: 0.62, roofHeightScale: 0.33, roofWidthScale: 0.35, groundClearance: 0.07, fenderBulge: 0.0 },
        { t: 0.920, widthScale: 0.68, bodyHeightScale: 0.52, roofHeightScale: 0.28, roofWidthScale: 0.30, groundClearance: 0.07, fenderBulge: 0.0 },
        // bumper / air dam
        { t: 0.955, widthScale: 0.58, bodyHeightScale: 0.44, roofHeightScale: 0.24, roofWidthScale: 0.26, groundClearance: 0.07, fenderBulge: 0.0 },
        { t: 0.985, widthScale: 0.50, bodyHeightScale: 0.38, roofHeightScale: 0.20, roofWidthScale: 0.22, groundClearance: 0.07, fenderBulge: 0.0 },
        { t: 1.000, widthScale: 0.45, bodyHeightScale: 0.34, roofHeightScale: 0.18, roofWidthScale: 0.18, groundClearance: 0.07, fenderBulge: 0.0 },
      ];
  }
}

// ---------------------------------------------------------------------------
// Build the full set of stations (each with its profile ring)
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

  for (const s of specs) {
    const hw = halfWidth * s.widthScale;
    const bh = bodyHeight * s.bodyHeightScale;
    const rh = roofHeight * s.roofHeightScale;
    const rhw = roofHalfWidth * s.roofWidthScale;
    const gc = s.groundClearance;
    const fb = s.fenderBulge;

    // Ensure roof height is at least body height
    const effectiveRoofH = Math.max(rh, bh + 0.01);
    const profile = buildCrossSectionProfile(hw, bh + gc, effectiveRoofH + gc, rhw, gc, fb);
    stations.push({ t: s.t, profile });
  }

  return stations;
}

// ---------------------------------------------------------------------------
// Lofted body geometry
// ---------------------------------------------------------------------------

function createLoftedBody(config: VehicleConfig): THREE.BufferGeometry {
  const bodyType = (config.bodyType || 'sedan') as BodyType;
  const props = getProportions(bodyType);
  const length = config.dimensions.wheelbase * props.lengthFactor;
  const halfWidth = (config.dimensions.trackWidth * props.bodyWidthScale) / 2;
  const bodyHeight = props.bodyHeight;
  const roofHeight = props.roofHeight;
  const roofHalfWidth = halfWidth * 0.75; // roof is ~75% as wide as body

  const stations = buildStations(bodyType, halfWidth, bodyHeight, roofHeight, roofHalfWidth);
  const halfLength = length / 2;
  const nStations = stations.length;
  const nPeri = PERIMETER_PTS;

  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // --- Vertex generation ---
  for (let s = 0; s < nStations; s++) {
    const station = stations[s];
    const z = station.t * length - halfLength; // centre the car
    const profile = station.profile;

    for (let p = 0; p < nPeri; p++) {
      const pt = profile[p];
      vertices.push(pt.x, pt.y, z);

      // Approximate outward-facing normal from adjacent perimeter points
      const prev = profile[(p - 1 + nPeri) % nPeri];
      const next = profile[(p + 1) % nPeri];
      // Tangent along perimeter
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      // Normal = perpendicular in the cross-section plane (outward)
      let nx = ty;
      let ny = -tx;
      const len = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= len;
      ny /= len;
      normals.push(nx, ny, 0);
    }
  }

  // --- Index generation (quad strips between adjacent stations) ---
  for (let s = 0; s < nStations - 1; s++) {
    for (let p = 0; p < nPeri; p++) {
      const curr = s * nPeri + p;
      const next = s * nPeri + ((p + 1) % nPeri);
      const currNext = (s + 1) * nPeri + p;
      const nextNext = (s + 1) * nPeri + ((p + 1) % nPeri);
      indices.push(curr, currNext, next);
      indices.push(next, currNext, nextNext);
    }
  }

  // --- Cap rear ---
  const rearCenterIdx = vertices.length / 3;
  const rearStation = stations[0];
  // Centre of rear cap at average height
  let rearAvgY = 0;
  for (const pt of rearStation.profile) rearAvgY += pt.y;
  rearAvgY /= rearStation.profile.length;
  vertices.push(0, rearAvgY, -halfLength);
  normals.push(0, 0, -1);
  for (let p = 0; p < nPeri; p++) {
    const next = (p + 1) % nPeri;
    indices.push(rearCenterIdx, next, p);
  }

  // --- Cap front ---
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

// ---------------------------------------------------------------------------
// Window geometry – side, windshield, rear window
// All traced from body surface, inset by BODY_INSET
// ---------------------------------------------------------------------------

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

  // A-pillar / C-pillar t ranges
  const windowStartT = bodyType === 'supercar' ? 0.32 : bodyType === 'coupe' ? 0.30 : 0.28;
  const windowEndT = bodyType === 'supercar' ? 0.58 : bodyType === 'coupe' ? 0.56 : 0.58;

  // Find stations within window range and interpolate if needed
  const windowStations: { z: number; profile: Vec2[] }[] = [];
  for (const st of stations) {
    if (st.t >= windowStartT - 0.01 && st.t <= windowEndT + 0.01) {
      windowStations.push({ z: st.t * length - halfLength, profile: st.profile });
    }
  }

  if (windowStations.length < 2) return new THREE.BufferGeometry();

  // The shoulder line is at perimeter index 7 (widest point).
  // The roof edge is at perimeter index 10.
  // Window belt line ~ between index 7 and 8.
  // Roof line ~ index 10..11.
  const beltIdx = 7;  // shoulder – bottom of window
  const roofIdx = 11; // just above roof edge – top of window

  // --- Side windows (left and right) ---
  for (const side of [-1, 1]) {
    const baseVtx = vertices.length / 3;
    const nSteps = windowStations.length;

    for (let i = 0; i < nSteps; i++) {
      const ws = windowStations[i];
      const z = ws.z;
      const profile = ws.profile;

      // Belt line point (bottom of window)
      let beltPt: Vec2;
      let roofPt: Vec2;

      if (side > 0) {
        // Right side: indices 0..16 are right half
        beltPt = profile[beltIdx];
        roofPt = profile[roofIdx];
      } else {
        // Left side: mirror indices. Index 7 on left = PERIMETER_PTS - 7 = 25
        const leftBeltIdx = PERIMETER_PTS - beltIdx;
        const leftRoofIdx = PERIMETER_PTS - roofIdx;
        beltPt = profile[leftBeltIdx];
        roofPt = profile[leftRoofIdx];
      }

      // Inset slightly toward centre
      const insetDir = side > 0 ? -BODY_INSET : BODY_INSET;
      vertices.push(beltPt.x + insetDir, beltPt.y + 0.01, z);
      vertices.push(roofPt.x + insetDir, roofPt.y - 0.01, z);
    }

    // Triangulate strip
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

  // --- Windshield (front window) ---
  // Take the station closest to the A-pillar and the one ~3 stations forward
  // and create a quad derived from the body curve.
  {
    const aPillarIdx = windowStations.length - 1;
    const aStation = windowStations[aPillarIdx];
    // Find the next two body stations past the window range for windshield shape
    const windshieldStations: { z: number; profile: Vec2[] }[] = [];
    for (const st of stations) {
      const zt = st.t;
      if (zt > windowEndT && zt < windowEndT + 0.15) {
        windshieldStations.push({ z: st.t * length - halfLength, profile: st.profile });
      }
    }
    if (windshieldStations.length >= 1) {
      const topStation = aStation;
      const bottomStation = windshieldStations[windshieldStations.length - 1];
      const baseVtx = vertices.length / 3;

      // Four corners: bottom-left, bottom-right, top-left, top-right
      const topRoofPtR = topStation.profile[roofIdx];
      const topRoofPtL = topStation.profile[PERIMETER_PTS - roofIdx];
      const botBeltPtR = bottomStation.profile[beltIdx];
      const botBeltPtL = bottomStation.profile[PERIMETER_PTS - beltIdx];

      // Windshield vertices (inset slightly)
      vertices.push(botBeltPtL.x + BODY_INSET, botBeltPtL.y + 0.01, bottomStation.z);
      vertices.push(botBeltPtR.x - BODY_INSET, botBeltPtR.y + 0.01, bottomStation.z);
      vertices.push(topRoofPtL.x + BODY_INSET, topRoofPtL.y - 0.01, topStation.z);
      vertices.push(topRoofPtR.x - BODY_INSET, topRoofPtR.y - 0.01, topStation.z);

      // Add intermediate rows for curvature
      const midStations = windshieldStations.slice(0, -1);
      const allRows: number[] = [baseVtx, baseVtx + 1]; // bottom pair
      if (midStations.length > 0) {
        for (const ms of midStations) {
          const mBeltR = ms.profile[Math.min(beltIdx + 1, 9)];
          const mBeltL = ms.profile[PERIMETER_PTS - Math.min(beltIdx + 1, 9)];
          const midBase = vertices.length / 3;
          vertices.push(mBeltL.x + BODY_INSET, mBeltL.y, ms.z);
          vertices.push(mBeltR.x - BODY_INSET, mBeltR.y, ms.z);
          allRows.push(midBase, midBase + 1);
        }
      }
      allRows.push(baseVtx + 2, baseVtx + 3); // top pair

      // Triangulate
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

  // --- Rear window ---
  {
    const cPillarStation = windowStations[0];
    const rearWindowStations: { z: number; profile: Vec2[] }[] = [];
    for (const st of stations) {
      const zt = st.t;
      if (zt < windowStartT && zt > windowStartT - 0.15) {
        rearWindowStations.push({ z: st.t * length - halfLength, profile: st.profile });
      }
    }
    if (rearWindowStations.length >= 1) {
      const topStation = cPillarStation;
      const bottomStation = rearWindowStations[0]; // closest to window
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

// ---------------------------------------------------------------------------
// Headlight geometry – rounded rectangle with lens depth
// ---------------------------------------------------------------------------

function createHeadlightGeometry(
  width: number,
  height: number,
  depth: number,
  cornerRadius: number,
): THREE.BufferGeometry {
  const segments = 4; // corner subdivision
  const shape = new THREE.Shape();

  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(cornerRadius, hw, hh);

  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: segments,
  };

  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

// ---------------------------------------------------------------------------
// Grille geometry – multiple horizontal slats
// ---------------------------------------------------------------------------

function GrilleSlats({ width, height, slotCount, position }: {
  width: number;
  height: number;
  slotCount: number;
  position: [number, number, number];
}) {
  const slats = [];
  const slatHeight = height / (slotCount * 2 - 1);
  const startY = -height / 2 + slatHeight / 2;

  for (let i = 0; i < slotCount; i++) {
    const y = startY + i * slatHeight * 2;
    slats.push(
      <mesh key={`slat-${i}`} position={[0, y, 0]}>
        <boxGeometry args={[width * 0.95, slatHeight * 0.6, 0.01]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.4} />
      </mesh>
    );
    // Gap between slats (dark recessed)
    if (i < slotCount - 1) {
      slats.push(
        <mesh key={`gap-${i}`} position={[0, y + slatHeight, -0.005]}>
          <boxGeometry args={[width * 0.90, slatHeight * 0.4, 0.005]} />
          <meshStandardMaterial color="#050505" roughness={1.0} metalness={0.0} />
        </mesh>
      );
    }
  }

  return (
    <group position={position}>
      {/* Surround frame */}
      <mesh position={[0, 0, -0.005]}>
        <boxGeometry args={[width, height, 0.01]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} metalness={0.3} />
      </mesh>
      {slats}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Mirror component – organic teardrop shape
// ---------------------------------------------------------------------------

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
      {/* Mounting arm – tapered */}
      <mesh position={[side * armLength * 0.4, 0, 0]} rotation={[0, 0, side * 0.15]}>
        <boxGeometry args={[armLength, 0.022, 0.025]} />
        <meshPhysicalMaterial color={color} metalness={0.9} roughness={0.15} clearcoat={1.0} />
      </mesh>
      {/* Mirror housing – elongated egg shape using scaled sphere */}
      <mesh position={[side * armLength, 0, -0.005]} scale={[1, mirrorHeight / mirrorWidth, mirrorDepth / mirrorWidth]}>
        <sphereGeometry args={[mirrorWidth * 0.55, 12, 8]} />
        <meshPhysicalMaterial color={color} metalness={0.9} roughness={0.15} clearcoat={1.0} />
      </mesh>
      {/* Mirror face */}
      <mesh position={[side * (armLength + 0.002), 0, -0.01]} rotation={[0, side * 0.1, 0]}>
        <planeGeometry args={[mirrorWidth * 0.7, mirrorHeight * 0.7]} />
        <meshStandardMaterial color="#333" roughness={0.0} metalness={1.0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Spoiler with airfoil cross-section and endplates
// ---------------------------------------------------------------------------

function Spoiler({ width, position, color }: {
  width: number;
  position: [number, number, number];
  color: string;
}) {
  // Airfoil cross-section using Shape
  const airfoilShape = useMemo(() => {
    const shape = new THREE.Shape();
    const chord = 0.10; // chord length
    const thickness = 0.025; // max thickness
    // Simple NACA-like airfoil: upper surface
    shape.moveTo(0, 0);
    shape.bezierCurveTo(chord * 0.1, thickness * 0.8, chord * 0.3, thickness, chord * 0.5, thickness * 0.9);
    shape.bezierCurveTo(chord * 0.7, thickness * 0.7, chord * 0.9, thickness * 0.2, chord, 0);
    // lower surface (slight camber)
    shape.bezierCurveTo(chord * 0.9, -thickness * 0.1, chord * 0.5, -thickness * 0.15, chord * 0.2, -thickness * 0.1);
    shape.bezierCurveTo(chord * 0.05, -thickness * 0.05, 0, 0, 0, 0);
    return shape;
  }, []);

  const wingGeo = useMemo(() => {
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: width,
      bevelEnabled: false,
      curveSegments: 8,
    };
    const geo = new THREE.ExtrudeGeometry(airfoilShape, extrudeSettings);
    // Centre the wing
    geo.translate(-0.05, 0, -width / 2);
    return geo;
  }, [airfoilShape, width]);

  const endplateH = 0.06;
  const endplateD = 0.12;

  return (
    <group position={position}>
      {/* Wing element */}
      <mesh geometry={wingGeo} rotation={[0.05, 0, 0]} castShadow>
        <meshPhysicalMaterial color={color} metalness={0.9} roughness={0.15} clearcoat={1.0} />
      </mesh>
      {/* Left endplate */}
      <mesh position={[0, -endplateH * 0.3, -width / 2]}>
        <boxGeometry args={[endplateD, endplateH, 0.008]} />
        <meshPhysicalMaterial color={color} metalness={0.9} roughness={0.15} clearcoat={1.0} />
      </mesh>
      {/* Right endplate */}
      <mesh position={[0, -endplateH * 0.3, width / 2]}>
        <boxGeometry args={[endplateD, endplateH, 0.008]} />
        <meshPhysicalMaterial color={color} metalness={0.9} roughness={0.15} clearcoat={1.0} />
      </mesh>
      {/* Support pylons */}
      <mesh position={[0.01, -0.12, -width * 0.3]}>
        <boxGeometry args={[0.015, 0.22, 0.02]} />
        <meshPhysicalMaterial color={color} metalness={0.9} roughness={0.15} clearcoat={1.0} />
      </mesh>
      <mesh position={[0.01, -0.12, width * 0.3]}>
        <boxGeometry args={[0.015, 0.22, 0.02]} />
        <meshPhysicalMaterial color={color} metalness={0.9} roughness={0.15} clearcoat={1.0} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Wheel – 5 double-spoke design with brake caliper
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
  const spokeCount = 5;

  const spokeGeo = useMemo(() => {
    // Each "double spoke" is two parallel bars
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const idxs: number[] = [];

    const innerR = rimRadius * 0.25;
    const outerR = rimRadius * 0.92;
    const spokeW = 0.018;
    const spokeD = rimDepth * 0.35;
    const gap = 0.012; // gap between the two bars of a double-spoke

    for (let s = 0; s < spokeCount; s++) {
      const angle = (s / spokeCount) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const cos90 = Math.cos(angle + Math.PI / 2);
      const sin90 = Math.sin(angle + Math.PI / 2);

      for (const offset of [-gap / 2, gap / 2]) {
        // Offset perpendicular to spoke direction
        const ox = cos90 * offset;
        const oy = sin90 * offset;

        const baseIdx = verts.length / 3;

        // Inner end (4 verts for a box cross-section)
        const ix = cos * innerR + ox;
        const iy = sin * innerR + oy;
        verts.push(ix - cos90 * spokeW, iy - sin90 * spokeW, -spokeD / 2);
        verts.push(ix + cos90 * spokeW, iy + sin90 * spokeW, -spokeD / 2);
        verts.push(ix + cos90 * spokeW, iy + sin90 * spokeW, spokeD / 2);
        verts.push(ix - cos90 * spokeW, iy - sin90 * spokeW, spokeD / 2);

        // Outer end
        const oxe = cos * outerR + ox;
        const oye = sin * outerR + oy;
        verts.push(oxe - cos90 * spokeW, oye - sin90 * spokeW, -spokeD / 2);
        verts.push(oxe + cos90 * spokeW, oye + sin90 * spokeW, -spokeD / 2);
        verts.push(oxe + cos90 * spokeW, oye + sin90 * spokeW, spokeD / 2);
        verts.push(oxe - cos90 * spokeW, oye - sin90 * spokeW, spokeD / 2);

        // 6 faces of the box (2 tris each = 12 tris per spoke bar)
        const b = baseIdx;
        // Front face
        idxs.push(b, b + 1, b + 5); idxs.push(b, b + 5, b + 4);
        // Back face
        idxs.push(b + 3, b + 7, b + 6); idxs.push(b + 3, b + 6, b + 2);
        // Top face
        idxs.push(b + 1, b + 2, b + 6); idxs.push(b + 1, b + 6, b + 5);
        // Bottom face
        idxs.push(b, b + 4, b + 7); idxs.push(b, b + 7, b + 3);
        // Inner cap
        idxs.push(b, b + 3, b + 2); idxs.push(b, b + 2, b + 1);
        // Outer cap
        idxs.push(b + 4, b + 5, b + 6); idxs.push(b + 4, b + 6, b + 7);
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idxs);
    geo.computeVertexNormals();
    return geo;
  }, [rimRadius, rimDepth, spokeCount]);

  return (
    <group position={position} rotation={[0, steering, 0]}>
      <group rotation={[spin, 0, 0]}>
        {/* Tire – torus */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[radius, tireWidth, 16, 32]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.92} metalness={0.0} />
        </mesh>

        {/* Rim barrel (outer ring) */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[rimRadius, rimRadius, rimDepth, 32]} />
          <meshStandardMaterial color="#b8b8b8" roughness={0.08} metalness={0.95} />
        </mesh>

        {/* Rim centre hub */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[rimRadius * 0.22, rimRadius * 0.22, rimDepth * 0.5, 16]} />
          <meshStandardMaterial color="#a0a0a0" roughness={0.1} metalness={0.95} />
        </mesh>

        {/* Double spokes */}
        <mesh geometry={spokeGeo} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#d0d0d0" roughness={0.08} metalness={0.95} />
        </mesh>

        {/* Brake disc */}
        <mesh rotation={[0, 0, Math.PI / 2]} position={[side * rimDepth * 0.3, 0, 0]}>
          <cylinderGeometry args={[rimRadius * 0.75, rimRadius * 0.75, 0.012, 28]} />
          <meshStandardMaterial color="#444444" roughness={0.35} metalness={0.85} />
        </mesh>

        {/* Brake caliper (red block behind spokes) */}
        <mesh position={[side * rimDepth * 0.25, rimRadius * 0.45, 0]}>
          <boxGeometry args={[0.035, 0.06, 0.05]} />
          <meshStandardMaterial color="#cc1111" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Taillight geometry – wider wrap-around shape
// ---------------------------------------------------------------------------

function TailLight({ position, width, height, wrapAngle, braking }: {
  position: [number, number, number];
  width: number;
  height: number;
  wrapAngle: number; // how far the light wraps around the body corner (radians)
  braking: boolean;
}) {
  const segments = 6;
  const depth = 0.03;
  const intensity = braking ? 4.0 : 1.5;

  const taillightGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const hw = width / 2;
    const hh = height / 2;

    // Slightly rounded rectangle that tapers on the wrap side
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw * 0.8, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh * 0.6);
    shape.lineTo(hw, hh * 0.6);
    shape.quadraticCurveTo(hw, hh, hw * 0.8, hh);
    shape.lineTo(-hw, hh);
    shape.lineTo(-hw, -hh);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 1,
      curveSegments: segments,
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [width, height, depth, segments]);

  return (
    <mesh geometry={taillightGeo} position={position} rotation={[0, Math.PI, 0]}>
      <meshStandardMaterial
        color="#ff0000"
        emissive="#ff0000"
        emissiveIntensity={intensity}
        roughness={0.2}
        metalness={0.1}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Main ProceduralCar component
// ---------------------------------------------------------------------------

export function ProceduralCar({ config, wheelStates, steeringAngle = 0, color, braking = false }: ProceduralCarProps) {
  const bodyGeo = useMemo(() => createLoftedBody(config), [config]);
  const windowGeo = useMemo(() => createWindowGeometry(config), [config]);

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

  const headlightGeoL = useMemo(
    () => createHeadlightGeometry(0.18, 0.065, 0.035, 0.015),
    [],
  );
  const headlightGeoR = useMemo(
    () => createHeadlightGeometry(0.18, 0.065, 0.035, 0.015),
    [],
  );

  const getWheelY = (index: number) => {
    if (wheelStates && wheelStates[index]) {
      return wheelStates[index].visualPosition.y;
    }
    return -0.15;
  };

  // Positions for details – proportional to body dimensions
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

  return (
    <group>
      {/* Car body */}
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={carColor}
          metalness={0.9}
          roughness={0.15}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          envMapIntensity={1.0}
        />
      </mesh>

      {/* Windows */}
      <mesh geometry={windowGeo}>
        <meshPhysicalMaterial
          color="#88ccff"
          transparent
          opacity={0.3}
          metalness={0.1}
          roughness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Headlights – rounded rectangle with depth */}
      <mesh
        geometry={headlightGeoL}
        position={[-headlightX, headlightY, headlightZ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <meshStandardMaterial color="#ffffff" emissive="#ffffcc" emissiveIntensity={2.0} roughness={0.1} metalness={0.2} />
      </mesh>
      <mesh
        geometry={headlightGeoR}
        position={[headlightX, headlightY, headlightZ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <meshStandardMaterial color="#ffffff" emissive="#ffffcc" emissiveIntensity={2.0} roughness={0.1} metalness={0.2} />
      </mesh>

      {/* Headlight lens covers (glass effect) */}
      <mesh position={[-headlightX, headlightY, headlightZ + 0.02]}>
        <planeGeometry args={[0.17, 0.06]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.15} roughness={0.0} metalness={0.0} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[headlightX, headlightY, headlightZ + 0.02]}>
        <planeGeometry args={[0.17, 0.06]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.15} roughness={0.0} metalness={0.0} side={THREE.DoubleSide} />
      </mesh>

      {/* Tail lights – wrap-around shape */}
      <TailLight
        position={[-taillightX, taillightY, taillightZ]}
        width={0.24}
        height={0.065}
        wrapAngle={0.3}
        braking={braking}
      />
      <TailLight
        position={[taillightX, taillightY, taillightZ]}
        width={0.24}
        height={0.065}
        wrapAngle={0.3}
        braking={braking}
      />

      {/* Front grille – horizontal slats */}
      <GrilleSlats
        width={grilleW}
        height={grilleH}
        slotCount={bodyType === 'supercar' ? 3 : 5}
        position={[0, grilleY, grilleZ]}
      />

      {/* Door seam lines */}
      <mesh position={[-halfWidth * 0.985, props.bodyHeight * 0.6, halfLength * 0.02]}>
        <boxGeometry args={[0.003, props.bodyHeight * 0.45, length * 0.22]} />
        <meshStandardMaterial color="#111111" roughness={1} />
      </mesh>
      <mesh position={[halfWidth * 0.985, props.bodyHeight * 0.6, halfLength * 0.02]}>
        <boxGeometry args={[0.003, props.bodyHeight * 0.45, length * 0.22]} />
        <meshStandardMaterial color="#111111" roughness={1} />
      </mesh>

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

      {/* Side mirrors – organic teardrop shape */}
      <SideMirror
        position={[-halfWidth * 0.95, mirrorY, mirrorZ]}
        side={-1}
        color={carColor}
      />
      <SideMirror
        position={[halfWidth * 0.95, mirrorY, mirrorZ]}
        side={1}
        color={carColor}
      />

      {/* Exhaust pipes */}
      <mesh position={[-hw * 0.3, 0.06, -halfLength * 0.98]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.032, 0.07, 12]} />
        <meshStandardMaterial color="#444444" roughness={0.25} metalness={0.92} />
      </mesh>
      <mesh position={[hw * 0.3, 0.06, -halfLength * 0.98]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.032, 0.07, 12]} />
        <meshStandardMaterial color="#444444" roughness={0.25} metalness={0.92} />
      </mesh>
      {/* Exhaust pipe inner dark */}
      <mesh position={[-hw * 0.3, 0.06, -halfLength * 0.98 - 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.02, 12]} />
        <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.5} />
      </mesh>
      <mesh position={[hw * 0.3, 0.06, -halfLength * 0.98 - 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.02, 12]} />
        <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.5} />
      </mesh>

      {/* Rear spoiler / wing (if high downforce) */}
      {hasWing && (
        <Spoiler
          width={wingWidth}
          position={[0, wingY, wingZ]}
          color={carColor}
        />
      )}

      {/* Underbody – flat dark panel */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[config.dimensions.trackWidth * 0.9, 0.01, length * 0.85]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} metalness={0.1} />
      </mesh>

      {/* Wheels – 5 double-spoke with brake caliper */}
      <Wheel position={[-hw, getWheelY(0), hwb]} radius={tireRadius} steering={steeringAngle} side={-1} />
      <Wheel position={[hw, getWheelY(1), hwb]} radius={tireRadius} steering={steeringAngle} side={1} />
      <Wheel position={[-hw, getWheelY(2), -hwb]} radius={tireRadius} side={-1} />
      <Wheel position={[hw, getWheelY(3), -hwb]} radius={tireRadius} side={1} />
    </group>
  );
}
