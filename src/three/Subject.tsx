import * as THREE from 'three';
import type { SubjectObject } from '../types';
import { SKIN_TONES } from '../lib/color';

/** Mannequin-style humanoid. Proportions are derived from height (≈ 7.5 heads). Origin at feet. */
export function Subject({ s }: { s: SubjectObject }) {
  const H = s.heightM;
  const head = H / 7.5;
  const skin = SKIN_TONES.find((t) => t.id === s.skinToneId)?.hex ?? '#a07e56';
  const k = s.build === 'slim' ? 0.88 : s.build === 'broad' ? 1.15 : 1;
  const skinMat = <meshPhysicalMaterial color={skin} roughness={0.55} sheen={0.3} sheenRoughness={0.6} clearcoat={0.05} />;
  const shirt = <meshStandardMaterial color={s.shirtColor} roughness={0.9} />;
  const pants = <meshStandardMaterial color={s.pantsColor} roughness={0.9} />;
  const seated = s.pose.startsWith('seated');
  const hipY = seated ? 0.47 : H * 0.52;
  const torsoLen = H * 0.3;
  const shoulderY = hipY + torsoLen;
  const shoulderW = H * 0.13 * k;
  const thigh = H * 0.245;
  const shin = H * 0.25;
  const upperArm = H * 0.17;
  const foreArm = H * 0.155;

  const limb = (len: number, r: number, mat: React.ReactNode) => (
    <mesh position={[0, -len / 2, 0]} castShadow receiveShadow>
      <capsuleGeometry args={[r, Math.max(0.01, len - r * 2), 6, 12]} />
      {mat}
    </mesh>
  );

  // arm poses: [shoulderPitch, shoulderRoll, elbow]
  let lArm: [number, number, number] = [0.05, 0.12, 0.15];
  let rArm: [number, number, number] = [0.05, -0.12, 0.15];
  if (s.pose === 'seated-guitar') {
    lArm = [-0.9, 0.5, -1.4];
    rArm = [-0.4, -0.2, -1.1];
  } else if (s.pose === 'seated-keys') {
    lArm = [-0.6, 0.15, -0.9];
    rArm = [-0.6, -0.15, -0.9];
  } else if (s.pose === 'standing-mic') {
    lArm = [-0.5, 0.2, -1.6];
    rArm = [0.05, -0.12, 0.2];
  } else if (seated) {
    lArm = [-0.35, 0.15, -0.9];
    rArm = [-0.35, -0.15, -0.9];
  } else if (s.pose === 'leaning') {
    lArm = [0.1, 0.25, 0.5];
    rArm = [0.1, -0.25, 0.5];
  }

  const legPitch = seated ? Math.PI / 2 : 0;
  const kneeBend = seated ? -Math.PI / 2 : 0;
  const lean = s.pose === 'leaning' ? 0.12 : seated ? 0.05 : 0;

  return (
    <group>
      {/* hips & torso */}
      <group position={[0, hipY, 0]} rotation={[lean, 0, 0]}>
        <mesh position={[0, 0.02, 0]} castShadow receiveShadow scale={[1, 0.7, 0.75]}>
          <sphereGeometry args={[H * 0.095 * k, 18, 14]} />
          {pants}
        </mesh>
        <mesh position={[0, torsoLen * 0.52, 0]} castShadow receiveShadow scale={[1.05 * k, 1, 0.62 * k]}>
          <capsuleGeometry args={[H * 0.085, torsoLen * 0.6, 8, 16]} />
          {shirt}
        </mesh>
        {/* neck & head */}
        <group position={[0, torsoLen + head * 0.15, 0]}>
          <mesh position={[0, head * 0.15, 0]} castShadow>
            <cylinderGeometry args={[head * 0.2, head * 0.24, head * 0.45, 12]} />
            {skinMat}
          </mesh>
          <group position={[0, head * 0.75, 0]} rotation={[0, (s.headYaw * Math.PI) / 180, 0]}>
            <mesh castShadow receiveShadow scale={[0.78, 1, 0.9]}>
              <sphereGeometry args={[head * 0.55, 32, 24]} />
              {skinMat}
            </mesh>
            {/* nose: gives the key-light a feature to shape (loop / Rembrandt reads) */}
            <mesh position={[0, -head * 0.02, -head * 0.5]} rotation={[-0.25, 0, 0]} castShadow>
              <coneGeometry args={[head * 0.07, head * 0.2, 10]} />
              {skinMat}
            </mesh>
            {/* brow ridge */}
            <mesh position={[0, head * 0.14, -head * 0.42]} scale={[1, 0.35, 0.5]} castShadow>
              <sphereGeometry args={[head * 0.28, 16, 8]} />
              {skinMat}
            </mesh>
            {/* eyes (dark) */}
            {[-1, 1].map((sx) => (
              <mesh key={sx} position={[sx * head * 0.15, head * 0.05, -head * 0.43]}>
                <sphereGeometry args={[head * 0.055, 12, 8]} />
                <meshPhysicalMaterial color="#1a1310" roughness={0.1} clearcoat={1} />
              </mesh>
            ))}
            {/* ears */}
            {[-1, 1].map((sx) => (
              <mesh key={'e' + sx} position={[sx * head * 0.43, 0, 0]} scale={[0.4, 1, 0.7]} castShadow>
                <sphereGeometry args={[head * 0.13, 10, 8]} />
                {skinMat}
              </mesh>
            ))}
            {/* hair cap */}
            <mesh position={[0, head * 0.1, head * 0.05]} scale={[0.82, 0.92, 0.95]} castShadow>
              <sphereGeometry args={[head * 0.56, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
              <meshStandardMaterial color={s.hairColor} roughness={0.75} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
        {/* arms */}
        {[
          { side: -1, a: lArm },
          { side: 1, a: rArm },
        ].map(({ side, a }) => (
          <group key={side} position={[side * shoulderW, torsoLen * 0.95, 0]} rotation={[-a[0], 0, Math.abs(a[1]) * side]}>
            {limb(upperArm, H * 0.032 * k, shirt)}
            <group position={[0, -upperArm, 0]} rotation={[-a[2], 0, 0]}>
              {limb(foreArm, H * 0.026 * k, skinMat)}
              <mesh position={[0, -foreArm - H * 0.03, 0]} scale={[0.6, 1, 0.35]} castShadow>
                <sphereGeometry args={[H * 0.035, 10, 8]} />
                {skinMat}
              </mesh>
            </group>
          </group>
        ))}
        {/* legs */}
        {[-1, 1].map((side) => (
          <group key={'l' + side} position={[side * H * 0.055 * k, 0, 0]} rotation={[legPitch, 0, 0]}>
            {limb(thigh, H * 0.045 * k, pants)}
            <group position={[0, -thigh, 0]} rotation={[kneeBend, 0, 0]}>
              {limb(shin, H * 0.035 * k, pants)}
              <mesh position={[0, -shin - 0.02, -0.06]} castShadow>
                <boxGeometry args={[0.1, 0.07, 0.26]} />
                <meshStandardMaterial color="#1b1b1b" roughness={0.6} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      {seated && (
        <group>
          <mesh position={[0, 0.44, 0.02]} castShadow receiveShadow>
            <boxGeometry args={[0.46, 0.05, 0.46]} />
            <meshStandardMaterial color="#3a2c20" roughness={0.7} />
          </mesh>
          {[
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x * 0.2, 0.21, z * 0.2 + 0.02]} castShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.42, 6]} />
              <meshStandardMaterial color="#2a1f17" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
