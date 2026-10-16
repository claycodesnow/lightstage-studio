import * as THREE from 'three';
import { viewportApi } from '../three/Viewport';
import { useStore } from '../store';
import type { SceneObject, Vec3 } from '../types';
import { lightDirection } from '../lib/photometry';
import { meterPoint } from '../three/useLighting';

/** A floor point ~distance in front of the current view, clamped inside the room. */
export function spawnPoint(distance = 2): Vec3 {
  const { scene } = useStore.getState();
  const cam = viewportApi.current?.camera;
  let x = 0, z = 0;
  if (cam) {
    const d = new THREE.Vector3();
    cam.getWorldDirection(d);
    d.y = 0;
    d.normalize();
    x = cam.position.x + d.x * distance;
    z = cam.position.z + d.z * distance;
  }
  const hw = scene.room.width / 2 - 0.3, hd = scene.room.depth / 2 - 0.3;
  return [Math.max(-hw, Math.min(hw, x)), 0, Math.max(-hd, Math.min(hd, z))];
}

/** Yaw (deg) that faces from a floor point toward the current viewer. */
export function yawTowardViewer(p: Vec3): number {
  const cam = viewportApi.current?.camera;
  if (!cam) return 0;
  const dx = cam.position.x - p[0], dz = cam.position.z - p[2];
  return (Math.atan2(-dx, -dz) * 180) / Math.PI;
}

/** Pan/tilt for a light (or camera) so it points at a target point. Returns rotation-relative pan. */
export function aimAt(o: SceneObject & { rotationY: number }, height: number, target: Vec3): { pan: number; tilt: number } {
  const dx = target[0] - o.position[0];
  const dy = target[1] - height;
  const dz = target[2] - o.position[2];
  const yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
  const tilt = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
  let pan = yaw - o.rotationY;
  pan = ((pan + 540) % 360) - 180;
  return { pan: Math.round(pan * 10) / 10, tilt: Math.round(tilt * 10) / 10 };
}

export function subjectTarget(): Vec3 {
  const { scene, selectedId } = useStore.getState();
  const subj = scene.objects.find((o) => o.kind === 'subject' && o.id !== selectedId) ?? scene.objects.find((o) => o.kind === 'subject');
  return meterPoint(scene, subj?.id ?? null);
}

export { lightDirection };

let side = 1;
/** Lights spawn ~1.6 m from the subject, 45° off the camera axis, alternating sides — never blocking the view. */
export function lightSpawnPoint(): Vec3 {
  const { scene } = useStore.getState();
  const subj = scene.objects.find((o) => o.kind === 'subject');
  const cam = viewportApi.current?.camera;
  if (!subj || !cam) return spawnPoint(1.8);
  const dx = cam.position.x - subj.position[0], dz = cam.position.z - subj.position[2];
  const a = Math.atan2(dx, dz) + side * (Math.PI / 4);
  side = -side;
  const hw = scene.room.width / 2 - 0.3, hd = scene.room.depth / 2 - 0.3;
  const x = subj.position[0] + Math.sin(a) * 1.6, z = subj.position[2] + Math.cos(a) * 1.6;
  return [Math.max(-hw, Math.min(hw, x)), 0, Math.max(-hd, Math.min(hd, z))];
}
