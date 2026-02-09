import type { SuspensionConfig } from './types';

export class SuspensionModel {
  private config: SuspensionConfig;

  constructor(config: SuspensionConfig) {
    this.config = config;
  }

  computeForce(compression: number, compressionVelocity: number): number {
    if (compression <= 0) return 0;
    const clampedCompression = Math.min(compression, this.config.maxTravel);
    const springForce = this.config.springRate * clampedCompression;
    const maxVelocity = 4;
    const clampedVelocity = Math.max(-maxVelocity, Math.min(compressionVelocity, maxVelocity));
    const damperForce = this.config.dampingRate * clampedVelocity;
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
