import { useRef, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, Physics, type RapierRigidBody } from '@react-three/rapier';
import { ProceduralCar } from '../components/ProceduralCar';
import { Track } from '../components/Track';
import { TrackEnvironment } from '../components/Environment';
import { Lighting } from '../components/Lighting';
import { ChaseCamera } from '../cameras/ChaseCamera';
import { PostProcessingEffects } from '../effects/PostProcessing';
import { TireSmoke } from '../effects/TireSmoke';
import { SkidMarks } from '../effects/SkidMarks';
import { VehicleController } from '../../physics/VehicleController';
import { inputManager } from '../../engine/InputManager';
import { useVehicleStore } from '../../stores/useVehicleStore';
import { useRaceStore } from '../../stores/useRaceStore';
import { useGameStore } from '../../stores/useGameStore';
import { CatmullRomSpline } from '../../utils/spline';
import { audioEngine } from '../../audio/AudioEngine';
import { EngineSynth } from '../../audio/EngineSynth';
import { TireAudio } from '../../audio/TireAudio';
import { WindAudio } from '../../audio/WindAudio';
import { AIDriver } from '../../ai/AIDriver';
import { RacingLine } from '../../ai/RacingLine';
import sedanConfig from '../../data/cars/sedan-sport.json';
import trackData from '../../data/tracks/azure-coast.json';
import type { VehicleConfig } from '../../physics/types';

const AI_COUNT = 5;
const AI_COLORS = ['#2E5BFF', '#00C853', '#FF6D00', '#AA00FF', '#FFD600'];

interface AICarInstance {
  id: string;
  bodyRef: React.RefObject<RapierRigidBody | null>;
  controller: VehicleController;
  driver: AIDriver;
  color: string;
  currentT: number;
}

function PlayerCar({ vehicleController, spline }: { vehicleController: VehicleController; spline: CatmullRomSpline }) {
  const chassisRef = useRef<RapierRigidBody>(null);
  const engineSynth = useRef<EngineSynth | null>(null);
  const tireAudio = useRef<TireAudio | null>(null);
  const windAudio = useRef<WindAudio | null>(null);
  const audioStarted = useRef(false);

  const startCountdown = useCallback(() => {
    const store = useRaceStore.getState();
    if (store.countdown > 0 && !store.started) {
      const elapsed = 4 - store.countdown;
      if (elapsed < 4) {
        setTimeout(() => {
          useRaceStore.getState().updateCountdown(store.countdown - 1 / 60);
        }, 16);
      }
    }
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const paused = useGameStore.getState().paused;
    if (paused) return;

    // Handle countdown
    const raceStore = useRaceStore.getState();
    if (raceStore.countdown > 0) {
      useRaceStore.getState().updateCountdown(raceStore.countdown - dt);
    }

    if (!chassisRef.current) return;

    // Set physics body reference
    const world = (state as any).__r3f?.root?.getState?.()?.rapier?.world;
    if (chassisRef.current && !vehicleController['chassisBody']) {
      // Access rapier world from context
    }

    inputManager.update(dt);

    // Only allow driving after countdown
    const input = raceStore.started ? inputManager.inputState : { throttle: 0, brake: 0, steering: 0, handbrake: true };

    vehicleController.update(input, dt);

    const vehicleState = vehicleController.getState();
    vehicleState.throttle = input.throttle;
    vehicleState.brake = input.brake;
    vehicleState.steering = input.steering;
    vehicleState.handbrake = input.handbrake;
    useVehicleStore.getState().updateFromState(vehicleState);

    // Update race time
    if (raceStore.started && !raceStore.finished) {
      useRaceStore.getState().updateRaceTime(dt);
    }

    // Track position
    const pos = new THREE.Vector3(vehicleState.position.x, vehicleState.position.y, vehicleState.position.z);
    const currentT = spline.nearestT(pos, 100);
    useRaceStore.getState().updateRacer('player', { distanceAlongTrack: currentT });

    // Audio
    if (!audioStarted.current && audioEngine.isUnlocked()) {
      engineSynth.current = new EngineSynth();
      engineSynth.current.start(0.5);
      tireAudio.current = new TireAudio();
      tireAudio.current.start(0.3);
      windAudio.current = new WindAudio();
      windAudio.current.start(0.2);
      audioStarted.current = true;
    }

    if (audioStarted.current) {
      engineSynth.current?.update(vehicleState.rpm, input.throttle);
      const maxSlip = vehicleState.wheels.reduce((max, w) => Math.max(max, Math.abs(w.slipAngle)), 0);
      tireAudio.current?.update(maxSlip, vehicleState.speed);
      windAudio.current?.update(vehicleState.speed);
    }

    // Pause handling
    if (inputManager.isKeyPressed('Escape')) {
      useGameStore.getState().togglePause();
    }
  });

  useEffect(() => {
    return () => {
      engineSynth.current?.stop();
      tireAudio.current?.stop();
      windAudio.current?.stop();
    };
  }, []);

  const steeringAngle = useVehicleStore((s) => s.steering * 0.5);
  const wheels = useVehicleStore((s) => s.wheels);

  return (
    <RigidBody
      ref={chassisRef}
      type="dynamic"
      colliders="cuboid"
      mass={sedanConfig.specs.mass}
      position={[0, 2, 0]}
      linearDamping={0.1}
      angularDamping={0.5}
      onCollisionEnter={() => {}}
    >
      <ProceduralCar
        config={sedanConfig as unknown as VehicleConfig}
        wheelStates={wheels}
        steeringAngle={steeringAngle}
      />
      {/* Invisible collision box */}
      <mesh visible={false}>
        <boxGeometry args={[1.7, 0.8, 4.5]} />
      </mesh>
    </RigidBody>
  );
}

function AICar({ aiCar, spline }: { aiCar: AICarInstance; spline: CatmullRomSpline }) {
  const chassisRef = useRef<RapierRigidBody>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const paused = useGameStore.getState().paused;
    const raceStarted = useRaceStore.getState().started;
    if (paused || !raceStarted || !chassisRef.current) return;

    const pos = chassisRef.current.translation();
    const rot = chassisRef.current.rotation();
    const vel = chassisRef.current.linvel();

    const position = new THREE.Vector3(pos.x, pos.y, pos.z);
    const velocity = new THREE.Vector3(vel.x, vel.y, vel.z);
    const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);

    aiCar.currentT = spline.nearestT(position, 100);

    aiCar.driver.update(position, velocity, forward, aiCar.currentT, dt);
    aiCar.controller.update(aiCar.driver.input, dt);

    useRaceStore.getState().updateRacer(aiCar.id, { distanceAlongTrack: aiCar.currentT });
  });

  const startIdx = parseInt(aiCar.id.split('_')[1]) + 1;

  return (
    <RigidBody
      ref={chassisRef}
      type="dynamic"
      colliders="cuboid"
      mass={sedanConfig.specs.mass}
      position={[startIdx % 2 === 0 ? 2 : -2, 2, -(startIdx + 1) * 6]}
      linearDamping={0.1}
      angularDamping={0.5}
    >
      <ProceduralCar
        config={sedanConfig as unknown as VehicleConfig}
        color={aiCar.color}
      />
      <mesh visible={false}>
        <boxGeometry args={[1.7, 0.8, 4.5]} />
      </mesh>
    </RigidBody>
  );
}

function TrackCollider({ splinePoints, widths }: { splinePoints: number[][]; widths: number[] }) {
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <Track splinePoints={splinePoints} widths={widths} bankAngles={trackData.spline.bankAngles} />
    </RigidBody>
  );
}

export function RaceScene() {
  const scene = useGameStore((s) => s.scene);

  const spline = useMemo(
    () => new CatmullRomSpline(
      trackData.spline.points.map((p: number[]) => new THREE.Vector3(p[0], p[1], p[2])),
      true
    ),
    []
  );

  const racingLine = useMemo(() => new RacingLine(spline, trackData.aiSpeedTargets), [spline]);

  const vehicleController = useMemo(() => new VehicleController(sedanConfig as unknown as VehicleConfig), []);

  const aiCars = useMemo<AICarInstance[]>(() => {
    const cars: AICarInstance[] = [];
    for (let i = 0; i < AI_COUNT; i++) {
      const personality = {
        aggression: 0.3 + Math.random() * 0.5,
        skill: 0.6 + Math.random() * 0.3,
        consistency: 0.7 + Math.random() * 0.2,
      };
      const driver = new AIDriver(racingLine, personality);
      const controller = new VehicleController(sedanConfig as unknown as VehicleConfig);
      cars.push({
        id: `ai_${i}`,
        bodyRef: { current: null },
        controller,
        driver,
        color: AI_COLORS[i],
        currentT: 0,
      });
    }
    return cars;
  }, [racingLine]);

  useEffect(() => {
    audioEngine.init();
    useRaceStore.getState().startRace(trackData.laps, AI_COUNT);
    return () => { };
  }, []);

  if (scene !== 'racing') return null;

  return (
    <>
      <Physics gravity={[0, -9.81, 0]} debug={false}>
        {/* Ground plane collider */}
        <RigidBody type="fixed" position={[0, -0.5, 0]}>
          <mesh>
            <boxGeometry args={[1000, 1, 1000]} />
            <meshStandardMaterial visible={false} />
          </mesh>
        </RigidBody>

        {/* Track */}
        <TrackCollider splinePoints={trackData.spline.points} widths={trackData.spline.widths} />

        {/* Player car */}
        <PlayerCar vehicleController={vehicleController} spline={spline} />

        {/* AI cars */}
        {aiCars.map((aiCar) => (
          <AICar key={aiCar.id} aiCar={aiCar} spline={spline} />
        ))}
      </Physics>

      {/* Environment */}
      <TrackEnvironment splinePoints={trackData.spline.points} widths={trackData.spline.widths} />

      {/* Lighting */}
      <Lighting />

      {/* Effects */}
      <TireSmoke />
      <SkidMarks />
      <PostProcessingEffects />

      {/* Camera */}
      <ChaseCamera />

      {/* Sky */}
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#87CEEB', 100, 400]} />
    </>
  );
}
