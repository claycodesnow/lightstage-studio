// Core data model. All distances are meters, angles degrees, unless noted.
// Room space: floor at y=0, room centered on origin.
// Wall A is the "back" wall at -z, then clockwise seen from above: B (+x), C (+z), D (-x).

export type WallId = 'A' | 'B' | 'C' | 'D';
export const WALLS: WallId[] = ['A', 'B', 'C', 'D'];

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface Photo {
  id: string;
  name: string;
  dataUrl: string; // original image (JPEG/PNG data URL)
  width: number;
  height: number;
  takenAt?: string; // EXIF DateTimeOriginal if available
}

/** Maps a quadrilateral of a photo onto a wall (perspective-corrected). */
export interface WallProjection {
  id: string;
  photoId: string;
  wall: WallId;
  /** Photo pixel coords (normalized 0..1): bottom-left, bottom-right, top-right, top-left of the visible wall area */
  quad: [Vec2, Vec2, Vec2, Vec2];
  /** Which span of the wall the quad covers, normalized 0..1 along the wall (seen from inside) and 0..1 up the wall */
  span: { u0: number; u1: number; v0: number; v1: number };
  /** Rectified texture produced from the quad (data URL), cached */
  rectified?: string;
}

export interface WindowSpec {
  id: string;
  wall: WallId;
  /** center of window along the wall, meters from the wall's left edge (seen from inside) */
  offset: number;
  sill: number; // sill height from floor
  width: number;
  height: number;
  /** 0..1 how much sunlight passes (clear glass ~0.85, sheer curtains ~0.35, blackout 0) */
  transmission: number;
  /** diffuses sunlight (sheers, frosted glass) */
  diffuse: boolean;
  kind: 'window' | 'door' | 'skylight';
}

export type FloorMaterial = 'wood' | 'concrete' | 'carpet' | 'tile' | 'painted';

export interface RoomSpec {
  width: number; // along x (wall A / C length)
  depth: number; // along z (wall B / D length)
  height: number;
  wallColors: Record<WallId, string>;
  ceilingColor: string;
  floorColor: string;
  floorMaterial: FloorMaterial;
  wallRoughness: number;
  photos: Photo[];
  projections: WallProjection[];
  windows: WindowSpec[];
  /** blend between purely lit albedo (0) and showing the photo as-shot (1) */
  photoBake: number;
  showPhotoTextures: boolean;
  notes?: string;
}

export interface LocationSpec {
  address: string;
  lat: number;
  lon: number;
  timeZone: string;
  /** compass bearing (deg, clockwise from true north) that Wall A's window side faces OUTWARD */
  wallABearing: number;
  orientationSource: 'manual' | 'osm-footprint' | 'ai' | 'default';
  footprint?: Vec2[]; // building footprint in local meters (x east, y north) for display
}

export interface TimeSpec {
  /** local wall-clock date-time at the location, 'YYYY-MM-DDTHH:mm' */
  local: string;
  live: boolean; // follow the real current time
  cloudCover: number; // 0 clear .. 1 overcast
  outdoorBounce: number; // ground albedo outside 0..1
}

export type ObjectKind = 'light' | 'subject' | 'prop' | 'flag' | 'camera' | 'cutout';

export interface BaseObject {
  id: string;
  kind: ObjectKind;
  name: string;
  position: Vec3; // base position (on floor for stands/props)
  rotationY: number; // deg
  locked?: boolean;
  hidden?: boolean;
}

export type ColorMode = 'cct' | 'hsi' | 'rgb' | 'gel' | 'fixed';

export interface LightObject extends BaseObject {
  kind: 'light';
  fixtureId: string;
  modifierId: string | null;
  standId: string;
  headHeight: number; // meters above floor of the light head
  pan: number; // deg, relative to rotationY
  tilt: number; // deg, negative points down
  dimmer: number; // 0..100 %
  colorMode: ColorMode;
  cct: number;
  gm: number; // green/magenta -1..1
  hue: number; // 0..360
  sat: number; // 0..100
  rgb: string;
  gelId: string | null;
  fresnelZoom?: number; // beam deg for fresnel attachments / zoomable fixtures
  gridId?: string | null;
  castShadows: boolean;
  enabled: boolean;
  /** strobes: power stop setting 1 = full, 1/2, 1/4 ... */
  flashPower?: number;
  /** tubes etc. can be placed without a stand */
  mountFree?: boolean;
  tubeOrientation?: 'vertical' | 'horizontal';
}

export interface SubjectObject extends BaseObject {
  kind: 'subject';
  skinToneId: string;
  heightM: number;
  build: 'slim' | 'average' | 'broad';
  pose: SubjectPose;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  headYaw: number;
  label?: string;
}

export type SubjectPose = 'standing' | 'seated' | 'seated-guitar' | 'seated-keys' | 'standing-mic' | 'leaning';

export interface PropObject extends BaseObject {
  kind: 'prop';
  propId: string;
  color: string;
  scale: number;
  elevation?: number;
}

export interface FlagObject extends BaseObject {
  kind: 'flag';
  flagId: string;
  height: number; // center height
  tilt: number;
  width: number;
  heightM: number;
}

export interface CameraObject extends BaseObject {
  kind: 'camera';
  height: number;
  pan: number;
  tilt: number;
  focalLength: number;
  sensorId: string;
  aspect: string; // e.g. '16:9'
  iso: number;
  shutter: number; // seconds, e.g. 1/50
  aperture: number; // f-number
  showFrustum: boolean;
}

export interface CutoutObject extends BaseObject {
  kind: 'cutout';
  photoId: string;
  /** normalized crop rect in the photo */
  crop: { x: number; y: number; w: number; h: number };
  widthM: number;
  heightM: number;
  dataUrl?: string;
}

export type SceneObject = LightObject | SubjectObject | PropObject | FlagObject | CameraObject | CutoutObject;

export interface ViewSettings {
  focalLength: number;
  sensorId: string;
  aspect: string;
  iso: number;
  shutter: number;
  aperture: number;
  autoExposure: boolean;
  exposureComp: number; // stops
  whiteBalance: number; // camera WB kelvin
  toneMapping: 'neutral' | 'agx' | 'aces' | 'linear';
  showGuides: boolean;
  showStands: boolean;
  activeCameraId: string | null;
}

export interface Scene {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  room: RoomSpec;
  location: LocationSpec;
  time: TimeSpec;
  objects: SceneObject[];
  view: ViewSettings;
  viewer: { position: Vec3; target: Vec3 };
}

export interface SceneMeta {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail?: string;
}
