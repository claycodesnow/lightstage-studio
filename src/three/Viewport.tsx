import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { useStore } from '../store';
import type { CameraObject, LightObject, Scene, SceneObject, Vec3 } from '../types';
import { Room } from './Room';
import { computeEmission } from '../lib/photometry';
import { Daylight } from './Daylight';
import { LightRig } from './LightRig';
import { Subject } from './Subject';
import { CameraRig, Cutout, Flag, Prop, cameraFov } from './Props';
import { useDaylight, useMetering, wbCompensation, type DaylightState, type Metering } from './useLighting';

RectAreaLightUniformsLib.init();

export interface ViewportApi {
  capture: (opts: { width: number; aspect: number }) => Promise<string>;
  /** Render one frame at a fixed size and hand the WebGL canvas to `draw` before the viewport size is restored. */
  renderFrame: (opts: { width: number; aspect: number }, draw: (canvas: HTMLCanvasElement) => void) => void;
  /** Orbit-controls target when orbit navigation is active. */
  orbitTarget: () => THREE.Vector3 | null;
  gl: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
}
export const viewportApi: { current: ViewportApi | null } = { current: null };

const TONE: Record<string, THREE.ToneMapping> = {
  neutral: THREE.NeutralToneMapping,
  agx: THREE.AgXToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  linear: THREE.LinearToneMapping,
};

function RendererSettings({ exposure, tone }: { exposure: number; tone: string }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = TONE[tone] ?? THREE.NeutralToneMapping;
    gl.toneMappingExposure = exposure;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl, exposure, tone]);
  return null;
}

/** Object wrapper: positions the object, handles click-to-select. */
function ObjectNode({ o, children }: { o: SceneObject; children: ReactNode }) {
  const select = useStore((s) => s.set);
  return (
    <group
      name={o.id}
      position={[o.position[0], 0, o.position[2]]}
      rotation={[0, (o.rotationY * Math.PI) / 180, 0]}
      userData={{ objectId: o.id }}
      visible={!o.hidden}
      onClick={(e) => {
        e.stopPropagation();
        select({ selectedId: o.id });
      }}
    >
      {children}
    </group>
  );
}

const MAX_SHADOW_LIGHTS = 8;

function Objects({ scene, wb, calibration, shadows }: { scene: Scene; wb: [number, number, number]; calibration: Record<string, number>; shadows: boolean }) {
  // GPUs have a limited number of texture units: only the strongest lights cast real-time shadows.
  const shadowIds = useMemo(() => {
    const ranked = scene.objects
      .filter((o): o is LightObject => o.kind === 'light' && o.enabled && o.castShadows && !o.hidden)
      .map((l) => ({ id: l.id, flux: computeEmission(l, scene.view.shutter, calibration[l.fixtureId] ?? 1)?.flux ?? 0 }))
      .sort((a, b) => b.flux - a.flux);
    return new Set(ranked.slice(0, MAX_SHADOW_LIGHTS).map((r) => r.id));
  }, [scene.objects, scene.view.shutter, calibration]);
  return (
    <>
      {scene.objects.map((o) => {
        let node: ReactNode = null;
        switch (o.kind) {
          case 'light':
            node = (
              <LightRig
                light={o as LightObject}
                showStands={scene.view.showStands}
                shutter={scene.view.shutter}
                wbComp={wb}
                calibration={calibration[(o as LightObject).fixtureId] ?? 1}
                shadows={shadows && shadowIds.has(o.id)}
              />
            );
            break;
          case 'subject':
            node = <Subject s={o} />;
            break;
          case 'prop':
            node = <Prop p={o} />;
            break;
          case 'flag':
            node = <Flag f={o} showStands={scene.view.showStands} />;
            break;
          case 'camera':
            node = scene.view.activeCameraId === o.id ? null : <CameraRig c={o} showStands={scene.view.showStands} />;
            break;
          case 'cutout':
            node = <Cutout c={o} />;
            break;
        }
        return (
          <ObjectNode key={o.id} o={o}>
            {node}
          </ObjectNode>
        );
      })}
    </>
  );
}

function SelectionGizmo() {
  const selectedId = useStore((s) => s.selectedId);
  const mode = useStore((s) => s.transformMode);
  const patchObject = useStore((s) => s.patchObject);
  const scene = useThree((s) => s.scene);
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  const o = useStore((s) => s.scene.objects.find((x) => x.id === s.selectedId));
  useEffect(() => {
    setObj(selectedId ? scene.getObjectByName(selectedId) ?? null : null);
  }, [selectedId, scene, o?.kind]);
  if (!obj || !o || o.locked) return null;
  return (
    <TransformControls
      object={obj}
      mode={mode}
      showY={mode === 'rotate'}
      showX={mode === 'translate'}
      showZ={mode === 'translate'}
      size={0.7}
      onMouseUp={() => {
        const p = obj.position;
        patchObject(o.id, {
          position: [Math.round(p.x * 100) / 100, o.position[1], Math.round(p.z * 100) / 100] as Vec3,
          rotationY: Math.round(((obj.rotation.y * 180) / Math.PI) * 10) / 10,
        });
      }}
    />
  );
}

function FlyControls({ enabled }: { enabled: boolean }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const keys = useRef<Record<string, boolean>>({});
  const look = useRef({ yaw: 0, pitch: 0, dragging: false, x: 0, y: 0 });
  useEffect(() => {
    if (!enabled) return;
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    look.current.yaw = e.y;
    look.current.pitch = e.x;
    const down = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.tagName === 'INPUT') return;
      keys.current[ev.code] = true;
    };
    const up = (ev: KeyboardEvent) => (keys.current[ev.code] = false);
    const el = gl.domElement;
    const pd = (ev: PointerEvent) => {
      look.current.dragging = true;
      look.current.x = ev.clientX;
      look.current.y = ev.clientY;
    };
    const pm = (ev: PointerEvent) => {
      if (!look.current.dragging) return;
      look.current.yaw -= (ev.clientX - look.current.x) * 0.004;
      look.current.pitch = Math.max(-1.5, Math.min(1.5, look.current.pitch - (ev.clientY - look.current.y) * 0.004));
      look.current.x = ev.clientX;
      look.current.y = ev.clientY;
      camera.quaternion.setFromEuler(new THREE.Euler(look.current.pitch, look.current.yaw, 0, 'YXZ'));
    };
    const pu = () => (look.current.dragging = false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    el.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      el.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
    };
  }, [enabled, camera, gl]);
  useFrame((_, dt) => {
    if (!enabled) return;
    const k = keys.current;
    const speed = (k.ShiftLeft || k.ShiftRight ? 3 : 1.2) * dt;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    const mv = new THREE.Vector3();
    if (k.KeyW || k.ArrowUp) mv.add(fwd);
    if (k.KeyS || k.ArrowDown) mv.sub(fwd);
    if (k.KeyD || k.ArrowRight) mv.add(right);
    if (k.KeyA || k.ArrowLeft) mv.sub(right);
    if (k.KeyE || k.Space) mv.y += 1;
    if (k.KeyQ || k.KeyC) mv.y -= 1;
    if (mv.lengthSq() > 0) {
      camera.position.addScaledVector(mv.normalize(), speed);
      camera.position.y = Math.max(0.15, camera.position.y);
      useStore.getState().update((s) => ({ ...s, viewer: { ...s.viewer, position: camera.position.toArray() as Vec3 } }), { history: false });
    }
  });
  return null;
}

/** Drives the main camera's lens (focal length / sensor / aspect) and "look through" camera objects. */
function LensRig({ scene }: { scene: Scene }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const active = scene.objects.find((o) => o.id === scene.view.activeCameraId) as CameraObject | undefined;
  const focal = active ? active.focalLength : scene.view.focalLength;
  const sensor = active ? active.sensorId : scene.view.sensorId;
  const aspect = active ? active.aspect : scene.view.aspect;
  useEffect(() => {
    const { vfovDeg, hfovDeg, aspect: a } = cameraFov(focal, sensor, aspect);
    const ca = size.width / size.height;
    camera.fov = ca >= a ? vfovDeg : (2 * Math.atan(Math.tan((hfovDeg * Math.PI) / 360) / ca) * 180) / Math.PI;
    camera.near = 0.02;
    camera.far = 200;
    camera.updateProjectionMatrix();
  }, [camera, focal, sensor, aspect, size.width, size.height]);
  useEffect(() => {
    if (!active) return;
    const yaw = ((active.rotationY + active.pan) * Math.PI) / 180;
    const pitch = (active.tilt * Math.PI) / 180;
    camera.position.set(active.position[0], active.height + 0.03, active.position[2]);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }, [active, camera]);
  return null;
}

function PathTracer({ active, scene, onSamples }: { active: boolean; scene: Scene; onSamples: (n: number) => void }) {
  const gl = useThree((s) => s.gl);
  const threeScene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const pt = useMemo(() => {
    const p = new WebGLPathTracer(gl);
    p.bounces = 6;
    p.transmissiveBounces = 6;
    p.minSamples = 1;
    p.renderDelay = 0;
    p.fadeDuration = 0;
    p.multipleImportanceSampling = true;
    p.filterGlossyFactor = 0.5;
    return p;
  }, [gl]);
  const ready = useRef(false);
  useEffect(() => {
    if (!active) {
      ready.current = false;
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      try {
        pt.setScene(threeScene, camera);
        if (!cancelled) ready.current = true;
      } catch (err) {
        console.error(err);
        useStore.getState().notify('Path tracer could not start on this GPU — staying in real-time mode.');
        useStore.getState().set({ render: 'realtime' });
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [active, pt, threeScene, camera, scene.objects, scene.room, scene.time, scene.location, scene.view.whiteBalance]);
  const lastCam = useRef(new THREE.Matrix4());
  useFrame(() => {
    if (!active) return;
    if (!ready.current) {
      gl.render(threeScene, camera);
      return;
    }
    if (!lastCam.current.equals(camera.matrixWorld)) {
      lastCam.current.copy(camera.matrixWorld);
      pt.updateCamera();
    }
    pt.renderSample();
    // until the first sample lands (shader compile can take a while) show the raster view instead of black
    if ((pt as unknown as { isCompiling: boolean }).isCompiling || pt.samples < 1) gl.render(threeScene, camera);
    onSamples(Math.floor(pt.samples));
  }, active ? 1 : 0);
  return null;
}

function CaptureBridge() {
  const controls = useThree((s) => s.controls) as unknown as { target?: THREE.Vector3 } | null;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const renderFrame: ViewportApi['renderFrame'] = ({ width, aspect }, draw) => {
      const canvas = gl.domElement;
      const height = Math.round(width / aspect);
      const prevPR = gl.getPixelRatio();
      const prevFov = camera.fov, prevAspect = camera.aspect;
      const hidden: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (o.type === 'TransformControlsGizmo' || o.type === 'TransformControlsPlane') {
          if (o.visible) {
            hidden.push(o);
            o.visible = false;
          }
        }
      });
      const ca = size.width / size.height;
      // convert the current (possibly widened) fov back to the frame's true vertical fov
      const vfov = ca >= aspect ? camera.fov : (2 * Math.atan((Math.tan((camera.fov * Math.PI) / 360) * ca) / aspect) * 180) / Math.PI;
      gl.setPixelRatio(1);
      gl.setSize(width, height, false);
      camera.aspect = aspect;
      camera.fov = vfov;
      camera.updateProjectionMatrix();
      gl.render(scene, camera);
      draw(canvas);
      gl.setPixelRatio(prevPR);
      gl.setSize(size.width, size.height, false);
      camera.aspect = prevAspect;
      camera.fov = prevFov;
      camera.updateProjectionMatrix();
      hidden.forEach((o) => (o.visible = true));
    };
    viewportApi.current = {
      gl,
      camera,
      renderFrame,
      orbitTarget: () => controls?.target ?? null,
      capture: async ({ width, aspect }) => {
        const { render } = useStore.getState();
        const canvas = gl.domElement;
        if (render === 'pathtrace') {
          // crop the frame-guide region from the accumulated path-traced canvas
          const cw = canvas.width, ch = canvas.height;
          const ca = cw / ch;
          let w = cw, h = ch;
          if (ca > aspect) w = Math.round(ch * aspect);
          else h = Math.round(cw / aspect);
          const out = document.createElement('canvas');
          out.width = w;
          out.height = h;
          out.getContext('2d')!.drawImage(canvas, (cw - w) / 2, (ch - h) / 2, w, h, 0, 0, w, h);
          return out.toDataURL('image/png');
        }
        let url = '';
        renderFrame({ width, aspect }, (c) => (url = c.toDataURL('image/png')));
        return url;
      },
    };
  }, [gl, scene, camera, size, controls]);
  return null;
}

function ViewerSync({ enabled }: { enabled: boolean }) {
  // persist the orbit camera so a reopened scene restores the same view
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!enabled) return;
    const v = useStore.getState().scene.viewer;
    camera.position.set(...v.position);
    camera.lookAt(...v.target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useStore.getState().scene.id]);
  return null;
}

export interface ViewportInfo {
  dl: DaylightState;
  meter: Metering;
  samples: number;
}

export function Viewport({ onInfo }: { onInfo?: (i: ViewportInfo) => void }) {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const nav = useStore((s) => s.nav);
  const render = useStore((s) => s.render);
  const calibration = useStore((s) => s.settings.calibration);
  const setUI = useStore((s) => s.set);
  const dl = useDaylight(scene);
  const meter = useMetering(scene, dl, selectedId, calibration);
  const wb = useMemo(() => wbCompensation(scene.view.whiteBalance), [scene.view.whiteBalance]);
  const [samples, setSamples] = useState(0);
  const pt = render === 'pathtrace';
  const lookingThrough = !!scene.view.activeCameraId;
  useEffect(() => {
    onInfo?.({ dl, meter, samples });
  }, [dl, meter, samples, onInfo]);

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      camera={{ position: scene.viewer.position, fov: 50, near: 0.02, far: 200 }}
      onPointerMissed={(e) => {
        if (e.button === 0) setUI({ selectedId: null });
      }}
    >
      <RendererSettings exposure={meter.exposure} tone={scene.view.toneMapping} />
      <ViewerSync enabled={!lookingThrough} />
      <Daylight scene={scene} dl={dl} wb={wb} ambientLux={meter.ambientLux} pathTracing={pt} />
      <Room room={scene.room} exposure={meter.exposure} />
      <Objects scene={scene} wb={wb} calibration={calibration} shadows />
      {!pt && <SelectionGizmo />}
      <LensRig scene={scene} />
      {nav === 'orbit' && !lookingThrough && (
        <OrbitControls
          makeDefault
          target={scene.viewer.target}
          maxDistance={25}
          enableDamping
          dampingFactor={0.12}
          onEnd={(e) => {
            const c = (e?.target as unknown as { object: THREE.Camera; target: THREE.Vector3 }) ?? null;
            if (!c) return;
            useStore.getState().update(
              (s) => ({ ...s, viewer: { position: c.object.position.toArray() as Vec3, target: c.target.toArray() as Vec3 } }),
              { history: false },
            );
          }}
        />
      )}
      <FlyControls enabled={nav === 'fly' && !lookingThrough} />
      <PathTracer active={pt} scene={scene} onSamples={setSamples} />
      <CaptureBridge />
    </Canvas>
  );
}
