import { create } from 'zustand';
import type { VehicleState, WheelState } from '../physics/types';

interface VehicleStoreState {
  speed: number;
  speedKmh: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  steering: number;
  handbrake: boolean;
  wheels: WheelState[];
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  updateFromState: (state: VehicleState) => void;
}

export const useVehicleStore = create<VehicleStoreState>((set) => ({
  speed: 0,
  speedKmh: 0,
  rpm: 0,
  gear: 1,
  throttle: 0,
  brake: 0,
  steering: 0,
  handbrake: false,
  wheels: [],
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  updateFromState: (state) => set({
    speed: state.speed,
    speedKmh: state.speedKmh,
    rpm: state.rpm,
    gear: state.gear,
    throttle: state.throttle,
    brake: state.brake,
    steering: state.steering,
    handbrake: state.handbrake,
    wheels: state.wheels,
    position: state.position,
    rotation: state.rotation,
  }),
}));
