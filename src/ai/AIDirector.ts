import * as THREE from 'three';
import { AIDriver, type AIPersonality } from './AIDriver';
import { RacingLine } from './RacingLine';
import { computeRubberBandModifier } from './RubberBanding';
import type { InputState } from '../physics/types';

export interface AICarState {
  id: string;
  driver: AIDriver;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  forward: THREE.Vector3;
  currentT: number;
}

export class AIDirector {
  private cars: AICarState[] = [];
  private racingLine: RacingLine;

  constructor(racingLine: RacingLine) {
    this.racingLine = racingLine;
  }

  addCar(id: string, personality: AIPersonality): AIDriver {
    const driver = new AIDriver(this.racingLine, personality);
    this.cars.push({
      id,
      driver,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      forward: new THREE.Vector3(0, 0, 1),
      currentT: 0,
    });
    return driver;
  }

  updateCar(id: string, position: THREE.Vector3, velocity: THREE.Vector3, forward: THREE.Vector3, currentT: number): void {
    const car = this.cars.find((c) => c.id === id);
    if (car) {
      car.position.copy(position);
      car.velocity.copy(velocity);
      car.forward.copy(forward);
      car.currentT = currentT;
    }
  }

  update(playerPosition: number, totalRacers: number, dt: number): void {
    for (const car of this.cars) {
      const aiPos = this.cars.indexOf(car) + 2;
      const dist = car.position.length();
      const mod = computeRubberBandModifier(aiPos, playerPosition, totalRacers, dist);
      car.driver.setRubberBandModifier(mod);
      car.driver.update(car.position, car.velocity, car.forward, car.currentT, dt);
    }
  }

  getInput(id: string): InputState | null {
    const car = this.cars.find((c) => c.id === id);
    return car ? car.driver.input : null;
  }

  getCars(): AICarState[] {
    return this.cars;
  }
}
