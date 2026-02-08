import type { WheelConfig } from './types';

export class TireModel {
  private config: WheelConfig;

  constructor(config: WheelConfig) {
    this.config = config;
  }

  computeLateralForce(slipAngle: number, normalForce: number): number {
    const B = this.config.stiffness;
    const C = this.config.shape;
    const D = this.config.peakGrip * normalForce;
    return D * Math.sin(C * Math.atan(B * slipAngle));
  }

  computeLongitudinalForce(slipRatio: number, normalForce: number): number {
    const B = this.config.stiffness;
    const C = this.config.shape;
    const D = this.config.peakGrip * normalForce;
    return D * Math.sin(C * Math.atan(B * slipRatio));
  }

  computeCombinedForces(
    slipAngle: number,
    slipRatio: number,
    normalForce: number
  ): { lateral: number; longitudinal: number } {
    let lateral = this.computeLateralForce(slipAngle, normalForce);
    let longitudinal = this.computeLongitudinalForce(slipRatio, normalForce);
    
    const maxForce = this.config.peakGrip * normalForce;
    const totalForce = Math.sqrt(lateral * lateral + longitudinal * longitudinal);
    
    if (totalForce > maxForce && totalForce > 0) {
      const scale = maxForce / totalForce;
      lateral *= scale;
      longitudinal *= scale;
    }

    return { lateral, longitudinal };
  }

  getRadius(): number {
    return this.config.radius;
  }

  getPeakGrip(): number {
    return this.config.peakGrip;
  }
}
