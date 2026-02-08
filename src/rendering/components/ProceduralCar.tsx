import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { VehicleConfig, WheelState } from '../../physics/types';

interface ProceduralCarProps {
  config: VehicleConfig;
  wheelStates?: WheelState[];
  steeringAngle?: number;
  color?: string;
}

function createCarBody(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Side profile of car
  shape.moveTo(-2.2, 0.0);
  shape.lineTo(2.2, 0.0);
  shape.lineTo(2.1, 0.3);
  shape.lineTo(1.8, 0.5);
  shape.lineTo(0.8, 0.5);
  shape.lineTo(0.5, 0.9);
  shape.lineTo(-0.3, 1.0);
  shape.lineTo(-0.8, 1.0);
  shape.lineTo(-1.2, 0.8);
  shape.lineTo(-1.8, 0.5);
  shape.lineTo(-2.1, 0.3);
  shape.lineTo(-2.2, 0.0);

  const extrudeSettings = {
    steps: 1,
    depth: 1.6,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 3,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -0.8);
  geo.rotateY(Math.PI / 2);
  return geo;
}

function Wheel({ position, radius, steering = 0, spin = 0 }: {
  position: [number, number, number];
  radius: number;
  steering?: number;
  spin?: number;
}) {
  const wheelRef = useRef<THREE.Group>(null);

  return (
    <group position={position} rotation={[0, steering, 0]}>
      <group ref={wheelRef} rotation={[spin, 0, 0]}>
        {/* Tire */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[radius, radius * 0.35, 8, 24]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0} />
        </mesh>
        {/* Rim */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.6, radius * 0.6, radius * 0.3, 12]} />
          <meshStandardMaterial color="#c0c0c0" roughness={0.1} metalness={0.9} />
        </mesh>
        {/* Rim spokes */}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} rotation={[0, 0, Math.PI / 2 + (i * Math.PI * 2) / 5]}>
            <boxGeometry args={[radius * 0.08, radius * 0.25, radius * 1.0]} />
            <meshStandardMaterial color="#d0d0d0" roughness={0.1} metalness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function ProceduralCar({ config, wheelStates, steeringAngle = 0, color }: ProceduralCarProps) {
  const bodyGeo = useMemo(() => createCarBody(), []);
  const carColor = color || config.color || '#C41E3A';
  const hw = config.dimensions.trackWidth / 2;
  const hwb = config.dimensions.wheelbase / 2;
  const tireRadius = config.tires.front.radius;

  const getWheelY = (index: number) => {
    if (wheelStates && wheelStates[index]) {
      return wheelStates[index].visualPosition.y;
    }
    return -0.15;
  };

  return (
    <group>
      {/* Car body */}
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={carColor}
          metalness={0.9}
          roughness={0.15}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          envMapIntensity={1.0}
        />
      </mesh>

      {/* Windshield */}
      <mesh position={[0, 0.75, 0.6]} rotation={[-0.5, 0, 0]}>
        <planeGeometry args={[1.3, 0.5]} />
        <meshPhysicalMaterial
          color="#88ccff"
          transparent
          opacity={0.3}
          metalness={0.1}
          roughness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rear window */}
      <mesh position={[0, 0.75, -0.7]} rotation={[0.4, 0, 0]}>
        <planeGeometry args={[1.2, 0.4]} />
        <meshPhysicalMaterial
          color="#88ccff"
          transparent
          opacity={0.3}
          metalness={0.1}
          roughness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Headlights */}
      <mesh position={[-0.5, 0.35, 2.15]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffcc" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.5, 0.35, 2.15]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffcc" emissiveIntensity={2} />
      </mesh>

      {/* Tail lights */}
      <mesh position={[-0.55, 0.35, -2.15]}>
        <boxGeometry args={[0.2, 0.08, 0.05]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.55, 0.35, -2.15]}>
        <boxGeometry args={[0.2, 0.08, 0.05]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
      </mesh>

      {/* Side mirrors */}
      <mesh position={[-0.85, 0.6, 0.3]}>
        <boxGeometry args={[0.15, 0.08, 0.1]} />
        <meshPhysicalMaterial color={carColor} metalness={0.9} roughness={0.15} clearcoat={1.0} />
      </mesh>
      <mesh position={[0.85, 0.6, 0.3]}>
        <boxGeometry args={[0.15, 0.08, 0.1]} />
        <meshPhysicalMaterial color={carColor} metalness={0.9} roughness={0.15} clearcoat={1.0} />
      </mesh>

      {/* Wheels */}
      <Wheel position={[-hw, getWheelY(0), hwb]} radius={tireRadius} steering={steeringAngle} />
      <Wheel position={[hw, getWheelY(1), hwb]} radius={tireRadius} steering={steeringAngle} />
      <Wheel position={[-hw, getWheelY(2), -hwb]} radius={tireRadius} />
      <Wheel position={[hw, getWheelY(3), -hwb]} radius={tireRadius} />
    </group>
  );
}
