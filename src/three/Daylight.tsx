import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RectAreaLight } from 'three';
import type { Scene } from '../types';
import type { DaylightState } from './useLighting';
import { kelvinToRGB, normalizeLuma, type RGB } from '../lib/color';
import { windowWorldRect } from '../lib/photometry';

function mul(a: RGB, b: RGB): RGB {
  return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
}

/** Sun (directional, shadowed), sky dome & ground seen through the windows, window sky-fill and bounce ambient. */
export function Daylight({ scene, dl, wb, ambientLux, pathTracing }: { scene: Scene; dl: DaylightState; wb: RGB; ambientLux: number; pathTracing: boolean }) {
  const { room, time } = scene;
  const sun = useMemo(() => new THREE.DirectionalLight(), []);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const skyColor = mul(normalizeLuma(kelvinToRGB(dl.skyK)), wb);
  const sunColor = mul(normalizeLuma(kelvinToRGB(dl.sunK)), wb);
  const skyLum = dl.skyLux / Math.PI;
  const R = Math.max(room.width, room.depth) * 1.2 + 4;

  useEffect(() => {
    sun.color.setRGB(sunColor[0], sunColor[1], sunColor[2]);
    sun.intensity = dl.altitude > -1 ? dl.sunLux : 0;
    sun.position.set(dl.sunDir[0] * 40, dl.sunDir[1] * 40, dl.sunDir[2] * 40);
    sun.target = sunTarget;
    sun.castShadow = dl.sunLux > 1;
    sun.shadow.mapSize.set(4096, 4096);
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = -R;
    cam.right = R;
    cam.top = R;
    cam.bottom = -R;
    cam.near = 1;
    cam.far = 90;
    cam.updateProjectionMatrix();
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 2 + time.cloudCover * 12;
  });

  // Sky dome: emissive so that seen through a window it reads at the true sky luminance.
  const skyMat = useRef<THREE.MeshStandardMaterial>(null!);
  const groundAlbedo = time.outdoorBounce;
  const horizon = mul(normalizeLuma(kelvinToRGB(Math.max(4000, dl.skyK - 2500))), wb);

  const skyTexture = useMemo(() => {
    // vertical gradient: zenith → horizon
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 256);
    const toCss = (rgb: RGB, k = 1) => `rgb(${rgb.map((v) => Math.round(Math.min(1, Math.pow(Math.max(0, v * k) / 1.6, 1 / 2.2)) * 255)).join(',')})`;
    const overcast = time.cloudCover;
    grd.addColorStop(0, toCss(skyColor, 0.7 + overcast * 0.6));
    grd.addColorStop(0.5, toCss(horizon, 1.1));
    grd.addColorStop(0.52, toCss([0.45, 0.42, 0.38], 1));
    grd.addColorStop(1, toCss([0.35, 0.33, 0.3], 1));
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dl.skyK, time.cloudCover, wb[0], wb[2]]);

  const windowLights = useMemo(() => room.windows.map(() => new RectAreaLight()), [room.windows.length]);
  useEffect(() => {
    room.windows.forEach((w, i) => {
      const l = windowLights[i];
      if (!l) return;
      if (w.kind === 'skylight') {
        l.position.set(-room.width / 2 + w.offset, room.height - 0.01, -room.depth / 2 + w.sill + w.height / 2);
        l.lookAt(l.position.x, 0, l.position.z);
      } else {
        const r = windowWorldRect(w, room);
        l.position.set(r.center[0] + r.normal[0] * 0.02, r.center[1], r.center[2] + r.normal[2] * 0.02);
        l.lookAt(r.center[0] + r.normal[0] * 2, r.center[1], r.center[2] + r.normal[2] * 2);
      }
      l.width = w.width;
      l.height = w.height;
      // Window as a luminous plane: ~60% sky, 40% ground/buildings
      const lum = (skyLum * 0.6 + (dl.sunLux * groundAlbedo * Math.max(0, dl.sunDir[1])) / Math.PI * 0.4) * w.transmission;
      l.intensity = pathTracing ? 0 : lum * (w.diffuse ? 1.15 : 1);
      l.color.setRGB(skyColor[0], skyColor[1], skyColor[2]);
    });
  });

  const amb = mul(normalizeLuma(kelvinToRGB(4500)), wb);

  return (
    <group>
      <primitive object={sun} />
      <primitive object={sunTarget} position={[0, 0, 0]} />
      {windowLights.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
      {!pathTracing && <ambientLight intensity={ambientLux * 0.85} color={new THREE.Color(amb[0], amb[1], amb[2])} />}
      {/* sky dome (emissive) */}
      <mesh scale={[60, 60, 60]}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshStandardMaterial
          ref={skyMat}
          color="#000000"
          emissive="#ffffff"
          emissiveMap={skyTexture}
          emissiveIntensity={skyLum * 1.1}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      {/* ground outside */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.16, 0]} receiveShadow>
        <circleGeometry args={[58, 48]} />
        <meshStandardMaterial color={new THREE.Color(groundAlbedo, groundAlbedo * 0.97, groundAlbedo * 0.92)} roughness={1} />
      </mesh>
    </group>
  );
}
