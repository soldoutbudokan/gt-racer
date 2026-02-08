import type { AeroConfig } from './types';
import { AIR_DENSITY } from '../utils/constants';

export class AerodynamicsModel {
  private config: AeroConfig;

  constructor(config: AeroConfig) {
    this.config = config;
  }

  computeDragForce(speed: number): number {
    return 0.5 * AIR_DENSITY * this.config.dragCoefficient * this.config.frontalArea * speed * speed;
  }

  computeDownforce(speed: number): number {
    return 0.5 * AIR_DENSITY * this.config.downforceCoefficient * this.config.frontalArea * speed * speed;
  }
}
