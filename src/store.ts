import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  CameraObject,
  CutoutObject,
  FlagObject,
  LightObject,
  PropObject,
  Scene,
  SceneObject,
  SubjectObject,
  Vec3,
} from './types';
import { FIXTURE_MAP, isPracticalLike } from './data/fixtures';
import { FLAG_MAP, STAND_MAP } from './data/modifiers';
import { PROP_MAP } from './data/props';
import { dateToLocal } from './lib/sun';
import { loadSettings, saveScene, saveSettings, type AppSettings } from './lib/storage';

export function defaultScene(name = 'Untitled location'): Scene {
  // default location is New York; keep its time zone consistent with it
  const tz = 'America/New_York';
  const now = new Date();
  return {
    id: nanoid(10),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    room: {
      width: 5,
      depth: 4.2,
      height: 2.9,
      wallColors: { A: '#ece8e1', B: '#ece8e1', C: '#ece8e1', D: '#ece8e1' },
      ceilingColor: '#f4f2ee',
      floorColor: '#9b7653',
      floorMaterial: 'wood',
      wallRoughness: 0.9,
      photos: [],
      projections: [],
      windows: [
        { id: 'placeholder', wall: 'A', offset: 2.5, sill: 0.75, width: 1.6, height: 1.6, transmission: 0.85, diffuse: false, kind: 'window' },
      ],
      photoBake: 0,
      showPhotoTextures: true,
    },
    location: {
      address: '',
      lat: 40.7128,
      lon: -74.006,
      timeZone: tz,
      wallABearing: 180,
      orientationSource: 'default',
    },
    time: { local: dateToLocal(now, tz), live: false, cloudCover: 0.1, outdoorBounce: 0.25 },
    objects: [],
    view: {
      focalLength: 35,
      sensorId: 'ff',
      aspect: '16:9',
      iso: 800,
      shutter: 1 / 50,
      aperture: 2.8,
      autoExposure: true,
      exposureComp: 0,
      whiteBalance: 5600,
      toneMapping: 'neutral',
      showGuides: true,
      showStands: true,
      activeCameraId: null,
    },
    viewer: { position: [0.3, 1.6, 1.8], target: [0, 1.2, -1] },
  };
}

export function makeLight(fixtureId: string, at: Vec3, modifierId: string | null = null): LightObject {
  const f = FIXTURE_MAP.get(fixtureId)!;
  const isTube = f.shape === 'tube' || f.shape === 'strip';
  const isPractical = isPracticalLike(f);
  const roomH = useStore.getState().scene.room.height;
  const house: Partial<LightObject> = (() => {
    switch (f.houseMount) {
      case 'recessed':
      case 'troffer':
      case 'flush':
        return { standId: 'ceiling', headHeight: roomH - (f.houseMount === 'flush' ? 0.1 : 0.02), tilt: -90 };
      case 'track':
        return { standId: 'ceiling', headHeight: roomH - 0.25, tilt: -55 };
      case 'pendant':
        return { standId: 'ceiling', headHeight: Math.max(2.0, roomH - 0.8), tilt: -90 };
      case 'wall':
        return { standId: 'no-stand', headHeight: 1.8, tilt: -90 };
      case 'cabinet':
        return { standId: 'no-stand', headHeight: 1.4, tilt: -90 };
      default:
        return {};
    }
  })();
  return {
    id: nanoid(8),
    kind: 'light',
    name: `${f.brand} ${f.model}`,
    fixtureId,
    modifierId,
    standId: isPractical ? 'no-stand' : 'light-stand-8',
    position: at,
    rotationY: 0,
    headHeight: isPractical ? (f.model.includes('Floor') ? 1.5 : f.model.includes('Desk') ? 1.1 : f.model.includes('Downlight') ? 2.8 : 1.2) : 1.9,
    pan: 0,
    tilt: isPractical ? -90 : -15,
    dimmer: 100,
    colorMode: f.color === 'rgb' ? 'hsi' : 'cct',
    cct: f.color === 'bicolor' || f.color === 'rgbww' ? 5600 : f.cct[0],
    gm: 0,
    hue: 210,
    sat: 100,
    rgb: '#ff6a00',
    gelId: null,
    fresnelZoom: f.zoom ? f.zoom[1] : undefined,
    gridId: null,
    castShadows: !isPractical || f.shape === 'bulb',
    enabled: true,
    flashPower: f.category === 'strobe' ? 1 : undefined,
    tubeOrientation: isTube ? (f.houseMount ? 'horizontal' : 'vertical') : undefined,
    ...house,
  };
}

export function makeSubject(at: Vec3, n: number): SubjectObject {
  const shirts = ['#3b5b7a', '#7a3b3b', '#2f4f3a', '#d8d2c4', '#222222', '#a8732d', '#5a4a7a'];
  return {
    id: nanoid(8),
    kind: 'subject',
    name: `Subject ${n}`,
    position: at,
    rotationY: 0,
    skinToneId: ['mst3', 'mst6', 'mst8', 'mst5', 'mst10', 'mst2'][n % 6],
    heightM: 1.75,
    build: 'average',
    pose: 'standing',
    shirtColor: shirts[n % shirts.length],
    pantsColor: '#2a2d33',
    hairColor: '#2b2019',
    headYaw: 0,
  };
}

export function makeProp(propId: string, at: Vec3): PropObject {
  const p = PROP_MAP.get(propId)!;
  return { id: nanoid(8), kind: 'prop', name: p.name, propId, position: at, rotationY: 0, color: p.color, scale: 1 };
}

export function makeFlag(flagId: string, at: Vec3): FlagObject {
  const f = FLAG_MAP.get(flagId)!;
  const isVflat = f.category === 'vflat';
  return {
    id: nanoid(8),
    kind: 'flag',
    name: f.name,
    flagId,
    position: at,
    rotationY: 0,
    height: isVflat ? f.height / 2 : 1.5,
    tilt: 0,
    width: f.width,
    heightM: f.height,
  };
}

export function makeCamera(at: Vec3, n: number): CameraObject {
  return {
    id: nanoid(8),
    kind: 'camera',
    name: `Cam ${String.fromCharCode(65 + (n % 26))}`,
    position: at,
    rotationY: 0,
    height: 1.35,
    pan: 0,
    tilt: -2,
    focalLength: 50,
    sensorId: 'ff',
    aspect: '16:9',
    iso: 800,
    shutter: 1 / 50,
    aperture: 2.8,
    showFrustum: true,
  };
}

export function makeCutout(photoId: string, crop: CutoutObject['crop'], dataUrl: string, w: number, h: number, at: Vec3): CutoutObject {
  return {
    id: nanoid(8),
    kind: 'cutout',
    name: 'Photo cut-out',
    photoId,
    crop,
    dataUrl,
    widthM: w,
    heightM: h,
    position: at,
    rotationY: 0,
  };
}

export type Panel = 'room' | 'daylight' | 'lights' | 'subjects' | 'props' | 'grip' | 'cameras' | 'outliner';

interface UIState {
  screen: 'home' | 'editor';
  panel: Panel;
  nav: 'orbit' | 'fly';
  render: 'realtime' | 'pathtrace';
  transformMode: 'translate' | 'rotate';
  selectedId: string | null;
  roomWizardOpen: boolean;
  captureOpen: boolean;
  plotOpen: boolean;
  settingsOpen: boolean;
  meter: boolean;
  dirty: boolean;
  lastSaved: number | null;
  toast: string | null;
}

interface Store extends UIState {
  scene: Scene;
  settings: AppSettings;
  past: Scene[];
  future: Scene[];
  set: (p: Partial<UIState>) => void;
  setSettings: (p: Partial<AppSettings>) => void;
  openScene: (s: Scene) => void;
  update: (fn: (s: Scene) => Scene, opts?: { history?: boolean }) => void;
  patchRoom: (p: Partial<Scene['room']>) => void;
  patchLocation: (p: Partial<Scene['location']>) => void;
  patchTime: (p: Partial<Scene['time']>) => void;
  patchView: (p: Partial<Scene['view']>) => void;
  addObject: (o: SceneObject) => void;
  patchObject: (id: string, p: Partial<SceneObject>, opts?: { history?: boolean }) => void;
  removeObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  undo: () => void;
  redo: () => void;
  save: (thumbnail?: string) => Promise<void>;
  notify: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let lastHistoryPush = 0;

export const useStore = create<Store>((set, get) => ({
  screen: 'home',
  panel: 'room',
  nav: 'orbit',
  render: 'realtime',
  transformMode: 'translate',
  selectedId: null,
  roomWizardOpen: false,
  captureOpen: false,
  plotOpen: false,
  settingsOpen: false,
  meter: true,
  dirty: false,
  lastSaved: null,
  toast: null,
  scene: defaultScene(),
  settings: loadSettings(),
  past: [],
  future: [],
  set: (p) => set(p),
  setSettings: (p) => {
    const settings = { ...get().settings, ...p };
    saveSettings(settings);
    set({ settings });
  },
  openScene: (s) => set({ scene: s, screen: 'editor', selectedId: null, past: [], future: [], dirty: false, lastSaved: s.updatedAt }),
  update: (fn, opts) => {
    const prev = get().scene;
    const next = fn(prev);
    const now = performance.now();
    // coalesce rapid edits (slider drags) into one undo step
    const push = opts?.history !== false && now - lastHistoryPush > 400;
    if (push) lastHistoryPush = now;
    set({
      scene: next,
      dirty: true,
      past: push ? [...get().past.slice(-60), prev] : get().past,
      future: push ? [] : get().future,
    });
  },
  patchRoom: (p) => get().update((s) => ({ ...s, room: { ...s.room, ...p } })),
  patchLocation: (p) => get().update((s) => ({ ...s, location: { ...s.location, ...p } })),
  patchTime: (p) => get().update((s) => ({ ...s, time: { ...s.time, ...p } }), { history: !('local' in p && Object.keys(p).length === 1) }),
  patchView: (p) => get().update((s) => ({ ...s, view: { ...s.view, ...p } }), { history: false }),
  addObject: (o) => {
    get().update((s) => ({ ...s, objects: [...s.objects, o] }));
    set({ selectedId: o.id });
  },
  patchObject: (id, p, opts) =>
    get().update((s) => ({ ...s, objects: s.objects.map((o) => (o.id === id ? ({ ...o, ...p } as SceneObject) : o)) }), opts),
  removeObject: (id) => {
    get().update((s) => ({
      ...s,
      objects: s.objects.filter((o) => o.id !== id),
      view: s.view.activeCameraId === id ? { ...s.view, activeCameraId: null } : s.view,
    }));
    if (get().selectedId === id) set({ selectedId: null });
  },
  duplicateObject: (id) => {
    const o = get().scene.objects.find((x) => x.id === id);
    if (!o) return;
    const copy = { ...o, id: nanoid(8), name: o.name + ' copy', position: [o.position[0] + 0.4, o.position[1], o.position[2] + 0.4] as Vec3 };
    get().addObject(copy as SceneObject);
  },
  undo: () => {
    const { past, scene, future } = get();
    if (!past.length) return;
    set({ scene: past[past.length - 1], past: past.slice(0, -1), future: [scene, ...future], dirty: true });
  },
  redo: () => {
    const { past, scene, future } = get();
    if (!future.length) return;
    set({ scene: future[0], future: future.slice(1), past: [...past, scene], dirty: true });
  },
  save: async (thumbnail) => {
    const s = { ...get().scene, thumbnail: thumbnail ?? get().scene.thumbnail };
    await saveScene(s);
    set({ scene: s, dirty: false, lastSaved: Date.now() });
  },
  notify: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 3200);
  },
}));

export function selectedObject() {
  const { scene, selectedId } = useStore.getState();
  return scene.objects.find((o) => o.id === selectedId) ?? null;
}

export function standFor(l: LightObject) {
  return STAND_MAP.get(l.standId) ?? STAND_MAP.get('light-stand-8')!;
}
