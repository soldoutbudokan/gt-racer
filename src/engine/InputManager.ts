import type { InputState } from '../physics/types';

export class InputManager {
  private keys: Set<string> = new Set();
  private _inputState: InputState = {
    throttle: 0,
    brake: 0,
    steering: 0,
    handbrake: false,
  };

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  get inputState(): InputState {
    return this._inputState;
  }

  update(dt: number): void {
    const smoothing = 1 - Math.exp(-10 * dt);
    const steerSmoothing = 1 - Math.exp(-6 * dt);

    const targetThrottle = (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ? 1 : 0;
    const targetBrake = (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ? 1 : 0;

    let targetSteering = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) targetSteering = 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) targetSteering = -1;

    this._inputState.throttle += (targetThrottle - this._inputState.throttle) * smoothing;
    this._inputState.brake += (targetBrake - this._inputState.brake) * smoothing;
    this._inputState.steering += (targetSteering - this._inputState.steering) * steerSmoothing;
    this._inputState.handbrake = this.keys.has('Space');
  }

  isKeyPressed(code: string): boolean {
    return this.keys.has(code);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
  }
}

export const inputManager = new InputManager();
