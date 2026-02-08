import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, Physics, useRapier, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import { ProceduralCar, getProportions } from '../components/ProceduralCar';
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
import { useSettingsStore } from '../../stores/useSettingsStore';
import { CatmullRomSpline } from '../../utils/spline';
import { AIDriver } from '../../ai/AIDriver';
import { RacingLine } from '../../ai/RacingLine';
import sedanConfig from '../../data/cars/sedan-sport.json';
import trackData from '../../data/tracks/azure-coast.json';
import type { VehicleConfig } from '../../physics/types';

const AI_COUNT = 5;
const AI_COLORS = ['#2E5BFF', '#00C853', '#FF6D00', '#AA00FF', '#FFD600'];

interface AICarInstance {
  id: string;
  controller: VehicleController;
  driver: AIDriver;
  color: string;
  currentT: number;
}

function getCollisionDims(config: VehicleConfig) {
  const bodyType = (config.bodyType || 'sedan') as 'sedan' | 'coupe' | 'supercar';
  const props = getProportions(bodyType);
  const w = config.dimensions.trackWidth * props.bodyWidthScale;
  const h = props.roofHeight;
  const l = config.dimensions.wheelbase * props.lengthFactor;
  const groundClearance = 0.08;
  const centerY = (groundClearance + h) / 2;
  return { w, h, l, centerY };
}

function PlayerCar({ vehicleController, spline }: { vehicleController: VehicleController; spline: CatmullRomSpline }) {
  const chassisRef = useRef<RapierRigidBody>(null);
  const prevT = useRef(0);
  const { world, rapier } = useRapier();

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
    if (chassisRef.current && !vehicleController['chassisBody']) {
      vehicleController.setChassisBody(chassisRef.current, world, rapier);
    }

    inputManager.update(dt);

    // Only allow driving after countdown
    const input = raceStore.started ? inputManager.inputState : { throttle: 0, brake: 0, steering: 0, handbrake: true };

    // Wire driving assists from settings
    const settings = useSettingsStore.getState();
    vehicleController.setAssists({
      tractionControl: settings.tractionControl,
      abs: settings.abs,
      steeringAssist: settings.steeringAssist,
    });

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

    // Lap crossing detection
    useRaceStore.getState().crossCheckpoint('player', currentT, prevT.current, raceStore.raceTime);
    prevT.current = currentT;

    // Update positions periodically
    useRaceStore.getState().updatePositions();

    // Check if player finished
    const playerRacer = raceStore.racers.find(r => r.isPlayer);
    if (playerRacer?.finished && !raceStore.finished) {
      useRaceStore.getState().finishRace();
      setTimeout(() => {
        useGameStore.getState().setScene('results');
      }, 3000);
    }

    // Pause handling
    if (inputManager.isKeyPressed('Escape')) {
      useGameStore.getState().togglePause();
    }
  });

  const steeringAngle = useVehicleStore((s) => s.steering * 0.5);
  const wheels = useVehicleStore((s) => s.wheels);

  const dims = getCollisionDims(sedanConfig as unknown as VehicleConfig);
  const startPos = trackData.startPositions[0] as [number, number, number];

  return (
    <RigidBody
      ref={chassisRef}
      type="dynamic"
      colliders={false}
      mass={sedanConfig.specs.mass}
      position={[startPos[0], dims.centerY + 0.02, startPos[2]]}
      linearDamping={0.1}
      angularDamping={0.5}
      linearVelocity={[0, 0, 0]}
      angularVelocity={[0, 0, 0]}
      onCollisionEnter={() => {}}
    >
      <CuboidCollider args={[dims.w / 2, dims.h / 2, dims.l / 2]} position={[0, dims.centerY, 0]} />
      <ProceduralCar
        config={sedanConfig as unknown as VehicleConfig}
        wheelStates={wheels}
        steeringAngle={steeringAngle}
      />
    </RigidBody>
  );
}

function AICar({ aiCar, spline }: { aiCar: AICarInstance; spline: CatmullRomSpline }) {
  const chassisRef = useRef<RapierRigidBody>(null);
  const prevT = useRef(0);
  const { world, rapier } = useRapier();

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const paused = useGameStore.getState().paused;
    const raceStarted = useRaceStore.getState().started;
    if (paused || !raceStarted || !chassisRef.current) return;

    if (!aiCar.controller['chassisBody']) {
      aiCar.controller.setChassisBody(chassisRef.current, world, rapier);
    }

    const pos = chassisRef.current.translation();
    const rot = chassisRef.current.rotation();
    const vel = chassisRef.current.linvel();

    const position = new THREE.Vector3(pos.x, pos.y, pos.z);
    const velocity = new THREE.Vector3(vel.x, vel.y, vel.z);
    const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);

    aiCar.currentT = spline.nearestT(position, 100);

    // Lap crossing detection for AI
    const raceTime = useRaceStore.getState().raceTime;
    useRaceStore.getState().crossCheckpoint(aiCar.id, aiCar.currentT, prevT.current, raceTime);
    prevT.current = aiCar.currentT;

    aiCar.driver.update(position, velocity, forward, aiCar.currentT, dt);
    aiCar.controller.update(aiCar.driver.input, dt);

    useRaceStore.getState().updateRacer(aiCar.id, { distanceAlongTrack: aiCar.currentT });
  });

  const startIdx = parseInt(aiCar.id.split('_')[1]) + 1;
  const startPos = trackData.startPositions[startIdx] || [startIdx % 2 === 0 ? 2 : -2, 0.5, -(startIdx + 1) * 6];
  const dims = getCollisionDims(sedanConfig as unknown as VehicleConfig);

  return (
    <RigidBody
      ref={chassisRef}
      type="dynamic"
      colliders={false}
      mass={sedanConfig.specs.mass}
      position={[
        (startPos as [number, number, number])[0],
        dims.centerY + 0.02,
        (startPos as [number, number, number])[2],
      ]}
      linearDamping={0.1}
      angularDamping={0.5}
      linearVelocity={[0, 0, 0]}
      angularVelocity={[0, 0, 0]}
    >
      <CuboidCollider args={[dims.w / 2, dims.h / 2, dims.l / 2]} position={[0, dims.centerY, 0]} />
      <ProceduralCar
        config={sedanConfig as unknown as VehicleConfig}
        color={aiCar.color}
      />
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
        controller,
        driver,
        color: AI_COLORS[i],
        currentT: 0,
      });
    }
    return cars;
  }, [racingLine]);

  useMemo(() => {
    useRaceStore.getState().startRace(trackData.laps, AI_COUNT);
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
