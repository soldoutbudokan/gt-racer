import * as THREE from 'three';
import { RacingLine } from './RacingLine';
import { clamp } from '../utils/math';
import type { InputState } from '../physics/types';

export interface AIPersonality {
  aggression: number;
  skill: number;
  consistency: number;
}

export class AIDriver {
  private racingLine: RacingLine;
  private personality: AIPersonality;
  private _input: InputState;
  private rubberBandSpeedMod: number = 1;

  constructor(racingLine: RacingLine, personality: AIPersonality) {
    this.racingLine = racingLine;
    this.personality = personality;
    this._input = { throttle: 0, brake: 0, steering: 0, handbrake: false };
  }

  get input(): InputState {
    return this._input;
  }

  setRubberBandModifier(mod: number): void {
    this.rubberBandSpeedMod = mod;
  }

  update(position: THREE.Vector3, velocity: THREE.Vector3, forward: THREE.Vector3, currentT: number, _dt: number): void {
    const speed = velocity.length();
    const lookahead = 0.03 + speed * 0.001;
    const target = this.racingLine.getTargetPoint(currentT, lookahead);

    const toTarget = target.position.clone().sub(position);
    toTarget.y = 0;
    toTarget.normalize();

    const forwardFlat = forward.clone();
    forwardFlat.y = 0;
    forwardFlat.normalize();

    const cross = forwardFlat.x * toTarget.z - forwardFlat.z * toTarget.x;
    const dot = forwardFlat.dot(toTarget);
    let steerAngle = Math.atan2(cross, dot);

    const skillError = (1 - this.personality.skill) * 0.1 * (Math.random() - 0.5);
    steerAngle += skillError;

    const steerGain = 3.0;
    this._input.steering = clamp(steerAngle * steerGain, -1, 1);

    const targetSpeed = target.targetSpeed * this.rubberBandSpeedMod;

    const consistencyNoise = (1 - this.personality.consistency) * 0.05 * Math.sin(Date.now() * 0.001);
    const adjustedTarget = targetSpeed * (1 + consistencyNoise);

    if (speed < adjustedTarget * 0.95) {
      this._input.throttle = clamp((adjustedTarget - speed) / (adjustedTarget * 0.3), 0.3, 1);
      this._input.brake = 0;
    } else if (speed > adjustedTarget * 1.05) {
      this._input.throttle = 0;
      this._input.brake = clamp((speed - adjustedTarget) / (adjustedTarget * 0.3), 0.2, 1);
    } else {
      this._input.throttle = 0.4;
      this._input.brake = 0;
    }

    this._input.handbrake = false;
  }
}
