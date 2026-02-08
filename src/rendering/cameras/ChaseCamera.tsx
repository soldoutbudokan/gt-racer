import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVehicleStore } from '../../stores/useVehicleStore';
import { dampedSpring } from '../../utils/math';

export function ChaseCamera() {
  const { camera } = useThree();
  const posRef = useRef(new THREE.Vector3(0, 5, -10));
  const lookRef = useRef(new THREE.Vector3(0, 0, 0));
  const velRef = useRef({ x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0 });
  const initialized = useRef(false);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const state = useVehicleStore.getState();
    const pos = state.position;

    const carPos = new THREE.Vector3(pos.x, pos.y, pos.z);

    if (!initialized.current) {
      // Initialize camera behind the car based on its position
      posRef.current.set(pos.x, pos.y + 5, pos.z - 10);
      lookRef.current.set(pos.x, pos.y + 1, pos.z);
      initialized.current = true;
    }

    // Use vehicle rotation for forward direction
    const rotation = state.rotation;
    let cameraForward: THREE.Vector3;
    if (rotation) {
      const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      cameraForward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    } else {
      cameraForward = new THREE.Vector3()
        .subVectors(lookRef.current, posRef.current)
        .normalize();
    }

    // Target camera position: behind and above car
    const speedFactor = Math.min(state.speedKmh / 200, 1);
    const distance = 8 + speedFactor * 2;
    const height = 3 + speedFactor * 1;

    const targetPos = carPos.clone();
    targetPos.y += height;
    targetPos.x -= cameraForward.x * distance;
    targetPos.z -= cameraForward.z * distance;

    const targetLook = carPos.clone();
    targetLook.y += 1;

    const stiffness = 25;
    const damping = 12;

    let [nx, nvx] = dampedSpring(posRef.current.x, targetPos.x, velRef.current.x, stiffness, damping, dt);
    let [ny, nvy] = dampedSpring(posRef.current.y, targetPos.y, velRef.current.y, stiffness, damping, dt);
    let [nz, nvz] = dampedSpring(posRef.current.z, targetPos.z, velRef.current.z, stiffness, damping, dt);

    posRef.current.set(nx, ny, nz);
    velRef.current.x = nvx;
    velRef.current.y = nvy;
    velRef.current.z = nvz;

    let [lx, lnvx] = dampedSpring(lookRef.current.x, targetLook.x, velRef.current.lx, 40, 15, dt);
    let [ly, lnvy] = dampedSpring(lookRef.current.y, targetLook.y, velRef.current.ly, 40, 15, dt);
    let [lz, lnvz] = dampedSpring(lookRef.current.z, targetLook.z, velRef.current.lz, 40, 15, dt);

    lookRef.current.set(lx, ly, lz);
    velRef.current.lx = lnvx;
    velRef.current.ly = lnvy;
    velRef.current.lz = lnvz;

    camera.position.copy(posRef.current);
    camera.lookAt(lookRef.current);

    // Speed-dependent FOV
    const baseFov = 60;
    const maxFovIncrease = 15;
    const targetFov = baseFov + speedFactor * maxFovIncrease;
    (camera as THREE.PerspectiveCamera).fov += (targetFov - (camera as THREE.PerspectiveCamera).fov) * 0.05;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  });

  return null;
}
