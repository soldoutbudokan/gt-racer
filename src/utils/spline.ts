import * as THREE from 'three';

export interface SplinePoint {
  position: THREE.Vector3;
  width: number;
  bankAngle: number;
}

export class CatmullRomSpline {
  private points: THREE.Vector3[];
  private closed: boolean;
  private lengths: number[];
  private totalLength: number;

  constructor(points: THREE.Vector3[], closed = true) {
    this.points = points;
    this.closed = closed;
    this.lengths = [];
    this.totalLength = 0;
    this.computeLengths();
  }

  private computeLengths(): void {
    this.lengths = [];
    this.totalLength = 0;
    const segments = this.closed ? this.points.length : this.points.length - 1;
    const samplesPerSegment = 20;

    for (let i = 0; i < segments; i++) {
      let segLength = 0;
      let prevPoint = this.interpolateRaw(i, 0);
      for (let s = 1; s <= samplesPerSegment; s++) {
        const t = s / samplesPerSegment;
        const point = this.interpolateRaw(i, t);
        segLength += prevPoint.distanceTo(point);
        prevPoint = point;
      }
      this.lengths.push(segLength);
      this.totalLength += segLength;
    }
  }

  private interpolateRaw(segment: number, localT: number): THREE.Vector3 {
    const n = this.points.length;
    const p0 = this.points[((segment - 1) % n + n) % n];
    const p1 = this.points[segment % n];
    const p2 = this.points[(segment + 1) % n];
    const p3 = this.points[(segment + 2) % n];

    const t = localT;
    const t2 = t * t;
    const t3 = t2 * t;

    return new THREE.Vector3(
      0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
    );
  }

  interpolate(t: number): THREE.Vector3 {
    if (this.closed) {
      t = ((t % 1) + 1) % 1;
    } else {
      t = Math.max(0, Math.min(1, t));
    }
    const segments = this.closed ? this.points.length : this.points.length - 1;
    const scaled = t * segments;
    const segment = Math.floor(scaled);
    const localT = scaled - segment;
    if (segment >= segments) return this.points[this.points.length - 1].clone();
    return this.interpolateRaw(segment, localT);
  }

  tangent(t: number): THREE.Vector3 {
    const delta = 0.001;
    const p0 = this.interpolate(t - delta);
    const p1 = this.interpolate(t + delta);
    return p1.sub(p0).normalize();
  }

  nearestT(point: THREE.Vector3, samples = 200): number {
    let bestT = 0;
    let bestDist = Infinity;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = this.interpolate(t);
      const dist = p.distanceToSquared(point);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }

    // Refine with binary search
    let lo = bestT - 1 / samples;
    let hi = bestT + 1 / samples;
    for (let iter = 0; iter < 10; iter++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      const d1 = this.interpolate(m1).distanceToSquared(point);
      const d2 = this.interpolate(m2).distanceToSquared(point);
      if (d1 < d2) {
        hi = m2;
      } else {
        lo = m1;
      }
    }

    return (lo + hi) / 2;
  }

  arcLength(t0: number, t1: number, samples = 50): number {
    let length = 0;
    let prev = this.interpolate(t0);
    for (let i = 1; i <= samples; i++) {
      const t = t0 + (t1 - t0) * (i / samples);
      const p = this.interpolate(t);
      length += prev.distanceTo(p);
      prev = p;
    }
    return length;
  }

  getTotalLength(): number {
    return this.totalLength;
  }

  getPoints(): THREE.Vector3[] {
    return this.points;
  }

  normal(t: number): THREE.Vector3 {
    const tan = this.tangent(t);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    return new THREE.Vector3().crossVectors(right, tan).normalize();
  }
}
