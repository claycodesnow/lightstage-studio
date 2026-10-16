import { useEffect, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { PropObject, CutoutObject, FlagObject, CameraObject } from '../types';
import { FLAG_MAP, SENSOR_MAP, ASPECTS, STAND_MAP } from '../data/modifiers';
import { loadImage } from '../lib/homography';
import { Stand } from './LightRig';

type V3 = [number, number, number];

function Mat({ c, r = 0.7, m = 0, e }: { c: string; r?: number; m?: number; e?: number }) {
  return <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={e ? c : '#000'} emissiveIntensity={e ?? 0} />;
}
function Box({ p, s, c, r, m, rot }: { p: V3; s: V3; c: string; r?: number; m?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={s} />
      <Mat c={c} r={r} m={m} />
    </mesh>
  );
}
function Cyl({ p, rt, rb, h, c, r, m, rot, seg = 16 }: { p: V3; rt: number; rb?: number; h: number; c: string; r?: number; m?: number; rot?: V3; seg?: number }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[rt, rb ?? rt, h, seg]} />
      <Mat c={c} r={r} m={m} />
    </mesh>
  );
}
function Sph({ p, r, c, s, m }: { p: V3; r: number; c: string; s?: V3; m?: number; r_?: number }) {
  return (
    <mesh position={p} scale={s} castShadow receiveShadow>
      <sphereGeometry args={[r, 20, 14]} />
      <Mat c={c} r={0.7} m={m} />
    </mesh>
  );
}

function Legs4({ w, d, h, c, t = 0.04, inset = 0.03 }: { w: number; d: number; h: number; c: string; t?: number; inset?: number }) {
  return (
    <>
      {[
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z], i) => (
        <Box key={i} p={[x * (w / 2 - inset), h / 2, z * (d / 2 - inset)]} s={[t, h, t]} c={c} />
      ))}
    </>
  );
}

function Guitar({ c, body = 1, neckLen = 0.5, onStand = true, electric = false }: { c: string; body?: number; neckLen?: number; onStand?: boolean; electric?: boolean }) {
  const lean = -0.18;
  return (
    <group>
      {onStand && (
        <>
          <Box p={[0, 0.05, 0.08]} s={[0.3, 0.02, 0.02]} c="#111" />
          <Cyl p={[0, 0.3, 0.12]} rt={0.008} h={0.6} c="#111" rot={[0.25, 0, 0]} />
        </>
      )}
      <group position={[0, 0.06, 0]} rotation={[lean, 0, 0]}>
        {electric ? (
          <mesh position={[0, 0.22 * body, 0]} scale={[1, 1.2, 0.25]} castShadow>
            <sphereGeometry args={[0.17 * body, 20, 14]} />
            <meshPhysicalMaterial color={c} clearcoat={1} roughness={0.3} />
          </mesh>
        ) : (
          <>
            <mesh position={[0, 0.2 * body, 0]} scale={[1, 1, 0.45]} castShadow>
              <sphereGeometry args={[0.2 * body, 24, 16]} />
              <meshPhysicalMaterial color={c} clearcoat={0.8} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.45 * body, 0]} scale={[1, 1, 0.55]} castShadow>
              <sphereGeometry args={[0.15 * body, 24, 16]} />
              <meshPhysicalMaterial color={c} clearcoat={0.8} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.37 * body, -0.095 * body]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.045 * body, 20]} />
              <meshStandardMaterial color="#0b0806" />
            </mesh>
          </>
        )}
        <Box p={[0, 0.55 * body + neckLen / 2, 0]} s={[0.05, neckLen, 0.025]} c="#3b2414" r={0.5} />
        <Box p={[0, 0.55 * body + neckLen + 0.08, 0]} s={[0.07, 0.16, 0.025]} c="#2a1a0f" />
      </group>
    </group>
  );
}

function PropGeometry({ p }: { p: PropObject }) {
  const c = p.color;
  switch (p.propId) {
    case 'acoustic-guitar':
      return <Guitar c={c} />;
    case 'electric-guitar':
      return <Guitar c={c} electric />;
    case 'bass-guitar':
      return <Guitar c={c} electric neckLen={0.68} />;
    case 'ukulele':
      return <Guitar c={c} body={0.5} neckLen={0.22} />;
    case 'violin':
      return (
        <group>
          <Cyl p={[0, 0.25, 0]} rt={0.01} h={0.5} c="#111" />
          <group position={[0, 0.5, 0]} rotation={[-0.2, 0, 0]}>
            <Sph p={[0, 0.07, 0]} r={0.1} s={[1, 1.6, 0.3]} c={c} r_={0} />
            <Box p={[0, 0.27, 0]} s={[0.025, 0.2, 0.02]} c="#111" />
          </group>
        </group>
      );
    case 'cello':
      return (
        <group rotation={[-0.15, 0, 0]}>
          <Cyl p={[0, 0.1, 0]} rt={0.006} h={0.2} c="#888" m={0.8} />
          <Sph p={[0, 0.45, 0]} r={0.22} s={[1, 1.5, 0.45]} c={c} />
          <Box p={[0, 1.0, 0]} s={[0.05, 0.4, 0.03]} c="#111" />
        </group>
      );
    case 'upright-piano':
      return (
        <group>
          <Box p={[0, 0.62, 0.15]} s={[1.5, 1.25, 0.3]} c={c} r={0.15} />
          <Box p={[0, 0.74, -0.12]} s={[1.45, 0.06, 0.28]} c={c} r={0.15} />
          <Box p={[0, 0.775, -0.15]} s={[1.3, 0.02, 0.17]} c="#f4f1ea" r={0.3} />
          <Box p={[0, 0.35, -0.18]} s={[0.06, 0.7, 0.06]} c={c} />
        </group>
      );
    case 'grand-piano':
      return (
        <group>
          <mesh position={[0, 0.85, 0]} scale={[1, 1, 1.2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.75, 0.75, 0.3, 32, 1, false, 0, Math.PI]} />
            <meshPhysicalMaterial color={c} clearcoat={1} roughness={0.15} />
          </mesh>
          <Box p={[0, 0.85, 0.05]} s={[1.5, 0.3, 0.1]} c={c} />
          <Box p={[0, 0.74, -0.2]} s={[1.4, 0.08, 0.3]} c={c} />
          <Box p={[0, 0.79, -0.22]} s={[1.25, 0.02, 0.15]} c="#f4f1ea" />
          <Cyl p={[-0.6, 0.35, -0.1]} rt={0.05} h={0.7} c={c} />
          <Cyl p={[0.6, 0.35, -0.1]} rt={0.05} h={0.7} c={c} />
          <Cyl p={[0, 0.35, 0.8]} rt={0.05} h={0.7} c={c} />
        </group>
      );
    case 'keyboard-stand':
      return (
        <group>
          <Box p={[0, 0.88, 0]} s={[1.35, 0.1, 0.33]} c={c} r={0.4} />
          <Box p={[0, 0.94, -0.03]} s={[1.24, 0.015, 0.15]} c="#f2f0ea" />
          <Box p={[-0.45, 0.42, 0]} s={[0.04, 0.84, 0.04]} c="#111" rot={[0, 0, 0.5]} />
          <Box p={[-0.45, 0.42, 0]} s={[0.04, 0.84, 0.04]} c="#111" rot={[0, 0, -0.5]} />
          <Box p={[0.45, 0.42, 0]} s={[0.04, 0.84, 0.04]} c="#111" rot={[0, 0, 0.5]} />
          <Box p={[0.45, 0.42, 0]} s={[0.04, 0.84, 0.04]} c="#111" rot={[0, 0, -0.5]} />
        </group>
      );
    case 'drum-kit':
      return (
        <group>
          <Cyl p={[0, 0.28, 0.2]} rt={0.28} h={0.4} c={c} r={0.3} rot={[Math.PI / 2, 0, 0]} />
          <Cyl p={[-0.35, 0.62, -0.05]} rt={0.18} h={0.14} c="#e5e5e5" m={0.3} />
          <Cyl p={[-0.15, 0.78, 0.15]} rt={0.13} h={0.16} c={c} rot={[0.3, 0, 0]} />
          <Cyl p={[0.18, 0.78, 0.15]} rt={0.15} h={0.18} c={c} rot={[0.3, 0, 0]} />
          <Cyl p={[0.5, 0.42, -0.1]} rt={0.2} h={0.4} c={c} />
          <Cyl p={[-0.6, 0.95, 0.0]} rt={0.18} h={0.01} c="#d9b45a" m={0.9} r={0.3} />
          <Cyl p={[-0.6, 0.48, 0.0]} rt={0.01} h={0.95} c="#999" m={0.8} />
          <Cyl p={[0.55, 1.25, 0.35]} rt={0.22} h={0.01} c="#d9b45a" m={0.9} r={0.3} rot={[0.3, 0, -0.2]} />
          <Cyl p={[0.55, 0.62, 0.35]} rt={0.01} h={1.25} c="#999" m={0.8} />
          <Cyl p={[-0.4, 1.3, 0.4]} rt={0.24} h={0.01} c="#d9b45a" m={0.9} r={0.3} rot={[0.3, 0, 0.2]} />
          <Cyl p={[-0.4, 0.65, 0.4]} rt={0.01} h={1.3} c="#999" m={0.8} />
          <Cyl p={[0, 0.25, -0.55]} rt={0.18} h={0.06} c="#222" />
          <Cyl p={[0, 0.12, -0.55]} rt={0.02} h={0.24} c="#999" m={0.8} />
        </group>
      );
    case 'snare':
      return (
        <group>
          <Cyl p={[0, 0.6, 0]} rt={0.18} h={0.14} c={c} m={0.4} r={0.3} />
          <Cyl p={[0, 0.3, 0]} rt={0.012} h={0.55} c="#999" m={0.8} />
        </group>
      );
    case 'cajon':
      return <Box p={[0, 0.24, 0]} s={[0.3, 0.48, 0.3]} c={c} r={0.6} />;
    case 'guitar-amp':
      return (
        <group>
          <Box p={[0, 0.25, 0]} s={[0.6, 0.5, 0.27]} c={c} r={0.8} />
          <Box p={[0, 0.2, -0.136]} s={[0.54, 0.34, 0.005]} c="#5a5244" r={1} />
          <Box p={[0, 0.45, -0.136]} s={[0.54, 0.06, 0.005]} c="#c9b98a" m={0.6} />
        </group>
      );
    case 'music-stand':
      return (
        <group>
          <Cyl p={[0, 0.55, 0]} rt={0.01} h={1.1} c={c} m={0.6} />
          <Box p={[0, 1.15, -0.02]} s={[0.5, 0.32, 0.01]} c={c} rot={[0.35, 0, 0]} />
          <Box p={[0, 1.15, -0.035]} s={[0.42, 0.28, 0.003]} c="#f7f5ef" rot={[0.35, 0, 0]} />
          <Stand kind="light-stand" height={0.2} show />
        </group>
      );
    case 'studio-monitors':
      return (
        <group>
          {[-0.45, 0.45].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <Box p={[0, 0.17, 0]} s={[0.2, 0.33, 0.25]} c={c} r={0.5} />
              <Cyl p={[0, 0.12, -0.126]} rt={0.07} h={0.01} c="#333" rot={[Math.PI / 2, 0, 0]} />
              <Cyl p={[0, 0.26, -0.126]} rt={0.025} h={0.01} c="#555" rot={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
        </group>
      );
    case 'saxophone':
      return (
        <group>
          <Cyl p={[0, 0.35, 0]} rt={0.04} rb={0.07} h={0.55} c={c} m={0.9} r={0.25} />
          <Cyl p={[0, 0.08, 0]} rt={0.07} rb={0.09} h={0.12} c={c} m={0.9} r={0.25} />
          <Cyl p={[0, 0.7, 0.03]} rt={0.015} h={0.2} c={c} m={0.9} r={0.25} />
        </group>
      );
    case 'guitar-wall-hangers':
      return (
        <group position={[0, 1.0, 0]}>
          {[-0.45, 0, 0.45].map((x, i) => (
            <group key={x} position={[x, -0.6, 0]} scale={0.9}>
              <Guitar c={['#9b6a3c', '#a3121e', '#1d1d1f'][i]} onStand={false} electric={i > 0} />
            </group>
          ))}
        </group>
      );
    case 'podcast-mic-arm':
      return (
        <group>
          <Box p={[0, 0.02, 0.15]} s={[0.06, 0.04, 0.06]} c="#111" />
          <Cyl p={[0, 0.2, 0.05]} rt={0.008} h={0.4} c={c} rot={[0.5, 0, 0]} />
          <Cyl p={[0, 0.38, -0.15]} rt={0.008} h={0.35} c={c} rot={[-1.0, 0, 0]} />
          <Cyl p={[0, 0.38, -0.32]} rt={0.032} h={0.18} c={c} r={0.5} />
        </group>
      );
    case 'mic-boom-stand':
      return (
        <group>
          <Stand kind="light-stand" height={1.1} show />
          <Cyl p={[0, 1.2, -0.25]} rt={0.008} h={0.7} c="#111" rot={[1.1, 0, 0]} />
          <Cyl p={[0, 1.35, -0.55]} rt={0.022} h={0.17} c="#333" m={0.5} rot={[1.1, 0, 0]} />
        </group>
      );
    case 'boom-pole-overhead':
      return (
        <group>
          <Stand kind="c-stand" height={2.1} show />
          <Cyl p={[0, 2.1, -0.9]} rt={0.012} h={1.9} c="#2b2b2b" rot={[Math.PI / 2, 0, 0]} />
          <Cyl p={[0, 2.0, -1.8]} rt={0.02} h={0.25} c="#555" rot={[0.4, 0, 0]} />
        </group>
      );
    case 'laptop':
      return (
        <group>
          <Box p={[0, 0.008, 0]} s={[0.32, 0.016, 0.22]} c={c} m={0.7} r={0.3} />
          <Box p={[0, 0.11, 0.105]} s={[0.32, 0.21, 0.008]} c={c} m={0.7} r={0.3} rot={[-0.25, 0, 0]} />
          <mesh position={[0, 0.11, 0.1]} rotation={[-0.25, Math.PI, 0]}>
            <planeGeometry args={[0.29, 0.18]} />
            <meshStandardMaterial color="#000" emissive="#cfe0ff" emissiveIntensity={60} />
          </mesh>
        </group>
      );
    case 'mug':
      return <Cyl p={[0, 0.05, 0]} rt={0.042} h={0.1} c={c} r={0.3} />;
    case 'books-stack':
      return (
        <group>
          {['#45607a', '#8a3d2f', '#c9b48a', '#2d4a3a'].map((col, i) => (
            <Box key={i} p={[0, 0.02 + i * 0.038, 0]} s={[0.24 - i * 0.01, 0.036, 0.17]} c={col} rot={[0, i * 0.12, 0]} />
          ))}
        </group>
      );
    case 'headphones':
      return (
        <group position={[0, 0.1, 0]}>
          <mesh rotation={[0, 0, 0]} castShadow>
            <torusGeometry args={[0.09, 0.012, 8, 24, Math.PI]} />
            <Mat c={c} />
          </mesh>
          <Cyl p={[-0.09, -0.01, 0]} rt={0.045} h={0.04} c={c} rot={[0, 0, Math.PI / 2]} />
          <Cyl p={[0.09, -0.01, 0]} rt={0.045} h={0.04} c={c} rot={[0, 0, Math.PI / 2]} />
        </group>
      );
    case 'acoustic-panel':
      return <Box p={[0, 1.2, 0]} s={[0.6, 1.2, 0.05]} c={c} r={1} />;
    case 'neon-sign':
      return (
        <group position={[0, 1.6, 0]}>
          <Box p={[0, 0, 0.01]} s={[0.62, 0.22, 0.01]} c="#111" />
          <mesh position={[0, 0, -0.005]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.55, 0.12]} />
            <meshStandardMaterial color="#000" emissive={c} emissiveIntensity={400} />
          </mesh>
        </group>
      );
    case 'armchair':
      return (
        <group>
          <Box p={[0, 0.22, 0]} s={[0.85, 0.24, 0.85]} c={c} r={0.95} />
          <Box p={[0, 0.38, 0.03]} s={[0.62, 0.1, 0.72]} c={c} r={0.95} />
          <Box p={[0, 0.6, 0.36]} s={[0.85, 0.6, 0.14]} c={c} r={0.95} />
          <Box p={[-0.37, 0.45, 0]} s={[0.12, 0.3, 0.85]} c={c} r={0.95} />
          <Box p={[0.37, 0.45, 0]} s={[0.12, 0.3, 0.85]} c={c} r={0.95} />
          <Legs4 w={0.8} d={0.8} h={0.1} c="#2a1f17" />
        </group>
      );
    case 'sofa':
      return (
        <group>
          <Box p={[0, 0.25, 0]} s={[2.1, 0.26, 0.9]} c={c} r={0.95} />
          {[-0.62, 0, 0.62].map((x) => (
            <Box key={x} p={[x, 0.42, 0.02]} s={[0.6, 0.1, 0.72]} c={c} r={0.95} />
          ))}
          <Box p={[0, 0.62, 0.38]} s={[2.1, 0.5, 0.16]} c={c} r={0.95} />
          <Box p={[-1.0, 0.48, 0]} s={[0.14, 0.3, 0.9]} c={c} r={0.95} />
          <Box p={[1.0, 0.48, 0]} s={[0.14, 0.3, 0.9]} c={c} r={0.95} />
          <Legs4 w={2.0} d={0.8} h={0.12} c="#2a1f17" />
        </group>
      );
    case 'dining-chair':
      return (
        <group>
          <Box p={[0, 0.45, 0]} s={[0.45, 0.04, 0.45]} c={c} r={0.6} />
          <Box p={[0, 0.72, 0.21]} s={[0.45, 0.5, 0.03]} c={c} r={0.6} />
          <Legs4 w={0.45} d={0.45} h={0.44} c={c} t={0.035} />
        </group>
      );
    case 'stool':
      return (
        <group>
          <Cyl p={[0, 0.73, 0]} rt={0.19} h={0.05} c={c} r={0.6} />
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2 + Math.PI / 4;
            return <Cyl key={i} p={[Math.sin(a) * 0.12, 0.36, Math.cos(a) * 0.12]} rt={0.015} h={0.73} c={c} rot={[Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12]} />;
          })}
          <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.15, 0.01, 6, 24]} />
            <Mat c="#555" m={0.6} />
          </mesh>
        </group>
      );
    case 'piano-bench':
      return (
        <group>
          <Box p={[0, 0.48, 0]} s={[0.75, 0.05, 0.35]} c={c} r={0.3} />
          <Legs4 w={0.72} d={0.32} h={0.46} c={c} />
        </group>
      );
    case 'desk':
      return (
        <group>
          <Box p={[0, 0.73, 0]} s={[1.4, 0.04, 0.7]} c={c} r={0.5} />
          <Legs4 w={1.4} d={0.7} h={0.71} c="#222" />
        </group>
      );
    case 'coffee-table':
      return (
        <group>
          <Box p={[0, 0.4, 0]} s={[1.1, 0.04, 0.6]} c={c} r={0.4} />
          <Box p={[0, 0.12, 0]} s={[1.0, 0.02, 0.5]} c={c} r={0.4} />
          <Legs4 w={1.1} d={0.6} h={0.38} c={c} />
        </group>
      );
    case 'side-table':
      return (
        <group>
          <Cyl p={[0, 0.54, 0]} rt={0.22} h={0.03} c={c} />
          <Cyl p={[0, 0.27, 0]} rt={0.025} h={0.52} c={c} />
          <Cyl p={[0, 0.01, 0]} rt={0.15} h={0.02} c={c} />
        </group>
      );
    case 'bookshelf':
      return (
        <group>
          <Box p={[-0.44, 0.95, 0]} s={[0.02, 1.9, 0.35]} c={c} />
          <Box p={[0.44, 0.95, 0]} s={[0.02, 1.9, 0.35]} c={c} />
          <Box p={[0, 0.95, 0.17]} s={[0.9, 1.9, 0.01]} c={c} />
          {[0.02, 0.4, 0.8, 1.2, 1.6, 1.89].map((y) => (
            <Box key={y} p={[0, y, 0]} s={[0.88, 0.02, 0.35]} c={c} />
          ))}
          {[0.4, 0.8, 1.2, 1.6].map((y, row) =>
            Array.from({ length: 9 }).map((_, i) => (
              <Box
                key={y + '-' + i}
                p={[-0.38 + i * 0.085, y - 0.14 + ((i * 7 + row) % 3) * 0.01, 0]}
                s={[0.06, 0.24 + ((i * 3 + row) % 4) * 0.02, 0.24]}
                c={['#45607a', '#8a3d2f', '#c9b48a', '#2d4a3a', '#6f5a7a', '#d6cfc0'][(i + row * 2) % 6]}
              />
            )),
          )}
        </group>
      );
    case 'credenza':
      return (
        <group>
          <Box p={[0, 0.42, 0]} s={[1.6, 0.6, 0.45]} c={c} r={0.5} />
          <Legs4 w={1.5} d={0.4} h={0.12} c="#222" t={0.03} />
        </group>
      );
    case 'rug':
      return <Box p={[0, 0.005, 0]} s={[3, 0.01, 2]} c={c} r={1} />;
    case 'bed':
      return (
        <group>
          <Box p={[0, 0.2, 0]} s={[1.6, 0.3, 2.1]} c="#4a3a2c" />
          <Box p={[0, 0.45, 0]} s={[1.55, 0.25, 2.0]} c={c} r={1} />
          <Box p={[0, 0.7, 1.03]} s={[1.6, 1.0, 0.06]} c="#4a3a2c" />
        </group>
      );
    case 'plant-tall':
      return (
        <group>
          <Cyl p={[0, 0.2, 0]} rt={0.2} rb={0.16} h={0.4} c="#d8d2c4" />
          <Cyl p={[0, 0.8, 0]} rt={0.02} h={1.0} c="#5a4630" />
          {Array.from({ length: 22 }).map((_, i) => {
            const a = i * 2.4;
            const y = 0.8 + (i / 22) * 0.95;
            const r = 0.12 + Math.sin(i) * 0.08 + 0.12;
            return (
              <mesh key={i} position={[Math.sin(a) * r, y, Math.cos(a) * r]} rotation={[Math.sin(i) * 0.6, a, 0.5]} scale={[1, 1.4, 0.15]} castShadow>
                <sphereGeometry args={[0.09, 8, 6]} />
                <Mat c={c} r={0.5} />
              </mesh>
            );
          })}
        </group>
      );
    case 'plant-small':
      return (
        <group>
          <Cyl p={[0, 0.09, 0]} rt={0.1} rb={0.08} h={0.18} c="#b65c3a" />
          {Array.from({ length: 10 }).map((_, i) => (
            <mesh key={i} position={[Math.sin(i * 2.4) * 0.06, 0.24 + (i % 3) * 0.04, Math.cos(i * 2.4) * 0.06]} rotation={[0.6, i * 2.4, 0]} scale={[1, 2, 0.2]} castShadow>
              <sphereGeometry args={[0.04, 8, 6]} />
              <Mat c={c} r={0.5} />
            </mesh>
          ))}
        </group>
      );
    case 'vase':
      return (
        <group>
          <Cyl p={[0, 0.15, 0]} rt={0.05} rb={0.09} h={0.3} c={c} r={0.3} />
          {[-0.3, 0, 0.35].map((a, i) => (
            <Cyl key={i} p={[Math.sin(a) * 0.15, 0.55, 0]} rt={0.005} h={0.55} c="#4b3a28" rot={[0, 0, a * 0.6]} />
          ))}
        </group>
      );
    case 'wall-art':
      return (
        <group position={[0, 1.5, 0]}>
          <Box p={[0, 0, 0]} s={[0.8, 1.0, 0.04]} c="#1e1e1e" />
          <mesh position={[0, 0, -0.021]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.7, 0.9]} />
            <Mat c={c} r={0.8} />
          </mesh>
        </group>
      );
    case 'floor-lamp-prop':
      return (
        <group>
          <Cyl p={[0, 0.01, 0]} rt={0.15} h={0.02} c="#222" />
          <Cyl p={[0, 0.75, 0]} rt={0.012} h={1.5} c="#222" m={0.6} />
          <Cyl p={[0, 1.5, 0]} rt={0.15} rb={0.22} h={0.28} c={c} />
        </group>
      );
    case 'curtain':
      return (
        <group>
          {Array.from({ length: 12 }).map((_, i) => (
            <Cyl key={i} p={[-0.55 + i * 0.1, 1.2, Math.sin(i * 1.7) * 0.015]} rt={0.05} h={2.4} c={c} r={1} seg={10} />
          ))}
        </group>
      );
    case 'mirror':
      return (
        <group position={[0, 0.85, 0]} rotation={[-0.08, 0, 0]}>
          <Box p={[0, 0, 0.015]} s={[0.62, 1.72, 0.03]} c="#2b2b2b" />
          <mesh position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.56, 1.66]} />
            <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.02} />
          </mesh>
        </group>
      );
    case 'apple-box-full':
      return <Box p={[0, 0.1, 0]} s={[0.51, 0.2, 0.3]} c={c} r={0.8} />;
    case 'sandbag':
      return <Sph p={[0, 0.06, 0]} r={0.12} s={[1.6, 0.5, 0.8]} c={c} />;
    case 'camera-tripod-prop':
      return (
        <group>
          <Stand kind="light-stand" height={1.35} show />
          <Box p={[0, 1.45, 0]} s={[0.14, 0.11, 0.1]} c={c} />
          <Cyl p={[0, 1.45, -0.12]} rt={0.04} h={0.14} c="#111" rot={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case 'teleprompter':
      return (
        <group>
          <Stand kind="light-stand" height={1.3} show />
          <Box p={[0, 1.38, 0]} s={[0.4, 0.04, 0.4]} c={c} />
          <Box p={[0, 1.55, -0.15]} s={[0.4, 0.3, 0.005]} c="#99aabb" rot={[0.78, 0, 0]} m={0.9} r={0.05} />
        </group>
      );
    case 'backdrop-paper':
      return (
        <group>
          <Box p={[-1.4, 1.3, 0.75]} s={[0.04, 2.6, 0.04]} c="#222" />
          <Box p={[1.4, 1.3, 0.75]} s={[0.04, 2.6, 0.04]} c="#222" />
          <Cyl p={[0, 2.58, 0.75]} rt={0.06} h={2.72} c={c} rot={[0, 0, Math.PI / 2]} />
          <Box p={[0, 1.3, 0.73]} s={[2.72, 2.56, 0.005]} c={c} r={1} />
          <Box p={[0, 0.003, 0.0]} s={[2.72, 0.005, 1.5]} c={c} r={1} />
        </group>
      );
    case 'gray-card':
      return (
        <group>
          <Stand kind="light-stand" height={1.3} show />
          <Box p={[0, 1.35, 0]} s={[0.2, 0.25, 0.005]} c="#777777" r={1} />
        </group>
      );
    case 'color-checker':
      return (
        <group>
          <Stand kind="light-stand" height={1.3} show />
          <ColorChecker />
        </group>
      );
    default:
      return <Box p={[0, 0.25, 0]} s={[0.5, 0.5, 0.5]} c={c} />;
  }
}

// X-Rite ColorChecker Classic sRGB patch values (D50 → sRGB approximations)
const CC = [
  '#735244', '#c29682', '#627a9d', '#576c43', '#8580b1', '#67bdaa',
  '#d67e2c', '#505ba6', '#c15a63', '#5e3c6c', '#9dbc40', '#e0a32e',
  '#383d96', '#469449', '#af363c', '#e7c71f', '#bb5695', '#0885a1',
  '#f3f3f2', '#c8c8c8', '#a0a0a0', '#7a7a79', '#555555', '#343434',
];
function ColorChecker() {
  return (
    <group position={[0, 1.4, 0]}>
      <Box p={[0, 0, 0.004]} s={[0.29, 0.2, 0.006]} c="#111" />
      {CC.map((c, i) => (
        <mesh key={i} position={[-0.11 + (i % 6) * 0.044, 0.066 - Math.floor(i / 6) * 0.044, -0.0005]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.038, 0.038]} />
          <meshStandardMaterial color={c} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

export function Prop({ p }: { p: PropObject }) {
  return (
    <group scale={p.scale} position={[0, p.elevation ?? 0, 0]}>
      <PropGeometry p={p} />
    </group>
  );
}

export function Cutout({ c }: { c: CutoutObject }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!c.dataUrl) return;
    loadImage(c.dataUrl).then((img) => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      setTex(t);
    });
  }, [c.dataUrl]);
  return (
    <mesh position={[0, c.heightM / 2, 0]} castShadow receiveShadow>
      <planeGeometry args={[c.widthM, c.heightM]} />
      <meshStandardMaterial key={tex?.uuid ?? 'none'} map={tex} transparent alphaTest={0.4} side={THREE.DoubleSide} roughness={0.8} />
    </mesh>
  );
}

export function Flag({ f, showStands, children }: { f: FlagObject; showStands: boolean; children?: ReactNode }) {
  const def = FLAG_MAP.get(f.flagId);
  if (!def) return null;
  const stand = STAND_MAP.get(def.standId);
  const mat = (() => {
    switch (def.material) {
      case 'black':
        return <meshStandardMaterial color="#0b0b0b" roughness={1} side={THREE.DoubleSide} />;
      case 'white':
        return <meshStandardMaterial color="#f2f2f0" roughness={0.95} side={THREE.FrontSide} />;
      case 'silver':
        return <meshStandardMaterial color="#e6e8ea" roughness={0.3} metalness={0.9} side={THREE.DoubleSide} />;
      case 'gold':
        return <meshStandardMaterial color="#e3b964" roughness={0.3} metalness={0.9} side={THREE.DoubleSide} />;
      case 'net':
        return <meshStandardMaterial color="#111" transparent opacity={1 - def.transmission} roughness={1} side={THREE.DoubleSide} depthWrite={false} />;
      case 'diffusion':
        return (
          <meshPhysicalMaterial
            color="#ffffff"
            transmission={def.transmission}
            roughness={1}
            thickness={0.001}
            transparent
            opacity={0.55 + (1 - def.transmission) * 0.4}
            side={THREE.DoubleSide}
          />
        );
      case 'cookie':
      default:
        return <meshStandardMaterial color="#5a4a3a" roughness={1} side={THREE.DoubleSide} />;
    }
  })();
  const isVflat = def.category === 'vflat';
  const castShadow = def.material !== 'diffusion' && def.material !== 'net';
  return (
    <group>
      {!isVflat && <Stand kind={stand?.kind ?? 'c-stand'} height={f.height - f.heightM / 2} reach={0.4} show={showStands} />}
      <group position={[0, f.height, 0]} rotation={[(f.tilt * Math.PI) / 180, 0, 0]}>
        {isVflat ? (
          <>
            {/* V-flat: two boards hinged */}
            <group position={[-0.02, 0, 0]} rotation={[0, 0.5, 0]}>
              <mesh position={[-f.width / 2, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[f.width, f.heightM, 0.025]} />
                <meshStandardMaterial color={def.material === 'white' ? '#f2f2f0' : '#0b0b0b'} roughness={0.95} />
              </mesh>
            </group>
            <group position={[0.02, 0, 0]} rotation={[0, -0.5, 0]}>
              <mesh position={[f.width / 2, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[f.width, f.heightM, 0.025]} />
                <meshStandardMaterial color={def.material === 'white' ? '#f2f2f0' : '#0b0b0b'} roughness={0.95} />
              </mesh>
            </group>
          </>
        ) : (
          <>
            <mesh castShadow={castShadow} receiveShadow>
              <planeGeometry args={[f.width, f.heightM]} />
              {mat}
            </mesh>
            {def.doubleSidedColor && (
              <mesh rotation={[0, Math.PI, 0]} position={[0, 0, 0.002]} castShadow>
                <planeGeometry args={[f.width, f.heightM]} />
                <meshStandardMaterial color={def.doubleSidedColor} roughness={1} />
              </mesh>
            )}
            {/* frame */}
            <mesh>
              <boxGeometry args={[f.width + 0.03, 0.02, 0.02]} />
              <meshStandardMaterial color="#444" metalness={0.6} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[(s * f.width) / 2, 0, 0]}>
                <boxGeometry args={[0.02, f.heightM, 0.02]} />
                <meshStandardMaterial color="#444" metalness={0.6} />
              </mesh>
            ))}
            {[-1, 1].map((s) => (
              <mesh key={'h' + s} position={[0, (s * f.heightM) / 2, 0]}>
                <boxGeometry args={[f.width, 0.02, 0.02]} />
                <meshStandardMaterial color="#444" metalness={0.6} />
              </mesh>
            ))}
          </>
        )}
      </group>
      {children}
    </group>
  );
}

export function cameraFov(focal: number, sensorId: string, aspect: string) {
  const s = SENSOR_MAP.get(sensorId) ?? SENSOR_MAP.get('ff')!;
  const a = ASPECTS[aspect] ?? 16 / 9;
  // fit aspect within the sensor: use sensor width for wide formats, height for tall
  const sensorAspect = s.w / s.h;
  const effH = a >= sensorAspect ? s.w / a : s.h;
  const vfov = 2 * Math.atan(effH / 2 / focal);
  return { vfovDeg: (vfov * 180) / Math.PI, aspect: a, hfovDeg: (2 * Math.atan((effH * a) / 2 / focal) * 180) / Math.PI };
}

export function CameraRig({ c, showStands }: { c: CameraObject; showStands: boolean }) {
  const { vfovDeg, aspect } = cameraFov(c.focalLength, c.sensorId, c.aspect);
  const len = 1.2;
  const hh = Math.tan(((vfovDeg / 2) * Math.PI) / 180) * len;
  const hw = hh * aspect;
  const pts = [
    [0, 0, 0],
    [-hw, -hh, -len],
    [0, 0, 0],
    [hw, -hh, -len],
    [0, 0, 0],
    [hw, hh, -len],
    [0, 0, 0],
    [-hw, hh, -len],
    [-hw, -hh, -len],
    [hw, -hh, -len],
    [hw, -hh, -len],
    [hw, hh, -len],
    [hw, hh, -len],
    [-hw, hh, -len],
    [-hw, hh, -len],
    [-hw, -hh, -len],
  ].flat();
  return (
    <group>
      <Stand kind="light-stand" height={c.height} show={showStands} />
      <group position={[0, c.height, 0]} rotation={[0, (c.pan * Math.PI) / 180, 0]}>
        <group rotation={[(c.tilt * Math.PI) / 180, 0, 0]}>
          <mesh position={[0, 0.04, 0.05]} castShadow>
            <boxGeometry args={[0.14, 0.1, 0.1]} />
            <meshStandardMaterial color="#141414" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.03, -0.06]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.04, 0.12, 16]} />
            <meshStandardMaterial color="#0d0d0d" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.03, -0.121]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[0.03, 16]} />
            <meshPhysicalMaterial color="#1a2a3a" metalness={0.5} roughness={0.05} clearcoat={1} />
          </mesh>
          {c.showFrustum && (
            <lineSegments position={[0, 0.03, -0.12]}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[new Float32Array(pts), 3]} />
              </bufferGeometry>
              <lineBasicMaterial color="#ffb547" />
            </lineSegments>
          )}
        </group>
      </group>
    </group>
  );
}
