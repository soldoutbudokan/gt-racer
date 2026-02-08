export interface WheelConfig {
  peakGrip: number;
  stiffness: number;
  shape: number;
  radius: number;
}

export interface SuspensionConfig {
  springRate: number;
  dampingRate: number;
  restLength: number;
  maxTravel: number;
}

export interface EngineConfig {
  torqueCurve: [number, number][];
  idleRpm: number;
  redlineRpm: number;
  maxRpm: number;
}

export interface TransmissionConfig {
  gearRatios: number[];
  reverseRatio: number;
  finalDrive: number;
  drivetrainLoss: number;
}

export interface AeroConfig {
  dragCoefficient: number;
  frontalArea: number;
  downforceCoefficient: number;
}

export interface DimensionsConfig {
  wheelbase: number;
  trackWidth: number;
  cgHeight: number;
}

export interface VehicleConfig {
  name: string;
  tier: number;
  price: number;
  specs: {
    mass: number;
    power: number;
    topSpeed: number;
  };
  engine: EngineConfig;
  transmission: TransmissionConfig;
  suspension: {
    front: SuspensionConfig;
    rear: SuspensionConfig;
  };
  tires: {
    front: WheelConfig;
    rear: WheelConfig;
  };
  aero: AeroConfig;
  dimensions: DimensionsConfig;
  color: string;
  bodyType?: 'sedan' | 'coupe' | 'supercar';
}

export interface WheelState {
  compression: number;
  compressionVelocity: number;
  angularVelocity: number;
  slipRatio: number;
  slipAngle: number;
  onGround: boolean;
  suspensionForce: number;
  lateralForce: number;
  longitudinalForce: number;
  contactPoint: { x: number; y: number; z: number };
  visualPosition: { x: number; y: number; z: number };
}

export interface VehicleState {
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
  velocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
}

export interface InputState {
  throttle: number;
  brake: number;
  steering: number;
  handbrake: boolean;
}
