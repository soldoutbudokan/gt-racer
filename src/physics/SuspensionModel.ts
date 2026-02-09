import type { SuspensionConfig } from './types';
import { clamp } from '../utils/math';

export class SuspensionModel {
  private config: SuspensionConfig;

  constructor(config: SuspensionConfig) {
    this.config = config;
  }

  computeForce(compression: number, compressionVelocity: number): number {
    if (compression <= 0) return 0;
    const clampedCompression = Math.min(compression, this.config.maxTravel);
    const springForce = this.config.springRate * clampedCompression;
    const maxVel = this.config.maxDamperVelocity ?? 4.0;
    const damperForce = this.config.dampingRate * clamp(compressionVelocity, -maxVel, maxVel);
    return Math.max(0, springForce + damperForce);
  }

  getRestLength(): number {
    return this.config.restLength;
  }

  getMaxTravel(): number {
    return this.config.maxTravel;
  }

  getRayLength(): number {
    return this.config.restLength + this.config.maxTravel;
  }
}
