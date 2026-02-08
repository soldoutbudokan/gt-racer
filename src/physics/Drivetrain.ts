import type { EngineConfig, TransmissionConfig } from './types';
import { clamp, lerp } from '../utils/math';

export class Drivetrain {
  private engineConfig: EngineConfig;
  private transConfig: TransmissionConfig;
  private _currentGear: number = 1;
  private _rpm: number;
  private _shiftCooldown: number = 0;

  constructor(engineConfig: EngineConfig, transConfig: TransmissionConfig) {
    this.engineConfig = engineConfig;
    this.transConfig = transConfig;
    this._rpm = engineConfig.idleRpm;
  }

  get currentGear(): number {
    return this._currentGear;
  }

  get rpm(): number {
    return this._rpm;
  }

  getEngineTorque(rpm: number): number {
    const curve = this.engineConfig.torqueCurve;
    if (rpm <= curve[0][0]) return curve[0][1];
    if (rpm >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];

    for (let i = 0; i < curve.length - 1; i++) {
      if (rpm >= curve[i][0] && rpm <= curve[i + 1][0]) {
        const t = (rpm - curve[i][0]) / (curve[i + 1][0] - curve[i][0]);
        return lerp(curve[i][1], curve[i + 1][1], t);
      }
    }
    return 0;
  }

  getCurrentGearRatio(): number {
    if (this._currentGear === -1) return this.transConfig.reverseRatio;
    if (this._currentGear === 0) return 0;
    return this.transConfig.gearRatios[this._currentGear - 1];
  }

  getTotalRatio(): number {
    return this.getCurrentGearRatio() * this.transConfig.finalDrive;
  }

  getWheelTorque(throttle: number): number {
    const engineTorque = this.getEngineTorque(this._rpm) * throttle;
    const totalRatio = this.getTotalRatio();
    const efficiency = 1 - this.transConfig.drivetrainLoss;
    return engineTorque * totalRatio * efficiency;
  }

  updateRpm(wheelAngularVelocity: number, throttle: number, dt: number): void {
    const totalRatio = Math.abs(this.getTotalRatio());
    if (totalRatio < 0.001) {
      this._rpm = this.engineConfig.idleRpm;
      return;
    }

    const wheelRpm = Math.abs(wheelAngularVelocity) * (60 / (2 * Math.PI));
    const targetRpm = wheelRpm * totalRatio;
    const idleRpm = this.engineConfig.idleRpm;
    
    this._rpm = Math.max(idleRpm, targetRpm);
    
    if (throttle > 0 && this._rpm < idleRpm + 500) {
      this._rpm = Math.max(this._rpm, idleRpm + throttle * 1500);
    }

    this._rpm = clamp(this._rpm, idleRpm, this.engineConfig.maxRpm);
  }

  updateAutoShift(dt: number): void {
    this._shiftCooldown = Math.max(0, this._shiftCooldown - dt);
    if (this._shiftCooldown > 0) return;

    const peakPowerRpm = this.findPeakPowerRpm();
    
    if (this._rpm > peakPowerRpm * 0.95 && this._currentGear < this.transConfig.gearRatios.length) {
      this._currentGear++;
      this._shiftCooldown = 0.3;
    } else if (this._rpm < peakPowerRpm * 0.4 && this._currentGear > 1) {
      this._currentGear--;
      this._shiftCooldown = 0.3;
    }
  }

  private findPeakPowerRpm(): number {
    let peakPower = 0;
    let peakRpm = this.engineConfig.redlineRpm;
    
    for (let rpm = this.engineConfig.idleRpm; rpm <= this.engineConfig.maxRpm; rpm += 100) {
      const power = this.getEngineTorque(rpm) * rpm;
      if (power > peakPower) {
        peakPower = power;
        peakRpm = rpm;
      }
    }
    return peakRpm;
  }

  setGear(gear: number): void {
    const maxGear = this.transConfig.gearRatios.length;
    this._currentGear = clamp(gear, -1, maxGear);
  }

  getRedlineRpm(): number {
    return this.engineConfig.redlineRpm;
  }

  getMaxRpm(): number {
    return this.engineConfig.maxRpm;
  }

  getIdleRpm(): number {
    return this.engineConfig.idleRpm;
  }

  getGearCount(): number {
    return this.transConfig.gearRatios.length;
  }
}
