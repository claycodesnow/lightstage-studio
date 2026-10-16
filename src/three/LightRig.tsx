import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RectAreaLight } from 'three';
import { PhysicalSpotLight } from 'three-gpu-pathtracer';
import type { LightObject } from '../types';
import { computeEmission, type Emission } from '../lib/photometry';
import { STAND_MAP, type Modifier } from '../data/modifiers';
import { isPracticalLike, type Fixture } from '../data/fixtures';
import type { RGB } from '../lib/color';

const DARK = '#1c1d20';
const METAL = '#3a3c40';

export function Stand({ kind, height, reach = 0, show }: { kind: string; height: number; reach?: number; show: boolean }) {
  if (!show || kind === 'none' || kind === 'clamp' || kind === 'ceiling') return null;
  const legs = kind === 'c-stand' ? 3 : 3;
  const spread = kind === 'c-stand' ? 0.42 : kind === 'combo' ? 0.55 : kind === 'floor' ? 0.25 : 0.45;
  const legH = kind === 'floor' ? 0.05 : 0.5;
  const poleTop = kind === 'boom' ? height + 0.1 : height - 0.08;
  return (
    <group>
      {Array.from({ length: legs }).map((_, i) => {
        const a = (i / legs) * Math.PI * 2 + (kind === 'c-stand' ? 0.3 : 0);
        const len = Math.hypot(spread, legH);
        const tilt = Math.atan2(spread, legH);
        return (
          <mesh key={i} position={[(Math.sin(a) * spread) / 2, legH / 2, (Math.cos(a) * spread) / 2]} rotation={[tilt * Math.cos(a), 0, -tilt * Math.sin(a)]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, len, 6]} />
            <meshStandardMaterial color={kind === 'c-stand' ? '#8f9399' : DARK} metalness={0.6} roughness={0.4} />
          </mesh>
        );
      })}
      <mesh position={[0, (legH + poleTop) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.016, 0.02, Math.max(0.05, poleTop - legH * 0.3), 8]} />
        <meshStandardMaterial color={kind === 'c-stand' ? '#a7abb1' : DARK} metalness={0.6} roughness={0.35} />
      </mesh>
      {(kind === 'boom' || (kind === 'c-stand' && reach > 0)) && (
        <mesh position={[0, poleTop, -reach / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.013, 0.013, reach + 0.6, 8]} />
          <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
        </mesh>
      )}
      {kind === 'boom' && (
        <mesh position={[0, poleTop, 0.45]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.12, 10]} />
          <meshStandardMaterial color="#3c4a2c" roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

function emissiveMat(color: RGB, nits: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const c = new THREE.Color(color[0], color[1], color[2]);
  return <meshStandardMaterial color="#000000" emissive={c} emissiveIntensity={nits} toneMapped roughness={1} {...opts} />;
}

function ModifierMesh({ mod, e, color, on }: { mod: Modifier; e: Emission; color: RGB; on: boolean }) {
  const [w, h] = mod.size;
  const area = Math.max(0.01, w * h * (mod.shape === 'octa' || mod.shape === 'round' || mod.shape === 'dish' ? 0.785 : 1));
  // face luminance (nits) ≈ intensity / projected area
  const L = on ? e.candela / area : 0;
  const body = <meshStandardMaterial color={mod.interior === 'white' ? '#d8d8d8' : '#141414'} roughness={0.8} side={THREE.DoubleSide} />;
  switch (mod.shape) {
    case 'rect':
      return (
        <group>
          <mesh position={[0, 0, -mod.depth / 2]} rotation={[Math.PI / 2, Math.PI / 4, 0]} scale={[w / 0.2, 1, h / 0.2]} castShadow>
            <cylinderGeometry args={[0.141, 0.03, mod.depth, 4, 1, true]} />
            {body}
          </mesh>
          <mesh position={[0, 0, -mod.depth + 0.002]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[w, h]} />
            {emissiveMat(color, L)}
          </mesh>
        </group>
      );
    case 'octa':
    case 'round':
    case 'dish': {
      const seg = mod.shape === 'octa' ? 8 : 24;
      return (
        <group>
          <mesh position={[0, 0, -mod.depth / 2]} rotation={[-Math.PI / 2, mod.shape === 'octa' ? Math.PI / 8 : 0, 0]} castShadow>
            <cylinderGeometry args={[w / 2, 0.06, mod.depth, seg, 1, true]} />
            {mod.shape === 'dish' ? <meshStandardMaterial color="#e8e8e8" metalness={0.2} roughness={0.4} side={THREE.DoubleSide} /> : body}
          </mesh>
          {mod.shape === 'dish' ? (
            <mesh position={[0, 0, -0.06]}>
              <circleGeometry args={[0.07, 16]} />
              {emissiveMat(color, on ? e.candela / 0.015 : 0)}
            </mesh>
          ) : (
            <mesh position={[0, 0, -mod.depth + 0.002]} rotation={[0, Math.PI, mod.shape === 'octa' ? Math.PI / 8 : 0]}>
              <circleGeometry args={[w / 2, seg]} />
              {emissiveMat(color, L)}
            </mesh>
          )}
        </group>
      );
    }
    case 'sphere':
      return (
        <mesh position={[0, 0, -w / 2]}>
          <sphereGeometry args={[w / 2, 24, 16]} />
          {emissiveMat(color, on ? (e.flux / (Math.PI * 4 * Math.PI * (w / 2) ** 2)) * 1.0 : 0)}
        </mesh>
      );
    case 'umbrella': {
      const shoot = mod.type === 'umbrella-shoot';
      // bounce umbrellas face back toward the light: canopy opens toward -z of head when shoot-through,
      // reflective umbrellas have the light pointing away from the subject — we keep the head aimed at the subject and
      // place the canopy behind, which visually matches how they are rigged.
      return (
        <group>
          <mesh position={[0, 0, shoot ? -mod.depth * 0.6 : mod.depth * 0.6]} rotation={[shoot ? -Math.PI / 2 : Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[w / 2, mod.depth, 24, 1, true]} />
            {shoot ? emissiveMat(color, L * 0.8, { side: THREE.DoubleSide, transparent: true, opacity: 0.95 }) : (
              <meshStandardMaterial
                color={mod.interior === 'white' ? '#ffffff' : '#cfd3d8'}
                emissive={new THREE.Color(color[0], color[1], color[2])}
                emissiveIntensity={L * 0.8}
                metalness={mod.interior === 'white' ? 0 : 0.8}
                roughness={0.4}
                side={THREE.DoubleSide}
              />
            )}
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.005, 0.005, mod.depth * 1.6, 6]} />
            <meshStandardMaterial color={METAL} />
          </mesh>
        </group>
      );
    }
    case 'lens':
      return (
        <group>
          <mesh position={[0, 0, -mod.depth / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[w / 2, w / 2.3, mod.depth, 20]} />
            <meshStandardMaterial color={DARK} metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, -mod.depth - 0.002]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[w / 2.1, 20]} />
            {emissiveMat(color, on ? e.candela / (Math.PI * (w / 2.1) ** 2) : 0)}
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

function FixtureHead({ f, e, color, on, mod }: { f: Fixture; e: Emission; color: RGB; on: boolean; mod: Modifier | null }) {
  const area = Math.max(0.0005, f.size[0] * f.size[1]);
  const L = on ? e.candela / area : 0;
  if (f.shape === 'tube' || f.shape === 'strip') {
    const len = f.size[0];
    return (
      <group rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow={false}>
          <cylinderGeometry args={[0.016, 0.016, len, 12]} />
          {emissiveMat(color, on ? e.candela / (len * 0.03) : 0)}
        </mesh>
        <mesh position={[0, len / 2 + 0.02, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.04, 10]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <mesh position={[0, -len / 2 - 0.02, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.04, 10]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
      </group>
    );
  }
  if (f.shape === 'bulb' && (f.houseMount === 'recessed' || f.houseMount === 'track')) {
    // can light / track head: housing behind, emitting lens facing forward (-z)
    const r = Math.max(0.03, f.size[0] / 2);
    const recessed = f.houseMount === 'recessed';
    return (
      <group>
        <mesh position={[0, 0, recessed ? 0.0 : 0.07]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * (recessed ? 1.25 : 1), r, recessed ? 0.012 : 0.14, 24]} />
          <meshStandardMaterial color={recessed ? '#f2f1ec' : '#1d1d1f'} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, recessed ? -0.007 : -0.002]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[r * 0.85, 24]} />
          {emissiveMat(color, on ? e.candela / (Math.PI * (r * 0.85) ** 2) : 0)}
        </mesh>
      </group>
    );
  }
  if (f.shape === 'bulb') {
    const r = Math.max(0.03, f.size[0] / 2);
    const isShade = f.model.includes('Shade') || f.model.includes('Floor Lamp');
    const isLantern = f.model.includes('Lantern');
    const isDesk = f.model.includes('Desk');
    const flux = e.flux;
    return (
      <group>
        <mesh>
          <sphereGeometry args={[isLantern ? r : Math.min(r, 0.04), 20, 14]} />
          {emissiveMat(color, on ? flux / (4 * Math.PI * Math.PI * (isLantern ? r : 0.04) ** 2) : 0)}
        </mesh>
        {isShade && (
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.15, 0.22, 0.28, 24, 1, true]} />
            <meshStandardMaterial color="#efe6d2" emissive={new THREE.Color(color[0], color[1], color[2])} emissiveIntensity={on ? flux / 40 : 0} side={THREE.DoubleSide} transparent opacity={0.92} />
          </mesh>
        )}
        {isDesk && (
          <mesh position={[0, 0.03, 0]}>
            <coneGeometry args={[0.08, 0.1, 20, 1, true]} />
            <meshStandardMaterial color="#222" side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    );
  }
  if (f.shape === 'ring') {
    return (
      <mesh>
        <torusGeometry args={[f.size[0] / 2, 0.025, 10, 40]} />
        {emissiveMat(color, on ? e.candela / (Math.PI * f.size[0] * 0.05) : 0)}
      </mesh>
    );
  }
  if (f.shape === 'panel') {
    return (
      <group>
        <mesh position={[0, 0, 0.025]} castShadow>
          <boxGeometry args={[f.size[0] + 0.02, f.size[1] + 0.02, 0.04]} />
          <meshStandardMaterial color={DARK} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[f.size[0], f.size[1]]} />
          {emissiveMat(color, L)}
        </mesh>
      </group>
    );
  }
  // point / COB: body + reflector (or modifier)
  const bodyLen = f.category === 'strobe' ? 0.22 : f.category === 'mini' ? 0.12 : f.watts > 500 ? 0.36 : 0.28;
  const bodyR = f.category === 'mini' ? 0.04 : f.watts > 500 ? 0.12 : 0.085;
  return (
    <group>
      <mesh position={[0, 0, bodyLen / 2]} castShadow>
        <boxGeometry args={[bodyR * 2, bodyR * 2, bodyLen]} />
        <meshStandardMaterial color={DARK} roughness={0.55} metalness={0.3} />
      </mesh>
      {!mod && (
        <>
          <mesh position={[0, 0, -0.06]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.04, 0.12, 20, 1, true]} />
            <meshStandardMaterial color="#c9ccd1" metalness={0.9} roughness={0.25} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, -0.005]}>
            <circleGeometry args={[0.035, 16]} />
            {emissiveMat(color, on ? e.candela / 0.004 : 0)}
          </mesh>
        </>
      )}
      {f.category === 'fresnel' && !mod && (
        <mesh position={[0, 0, -0.01]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[bodyR * 0.9, 20]} />
          {emissiveMat(color, on ? e.candela / (Math.PI * (bodyR * 0.9) ** 2) : 0)}
        </mesh>
      )}
    </group>
  );
}

/** A light fixture on its stand. Group origin = base on floor. Head is at (0, headHeight, 0), aimed along local -z after pan/tilt. */
export function LightRig({
  light,
  showStands,
  shutter,
  wbComp,
  calibration,
  shadows,
}: {
  light: LightObject;
  showStands: boolean;
  shutter: number;
  wbComp: RGB;
  calibration: number;
  shadows: boolean;
}) {
  const e = useMemo(() => computeEmission(light, shutter, calibration), [light, shutter, calibration]);
  const stand = STAND_MAP.get(light.standId);
  const spot = useMemo(() => new PhysicalSpotLight(), []);
  const point = useMemo(() => new THREE.PointLight(), []);
  const rect = useMemo(() => new RectAreaLight(), []);
  const target = useRef<THREE.Object3D>(null!);
  const headRef = useRef<THREE.Group>(null!);

  const f = e?.fixture;
  const kind: 'spot' | 'point' | 'rect' = !f
    ? 'spot'
    : f.shape === 'tube' || f.shape === 'strip' || (isPracticalLike(f) && f.shape === 'panel')
      ? 'rect'
      : e!.beam >= 175
        ? 'point'
        : 'spot';

  const color: RGB = e ? [e.color[0] * wbComp[0], e.color[1] * wbComp[1], e.color[2] * wbComp[2]] : [1, 1, 1];
  const on = light.enabled && !!e && e.candela > 0;

  useEffect(() => {
    if (!e) return;
    const c = new THREE.Color(color[0], color[1], color[2]);
    const shadowR = Math.max(1, Math.min(14, Math.max(e.sourceSize[0], e.sourceSize[1]) * 10));
    if (kind === 'spot') {
      spot.color.copy(c);
      spot.intensity = on ? e.candela : 0;
      spot.angle = Math.min(Math.PI / 2 - 0.01, ((e.beam / 2) * Math.PI) / 180 * 1.15);
      spot.penumbra = e.penumbra;
      spot.decay = 2;
      spot.distance = 0;
      spot.radius = Math.max(e.sourceSize[0], e.sourceSize[1]) / 2;
      spot.castShadow = shadows && light.castShadows && on;
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.bias = -0.0004;
      spot.shadow.normalBias = 0.02;
      spot.shadow.radius = shadowR;
      spot.shadow.camera.near = 0.05;
      spot.target = target.current;
    } else if (kind === 'point') {
      point.color.copy(c);
      point.intensity = on ? e.flux / (4 * Math.PI) : 0;
      point.decay = 2;
      point.distance = 0;
      point.castShadow = shadows && light.castShadows && on;
      point.shadow.mapSize.set(512, 512);
      point.shadow.bias = -0.002;
      point.shadow.radius = shadowR;
      point.shadow.camera.near = 0.05;
    } else {
      rect.color.copy(c);
      const area = Math.max(0.001, e.sourceSize[0] * Math.max(0.03, e.sourceSize[1]));
      rect.width = e.sourceSize[0];
      rect.height = Math.max(0.03, e.sourceSize[1]);
      rect.intensity = on ? e.candela / area : 0;
    }
  });

  if (!e || !f) return null;
  const tiltRad = (light.tilt * Math.PI) / 180;
  const panRad = (light.pan * Math.PI) / 180;
  const isTube = kind === 'rect' && (f.shape === 'tube' || f.shape === 'strip');
  const tubeVertical = isTube && light.tubeOrientation === 'vertical';

  return (
    <group>
      <Stand kind={stand?.kind ?? 'light-stand'} height={light.headHeight} reach={stand?.reach} show={showStands && !isPracticalLike(f)} />
      <group position={[0, light.headHeight, 0]} rotation={[0, panRad, 0]}>
        <group rotation={[tiltRad, 0, 0]} ref={headRef}>
          {/* yoke */}
          {!isPracticalLike(f) && f.shape !== 'tube' && f.shape !== 'strip' && (
            <mesh position={[0, -0.05, 0.05]} castShadow>
              <boxGeometry args={[0.02, 0.12, 0.02]} />
              <meshStandardMaterial color={METAL} />
            </mesh>
          )}
          <group rotation={[0, 0, tubeVertical ? Math.PI / 2 : 0]}>
            <FixtureHead f={f} e={e} color={color} on={on} mod={e.modifier} />
            {kind === 'rect' && <primitive object={rect} />}
          </group>
          {e.modifier && <ModifierMesh mod={e.modifier} e={e} color={color} on={on} />}
          {kind === 'spot' && (
            <>
              <primitive object={spot} position={[0, 0, e.modifier ? -e.modifier.depth * 0.9 : -0.05]} />
              <object3D ref={target} position={[0, 0, -5]} />
            </>
          )}
          {kind === 'point' && <primitive object={point} position={[0, 0, e.modifier?.shape === 'sphere' ? -e.modifier.size[0] / 2 : 0]} />}
        </group>
      </group>
    </group>
  );
}
