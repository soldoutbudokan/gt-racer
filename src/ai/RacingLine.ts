import * as THREE from 'three';
import { CatmullRomSpline } from '../utils/spline';

export interface RacingLinePoint {
  position: THREE.Vector3;
  targetSpeed: number;
  t: number;
}

export class RacingLine {
  private spline: CatmullRomSpline;
  private points: RacingLinePoint[];
  private speedTargets: number[];

  constructor(spline: CatmullRomSpline, speedTargets: number[]) {
    this.spline = spline;
    this.speedTargets = speedTargets;
    this.points = [];
    this.computePoints();
  }

  private computePoints(): void {
    const numPoints = 200;
    this.points = [];

    for (let i = 0; i < numPoints; i++) {
      const t = i / numPoints;
      const pos = this.spline.interpolate(t);

      const speedIdx = Math.floor(t * (this.speedTargets.length - 1));
      const speedT = t * (this.speedTargets.length - 1) - speedIdx;
      const nextIdx = Math.min(speedIdx + 1, this.speedTargets.length - 1);
      const speed = this.speedTargets[speedIdx] + (this.speedTargets[nextIdx] - this.speedTargets[speedIdx]) * speedT;

      this.points.push({ position: pos, targetSpeed: speed / 3.6, t });
    }
  }

  getTargetPoint(currentT: number, lookahead: number = 0.05): RacingLinePoint {
    const targetT = ((currentT + lookahead) % 1 + 1) % 1;
    const idx = Math.floor(targetT * this.points.length) % this.points.length;
    return this.points[idx];
  }

  getTargetSpeed(t: number): number {
    const idx = Math.floor(((t % 1 + 1) % 1) * this.points.length) % this.points.length;
    return this.points[idx].targetSpeed;
  }

  getSpline(): CatmullRomSpline {
    return this.spline;
  }
}
