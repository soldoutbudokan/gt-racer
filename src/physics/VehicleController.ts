import * as THREE from 'three';
import type { VehicleConfig, VehicleState, WheelState, InputState } from './types';
import { SuspensionModel } from './SuspensionModel';
import { TireModel } from './TireModel';
import { Drivetrain } from './Drivetrain';
import { AerodynamicsModel } from './AerodynamicsModel';
import { GRAVITY } from '../utils/constants';
import { clamp } from '../utils/math';

interface WheelDefinition {
  position: THREE.Vector3;
  suspension: SuspensionModel;
  tire: TireModel;
  isDriven: boolean;
  isSteered: boolean;
}

export class VehicleController {
  config: VehicleConfig;
  drivetrain: Drivetrain;
  aero: AerodynamicsModel;
  wheels: WheelDefinition[];
  wheelStates: WheelState[];
  
  private chassisBody: any;
  private world: any;
  private rapier: any;
  private maxSteerAngle = 0.5;
  private brakeForce = 8000;
  private handbrakeForce = 12000;

  private assists = {
    tractionControl: false,
    abs: false,
    steeringAssist: false,
  };

  constructor(config: VehicleConfig) {
    this.config = config;
    this.drivetrain = new Drivetrain(config.engine, config.transmission);
    this.aero = new AerodynamicsModel(config.aero);
    
    const halfWheelbase = config.dimensions.wheelbase / 2;
    const halfTrack = config.dimensions.trackWidth / 2;

    this.wheels = [
      {
        position: new THREE.Vector3(-halfTrack, 0, halfWheelbase),
        suspension: new SuspensionModel(config.suspension.front),
        tire: new TireModel(config.tires.front),
        isDriven: false,
        isSteered: true,
      },
      {
        position: new THREE.Vector3(halfTrack, 0, halfWheelbase),
        suspension: new SuspensionModel(config.suspension.front),
        tire: new TireModel(config.tires.front),
        isDriven: false,
        isSteered: true,
      },
      {
        position: new THREE.Vector3(-halfTrack, 0, -halfWheelbase),
        suspension: new SuspensionModel(config.suspension.rear),
        tire: new TireModel(config.tires.rear),
        isDriven: true,
        isSteered: false,
      },
      {
        position: new THREE.Vector3(halfTrack, 0, -halfWheelbase),
        suspension: new SuspensionModel(config.suspension.rear),
        tire: new TireModel(config.tires.rear),
        isDriven: true,
        isSteered: false,
      },
    ];

    this.wheelStates = this.wheels.map(() => ({
      compression: 0,
      compressionVelocity: 0,
      angularVelocity: 0,
      slipRatio: 0,
      slipAngle: 0,
      onGround: false,
      suspensionForce: 0,
      lateralForce: 0,
      longitudinalForce: 0,
      contactPoint: { x: 0, y: 0, z: 0 },
      visualPosition: { x: 0, y: 0, z: 0 },
    }));
  }

  getState(): VehicleState {
    const velocity = this.chassisBody ? this.getLinearVelocity() : new THREE.Vector3();
    const speed = velocity.length();
    
    return {
      speed,
      speedKmh: speed * 3.6,
      rpm: this.drivetrain.rpm,
      gear: this.drivetrain.currentGear,
      throttle: 0,
      brake: 0,
      steering: 0,
      handbrake: false,
      wheels: [...this.wheelStates],
      position: this.chassisBody ? this.getPosition() : { x: 0, y: 0, z: 0 },
      rotation: this.chassisBody ? this.getRotation() : { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      angularVelocity: { x: 0, y: 0, z: 0 },
    };
  }

  setChassisBody(body: any, world: any, rapier?: any): void {
    this.chassisBody = body;
    this.world = world;
    if (rapier) this.rapier = rapier;
  }

  setAssists(assists: { tractionControl: boolean; abs: boolean; steeringAssist: boolean }): void {
    this.assists = assists;
  }

  private getLinearVelocity(): THREE.Vector3 {
    if (!this.chassisBody) return new THREE.Vector3();
    const v = this.chassisBody.linvel();
    return new THREE.Vector3(v.x, v.y, v.z);
  }

  private getPosition(): { x: number; y: number; z: number } {
    if (!this.chassisBody) return { x: 0, y: 0, z: 0 };
    const p = this.chassisBody.translation();
    return { x: p.x, y: p.y, z: p.z };
  }

  private getRotation(): { x: number; y: number; z: number; w: number } {
    if (!this.chassisBody) return { x: 0, y: 0, z: 0, w: 1 };
    const r = this.chassisBody.rotation();
    return { x: r.x, y: r.y, z: r.z, w: r.w };
  }

  update(input: InputState, dt: number): void {
    if (!this.chassisBody || !this.world) return;

    const chassisPos = this.chassisBody.translation();
    const chassisRot = this.chassisBody.rotation();
    const chassisQuat = new THREE.Quaternion(chassisRot.x, chassisRot.y, chassisRot.z, chassisRot.w);
    const chassisUp = new THREE.Vector3(0, 1, 0).applyQuaternion(chassisQuat);
    const chassisForward = new THREE.Vector3(0, 0, 1).applyQuaternion(chassisQuat);
    const chassisRight = new THREE.Vector3(1, 0, 0).applyQuaternion(chassisQuat);

    const velocity = this.getLinearVelocity();
    const speed = velocity.length();
    const forwardSpeed = velocity.dot(chassisForward);

    // Apply driving assists
    let effectiveThrottle = input.throttle;
    let effectiveBrake = input.brake;
    let effectiveSteering = input.steering;

    // Steering assist: reduce max steer at high speed
    if (this.assists.steeringAssist) {
      const speedKmh = speed * 3.6;
      const reduction = Math.min(speedKmh / 108, 1) * 0.6; // up to 60% reduction at 108 km/h
      effectiveSteering = input.steering * (1 - reduction);
    }

    let avgDrivenWheelAngVel = 0;
    let drivenCount = 0;

    for (let i = 0; i < 4; i++) {
      const wheel = this.wheels[i];
      const ws = this.wheelStates[i];

      const wheelWorldPos = wheel.position.clone().applyQuaternion(chassisQuat);
      wheelWorldPos.add(new THREE.Vector3(chassisPos.x, chassisPos.y, chassisPos.z));

      const rayFrom = { x: wheelWorldPos.x, y: wheelWorldPos.y, z: wheelWorldPos.z };
      const rayDir = { x: -chassisUp.x, y: -chassisUp.y, z: -chassisUp.z };
      const rayLength = wheel.suspension.getRayLength() + wheel.tire.getRadius();

      const rayTo = {
        x: rayFrom.x + rayDir.x * rayLength,
        y: rayFrom.y + rayDir.y * rayLength,
        z: rayFrom.z + rayDir.z * rayLength,
      };

      const ray = this.rapier
        ? new this.rapier.Ray(rayFrom, rayDir)
        : { origin: rayFrom, dir: rayDir };

      const hit = this.world.castRay(
        ray,
        rayLength,
        true,
        undefined,
        undefined,
        undefined,
        this.chassisBody
      );

      if (hit && hit.timeOfImpact < rayLength) {
        const hitDist = hit.timeOfImpact;
        const compression = wheel.suspension.getRayLength() + wheel.tire.getRadius() - hitDist;
        const prevCompression = ws.compression;
        const compressionVelocity = (compression - prevCompression) / dt;

        ws.onGround = true;
        ws.compression = Math.max(0, compression);
        ws.compressionVelocity = compressionVelocity;

        const suspForce = wheel.suspension.computeForce(ws.compression, compressionVelocity);
        ws.suspensionForce = suspForce;

        const contactWorldPos = new THREE.Vector3(
          rayFrom.x + rayDir.x * hitDist,
          rayFrom.y + rayDir.y * hitDist,
          rayFrom.z + rayDir.z * hitDist,
        );
        ws.contactPoint = { x: contactWorldPos.x, y: contactWorldPos.y, z: contactWorldPos.z };

        this.chassisBody.addForceAtPoint(
          { x: chassisUp.x * suspForce, y: chassisUp.y * suspForce, z: chassisUp.z * suspForce },
          { x: wheelWorldPos.x, y: wheelWorldPos.y, z: wheelWorldPos.z },
          true
        );

        let wheelForward = chassisForward.clone();
        let wheelRight = chassisRight.clone();
        if (wheel.isSteered) {
          const steerAngle = effectiveSteering * this.maxSteerAngle;
          const steerQuat = new THREE.Quaternion().setFromAxisAngle(chassisUp, steerAngle);
          wheelForward.applyQuaternion(steerQuat);
          wheelRight.applyQuaternion(steerQuat);
        }

        const contactVel = velocity.clone();
        const wheelSpeedLong = contactVel.dot(wheelForward);
        const wheelSpeedLat = contactVel.dot(wheelRight);

        const tireCircumSpeed = ws.angularVelocity * wheel.tire.getRadius();
        ws.slipRatio = 0;
        if (Math.abs(wheelSpeedLong) > 0.5 || Math.abs(tireCircumSpeed) > 0.5) {
          const maxDenom = Math.max(Math.abs(wheelSpeedLong), Math.abs(tireCircumSpeed));
          ws.slipRatio = clamp((tireCircumSpeed - wheelSpeedLong) / maxDenom, -1, 1);
        }

        ws.slipAngle = 0;
        if (Math.abs(wheelSpeedLong) > 1) {
          ws.slipAngle = Math.atan2(wheelSpeedLat, Math.abs(wheelSpeedLong));
        }

        const normalForce = suspForce;
        const forces = wheel.tire.computeCombinedForces(ws.slipAngle, ws.slipRatio, normalForce);
        ws.lateralForce = forces.lateral;
        ws.longitudinalForce = forces.longitudinal;

        const lateralForceVec = wheelRight.clone().multiplyScalar(-forces.lateral);
        const longForceVec = wheelForward.clone().multiplyScalar(forces.longitudinal);

        this.chassisBody.addForceAtPoint(
          { x: lateralForceVec.x, y: lateralForceVec.y, z: lateralForceVec.z },
          { x: contactWorldPos.x, y: contactWorldPos.y, z: contactWorldPos.z },
          true
        );

        let brakeTorque = 0;
        if (effectiveBrake > 0) {
          brakeTorque = this.brakeForce * effectiveBrake;
          // ABS: reduce brake torque when wheel is about to lock
          if (this.assists.abs && Math.abs(ws.slipRatio) > 0.12) {
            brakeTorque *= 0.5;
          }
        }
        if (input.handbrake && !wheel.isSteered) {
          brakeTorque = this.handbrakeForce;
        }

        if (brakeTorque > 0) {
          const brakeForceLong = Math.min(brakeTorque, normalForce * wheel.tire.getPeakGrip());
          const brakeDir = wheelSpeedLong > 0 ? -1 : 1;
          const brakeForceVec = wheelForward.clone().multiplyScalar(brakeDir * brakeForceLong * effectiveBrake);
          this.chassisBody.addForceAtPoint(
            { x: brakeForceVec.x, y: brakeForceVec.y, z: brakeForceVec.z },
            { x: contactWorldPos.x, y: contactWorldPos.y, z: contactWorldPos.z },
            true
          );
          ws.angularVelocity *= (1 - dt * 10 * effectiveBrake);
        }

        ws.angularVelocity = wheelSpeedLong / wheel.tire.getRadius();

        const suspOffset = wheel.suspension.getRestLength() - ws.compression;
        const visualPos = wheel.position.clone();
        visualPos.y -= suspOffset;
        ws.visualPosition = { x: visualPos.x, y: visualPos.y, z: visualPos.z };
      } else {
        ws.onGround = false;
        ws.compression = 0;
        ws.compressionVelocity = 0;
        ws.suspensionForce = 0;
        ws.lateralForce = 0;
        ws.longitudinalForce = 0;
        ws.slipRatio = 0;
        ws.slipAngle = 0;

        const visualPos = wheel.position.clone();
        visualPos.y -= wheel.suspension.getRestLength();
        ws.visualPosition = { x: visualPos.x, y: visualPos.y, z: visualPos.z };
      }

      if (wheel.isDriven) {
        avgDrivenWheelAngVel += ws.angularVelocity;
        drivenCount++;
      }
    }

    if (drivenCount > 0) {
      avgDrivenWheelAngVel /= drivenCount;
    }

    // TCS: limit throttle when driven wheels are spinning
    if (this.assists.tractionControl && effectiveThrottle > 0) {
      let maxDrivenSlip = 0;
      for (let i = 0; i < 4; i++) {
        if (this.wheels[i].isDriven) {
          maxDrivenSlip = Math.max(maxDrivenSlip, Math.abs(this.wheelStates[i].slipRatio));
        }
      }
      if (maxDrivenSlip > 0.15) {
        effectiveThrottle *= 0.3;
      }
    }

    this.drivetrain.updateRpm(avgDrivenWheelAngVel, effectiveThrottle, dt);
    this.drivetrain.updateAutoShift(dt);

    if (effectiveThrottle > 0) {
      const wheelTorque = this.drivetrain.getWheelTorque(effectiveThrottle);
      for (let i = 0; i < 4; i++) {
        if (this.wheels[i].isDriven && this.wheelStates[i].onGround) {
          const driveForce = wheelTorque / this.wheels[i].tire.getRadius() / drivenCount;
          const ws = this.wheelStates[i];

          let wheelForward = chassisForward.clone();
          if (this.wheels[i].isSteered) {
            const steerAngle = effectiveSteering * this.maxSteerAngle;
            const steerQuat = new THREE.Quaternion().setFromAxisAngle(chassisUp, steerAngle);
            wheelForward.applyQuaternion(steerQuat);
          }

          const forceVec = wheelForward.clone().multiplyScalar(driveForce);
          this.chassisBody.addForceAtPoint(
            { x: forceVec.x, y: forceVec.y, z: forceVec.z },
            { x: ws.contactPoint.x, y: ws.contactPoint.y, z: ws.contactPoint.z },
            true
          );
        }
      }
    }

    const dragForce = this.aero.computeDragForce(speed);
    if (speed > 0.1) {
      const dragDir = velocity.clone().normalize().multiplyScalar(-dragForce);
      this.chassisBody.addForce({ x: dragDir.x, y: dragDir.y, z: dragDir.z }, true);
    }

    const downforce = this.aero.computeDownforce(speed);
    this.chassisBody.addForce({ x: 0, y: -downforce, z: 0 }, true);
  }
}
