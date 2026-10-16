import { FIXTURE_MAP, coneSolidAngle, fixtureFlux, type Fixture } from '../data/fixtures';
import { GRID_MAP, MODIFIER_MAP, type Modifier } from '../data/modifiers';
import { GELS, applyGM, hexToRGB, hsiToRGB, kelvinToRGB, normalizeLuma, type RGB } from './color';
import type { LightObject, RoomSpec, Vec3, WindowSpec } from '../types';

export const INCIDENT_C = 250; // incident meter calibration constant (flat diffuser ≈ 250, dome ≈ 330)

export interface Emission {
  fixture: Fixture;
  modifier: Modifier | null;
  candela: number; // on-axis luminous intensity (continuous equivalent)
  flux: number;
  beam: number; // full angle deg
  penumbra: number; // 0..1
  color: RGB; // linear, luminance-normalised
  displayColor: string; // sRGB hex for UI swatches
  sourceSize: [number, number];
  spill: number;
  isFlash: boolean;
  cctLabel: string;
  /** effective CCT before gels (undefined for HSI/RGB colour) */
  cct?: number;
  gm: number;
}

export function fixtureColor(l: LightObject, f: Fixture): { rgb: RGB; label: string; cct?: number; gm: number } {
  let rgb: RGB;
  let label: string;
  let outCct: number | undefined;
  let gmTotal = 0;
  const cap = f.color;
  const cct = cap === 'daylight' || cap === 'tungsten' || cap === 'fixed' ? f.cct[0] : Math.min(f.cct[1], Math.max(f.cct[0], l.cct));
  if ((l.colorMode === 'hsi' && (cap === 'rgbww' || cap === 'rgb')) ) {
    rgb = hsiToRGB(l.hue, l.sat);
    label = `HSI ${Math.round(l.hue)}° ${Math.round(l.sat)}%`;
  } else if (l.colorMode === 'rgb' && (cap === 'rgbww' || cap === 'rgb')) {
    rgb = hexToRGB(l.rgb);
    label = `RGB ${l.rgb}`;
  } else {
    rgb = kelvinToRGB(cct);
    gmTotal = (cap === 'rgbww' || cap === 'bicolor' ? l.gm : 0) + (f.gmBias ?? 0);
    if (gmTotal) rgb = applyGM(rgb, gmTotal);
    outCct = cct;
    label = `${Math.round(cct)}K${gmTotal ? ` ${gmTotal > 0 ? '+' : ''}${gmTotal.toFixed(2)} G/M` : ''}`;
  }
  return { rgb, label, cct: outCct, gm: gmTotal };
}

export function computeEmission(l: LightObject, shutter: number, calibration = 1): Emission | null {
  const f = FIXTURE_MAP.get(l.fixtureId);
  if (!f) return null;
  const mod = l.modifierId ? MODIFIER_MAP.get(l.modifierId) ?? null : null;
  const grid = l.gridId ? GRID_MAP.get(l.gridId) : undefined;
  const { rgb: baseRgb, label, cct: baseCct, gm } = fixtureColor(l, f);
  let rgb = baseRgb;
  let effCct = baseCct;

  // Beam
  let beam = f.beam;
  if (f.zoom) beam = Math.min(f.zoom[1], Math.max(f.zoom[0], l.fresnelZoom ?? f.beam));
  let efficiency = 1;
  let spill = f.shape === 'bulb' ? 0.9 : f.shape === 'tube' || f.shape === 'strip' ? 0.5 : 0.08;
  let sourceSize: [number, number] = f.size;
  if (mod) {
    efficiency = mod.efficiency;
    beam = mod.zoom ? Math.min(mod.zoom[1], Math.max(mod.zoom[0], l.fresnelZoom ?? mod.beam)) : mod.beam;
    spill = mod.spill;
    if (mod.shape !== 'lens' && mod.shape !== 'none') sourceSize = mod.size;
    if (mod.gridDeg && l.gridId === 'builtin') {
      beam = Math.min(beam, mod.gridDeg + 10);
      efficiency *= 0.65;
    }
  }
  if (grid) {
    beam = Math.min(beam, grid.deg + 10);
    efficiency *= grid.efficiency;
  }

  // Gel
  if (l.gelId) {
    const gel = GELS.find((g) => g.id === l.gelId);
    if (gel) {
      const g = hexToRGB(gel.color);
      rgb = [rgb[0] * g[0], rgb[1] * g[1], rgb[2] * g[2]];
      efficiency *= gel.transmission;
      if (effCct && gel.mired !== undefined) effCct = 1e6 / Math.max(50, 1e6 / effCct + gel.mired);
      else if (effCct && gel.mired === undefined && !gel.id.includes('green')) effCct = undefined;
    }
  }

  const dim = Math.max(0, Math.min(100, l.dimmer)) / 100;
  let flux: number;
  let isFlash = false;
  if (f.category === 'strobe' && f.gn) {
    // GN (m, ISO100): N = GN / d. At 1 m: E·t = C·N²/ISO → 2.5·GN² lux·s. Convert to continuous-equivalent for the shutter.
    isFlash = true;
    const p = l.flashPower ?? 1;
    const luxSeconds = (INCIDENT_C * f.gn * f.gn) / 100;
    const lux1m = (luxSeconds * p) / Math.max(1 / 8000, shutter);
    flux = lux1m * coneSolidAngle(f.beam);
  } else {
    flux = fixtureFlux(f) * dim;
  }
  // Dimming curves are roughly linear on modern fixtures
  flux *= efficiency * calibration;

  const lit = normalizeLuma(rgb);
  // Intensity from flux spread over the beam's solid angle. Spill light is distributed wider.
  const omega = coneSolidAngle(Math.max(8, beam));
  const candela = (flux * (1 - spill * 0.5)) / omega;
  const penumbra = mod ? (mod.type === 'fresnel' || mod.type === 'projection' || mod.type === 'snoot' ? 0.25 : 0.85) : f.shape === 'point' ? 0.4 : 0.9;
  const disp: RGB = rgb.map((v) => v / Math.max(...rgb, 1e-6)) as RGB;
  const hex =
    '#' +
    disp
      .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'))
      .join('');
  return {
    fixture: f,
    modifier: mod,
    candela,
    flux,
    beam,
    penumbra,
    color: lit,
    displayColor: hex,
    sourceSize,
    spill,
    isFlash,
    cctLabel: label,
    cct: effCct,
    gm,
  };
}

export function ev100(aperture: number, shutter: number, iso: number) {
  return Math.log2((aperture * aperture) / shutter) - Math.log2(iso / 100);
}

/** Scene-luminance → display multiplier for a given EV100 (Frostbite/Lagarde saturation-based). */
export function exposureFromEV100(ev: number) {
  return 1.5 / (1.2 * Math.pow(2, ev));
}

/** f-number an incident meter would recommend for an illuminance. */
export function fstopForLux(lux: number, shutter: number, iso: number) {
  return Math.sqrt((Math.max(lux, 0.0001) * shutter * iso) / INCIDENT_C);
}

export function luxForEV100(ev: number) {
  return (INCIDENT_C / 100) * Math.pow(2, ev);
}

export function formatFStop(n: number) {
  const stops = [1, 1.2, 1.4, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22, 32];
  if (n < 1) return `f/${n.toFixed(1)} (under)`;
  let best = stops[0];
  for (const s of stops) if (Math.abs(Math.log2(s) - Math.log2(n)) < Math.abs(Math.log2(best) - Math.log2(n))) best = s;
  return `f/${best}`;
}

export function formatShutter(s: number) {
  if (s >= 1) return `${s}"`;
  return `1/${Math.round(1 / s)}`;
}

type V = Vec3;
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** World-space direction a light head points (rotationY+pan, tilt). Forward is -z at 0 rotation. */
export function lightDirection(l: { rotationY: number; pan: number; tilt: number }): V {
  const yaw = ((l.rotationY + l.pan) * Math.PI) / 180;
  const pitch = (l.tilt * Math.PI) / 180;
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}

export function lightHeadPosition(l: LightObject): V {
  return [l.position[0], l.headHeight, l.position[2]];
}

/** Illuminance (lux) from a light at a point, on a surface facing the light (incident dome style). */
export function luxAtPoint(l: LightObject, e: Emission, p: V, normal?: V): number {
  const head = lightHeadPosition(l);
  const d = sub(p, head);
  const dist = Math.max(0.05, len(d));
  const dir = norm(d);
  const axis = lightDirection(l);
  const off = (Math.acos(Math.max(-1, Math.min(1, dot(dir, axis)))) * 180) / Math.PI;
  const half = e.beam / 2;
  let angular: number;
  if (e.beam >= 300) angular = 1;
  else if (off <= half * (1 - e.penumbra * 0.5)) angular = 1;
  else if (off <= half) angular = 1 - (off - half * (1 - e.penumbra * 0.5)) / (half * e.penumbra * 0.5 + 1e-6);
  else angular = e.spill * Math.max(0, Math.cos((off * Math.PI) / 180));
  angular = Math.max(0, angular);
  // Large sources don't follow inverse-square up close: use a disc-source approximation.
  const r = Math.sqrt((e.sourceSize[0] * e.sourceSize[1]) / Math.PI);
  const falloff = 1 / (dist * dist + r * r * 0.5);
  const cosInc = normal ? Math.max(0, -dot(dir, normal)) : 1;
  return e.candela * angular * falloff * cosInc;
}

export function inverseSquareDrop(d1: number, d2: number) {
  return 2 * Math.log2(d2 / d1); // stops
}

/** Windows in world space for daylight estimates. */
export function windowWorldRect(w: WindowSpec, room: RoomSpec) {
  const hw = room.width / 2,
    hd = room.depth / 2;
  const cy = w.sill + w.height / 2;
  // u measured from left edge as seen from inside
  switch (w.wall) {
    case 'A':
      return { center: [-hw + w.offset, cy, -hd] as V, normal: [0, 0, 1] as V, axisU: [1, 0, 0] as V };
    case 'B':
      return { center: [hw, cy, -hd + w.offset] as V, normal: [-1, 0, 0] as V, axisU: [0, 0, 1] as V };
    case 'C':
      return { center: [hw - w.offset, cy, hd] as V, normal: [0, 0, -1] as V, axisU: [-1, 0, 0] as V };
    case 'D':
    default:
      return { center: [-hw, cy, hd - w.offset] as V, normal: [1, 0, 0] as V, axisU: [0, 0, -1] as V };
  }
}

/** Daylight lux at a point: sky through all windows (solid angle) + direct sun if a window lets it hit the point. */
export function daylightAtPoint(
  p: V,
  room: RoomSpec,
  sunDir: V, // pointing from scene toward the sun
  sunLux: number,
  skyLux: number,
): { sky: number; sun: number } {
  let sky = 0;
  let sun = 0;
  const skyLum = skyLux / Math.PI; // average sky luminance (cd/m²) approximating a uniform sky
  for (const w of room.windows) {
    if (w.kind === 'door' && w.transmission <= 0) continue;
    const r = windowWorldRect(w, room);
    const toWin = sub(r.center, p);
    const dist = len(toWin);
    const dirW = norm(toWin);
    const cosW = Math.max(0, -dot(dirW, r.normal));
    // half the window "sees" sky, half sees ground/buildings: weight 0.6 sky
    const omega = (w.width * w.height * cosW) / (dist * dist + w.width * w.height * 0.25);
    sky += skyLum * omega * 0.6 * w.transmission;
    // direct sun through window: intersect ray p + t*sunDir with window plane
    const denom = dot(sunDir, [-r.normal[0], -r.normal[1], -r.normal[2]]);
    if (denom > 0.01 && sunLux > 0) {
      const t = dot(sub(r.center, p), [-r.normal[0], -r.normal[1], -r.normal[2]]) / denom;
      if (t > 0) {
        const hit: V = [p[0] + sunDir[0] * t, p[1] + sunDir[1] * t, p[2] + sunDir[2] * t];
        const rel = sub(hit, r.center);
        const u = dot(rel, r.axisU);
        const v = rel[1];
        if (Math.abs(u) <= w.width / 2 && Math.abs(v) <= w.height / 2) {
          sun += sunLux * w.transmission * (w.diffuse ? 0.35 : 1);
        }
      }
    }
  }
  return { sky, sun };
}
