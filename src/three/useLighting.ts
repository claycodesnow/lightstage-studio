import { useEffect, useMemo, useState } from 'react';
import type { LightObject, Scene, Vec3 } from '../types';
import { bearingToRoomDir, daylight, localToDate, sunPosition, dateToLocal } from '../lib/sun';
import { computeEmission, daylightAtPoint, ev100, exposureFromEV100, luxAtPoint, windowWorldRect, type Emission } from '../lib/photometry';
import { hexToRGB, kelvinToRGB, normalizeLuma, srgbToLinear, type RGB } from '../lib/color';
import { useStore } from '../store';

export interface DaylightState {
  date: Date;
  azimuth: number;
  altitude: number;
  sunDir: Vec3; // room space, toward the sun
  sunLux: number;
  skyLux: number;
  sunK: number;
  skyK: number;
  sunrise?: Date;
  sunset?: Date;
}

export function useDaylight(scene: Scene): DaylightState {
  const { time, location } = scene;
  const [tick, setTick] = useState(0);
  const patchTime = useStore((s) => s.patchTime);
  useEffect(() => {
    if (!time.live) return;
    const id = setInterval(() => setTick((t) => t + 1), 20000);
    return () => clearInterval(id);
  }, [time.live]);
  useEffect(() => {
    if (time.live) {
      const nowLocal = dateToLocal(new Date(), location.timeZone);
      if (nowLocal !== time.local) patchTime({ local: nowLocal });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, time.live, location.timeZone]);
  return useMemo(() => {
    const date = localToDate(time.local, location.timeZone);
    const pos = sunPosition(date, location.lat, location.lon);
    const dl = daylight(pos.altitude, time.cloudCover);
    const [dx, dz] = bearingToRoomDir(pos.azimuth, location.wallABearing);
    const altR = (Math.max(pos.altitude, -2) * Math.PI) / 180;
    const sunDir: Vec3 = [dx * Math.cos(altR), Math.sin(altR), dz * Math.cos(altR)];
    return {
      date,
      azimuth: pos.azimuth,
      altitude: pos.altitude,
      sunDir,
      sunLux: dl.sunLux,
      skyLux: dl.skyLux,
      sunK: dl.sunK,
      skyK: dl.skyK,
      sunrise: pos.sunrise,
      sunset: pos.sunset,
    };
  }, [time.local, time.cloudCover, location.lat, location.lon, location.timeZone, location.wallABearing]);
}

/** Per-channel multiplier that emulates camera white balance (neutralises an illuminant of `wb` kelvin). */
export function wbCompensation(wb: number): RGB {
  const c = normalizeLuma(kelvinToRGB(wb));
  const inv: RGB = [1 / c[0], 1 / c[1], 1 / c[2]];
  const y = 0.2126 * inv[0] + 0.7152 * inv[1] + 0.0722 * inv[2];
  return [inv[0] / y, inv[1] / y, inv[2] / y];
}

export function meterPoint(scene: Scene, selectedId: string | null): Vec3 {
  const sel = scene.objects.find((o) => o.id === selectedId);
  const subj = sel?.kind === 'subject' ? sel : scene.objects.find((o) => o.kind === 'subject');
  if (subj && subj.kind === 'subject') {
    const seated = subj.pose.startsWith('seated');
    const y = seated ? 0.47 + subj.heightM * 0.36 + subj.heightM / 7.5 : subj.heightM * 0.93;
    return [subj.position[0], y, subj.position[2]];
  }
  return [scene.viewer.target[0], 1.5, scene.viewer.target[2]];
}

export interface Reading {
  name: string;
  id: string;
  lux: number;
  distance: number;
  color: string;
  emission: Emission;
}

export interface Metering {
  point: Vec3;
  readings: Reading[];
  sunLux: number;
  skyLux: number;
  ambientLux: number;
  totalLux: number;
  ev100: number;
  exposure: number;
  autoEV: number;
}

function avgReflectance(scene: Scene) {
  const lum = (hex: string) => {
    const [r, g, b] = hexToRGB(hex);
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  };
  const { room } = scene;
  const wallA = (room.width + room.depth) * 2 * room.height;
  const fc = room.width * room.depth;
  const wallRho = (['A', 'B', 'C', 'D'] as const).reduce((s, w) => s + lum(room.wallColors[w]), 0) / 4;
  const rho = (wallRho * wallA + lum(room.floorColor) * fc + lum(room.ceilingColor) * fc) / (wallA + 2 * fc);
  return { rho: Math.min(0.85, rho), rhoFloor: Math.min(0.85, lum(room.floorColor)), area: wallA + 2 * fc };
}

export function useMetering(scene: Scene, dl: DaylightState, selectedId: string | null, calibration: Record<string, number>): Metering {
  return useMemo(() => {
    const p = meterPoint(scene, selectedId);
    const readings: Reading[] = [];
    let totalFlux = 0;
    for (const o of scene.objects) {
      if (o.kind !== 'light' || !o.enabled || o.hidden) continue;
      const l = o as LightObject;
      const e = computeEmission(l, scene.view.shutter, calibration[l.fixtureId] ?? 1);
      if (!e) continue;
      totalFlux += e.flux;
      const lux = luxAtPoint(l, e, p);
      const d = Math.hypot(p[0] - l.position[0], p[1] - l.headHeight, p[2] - l.position[2]);
      readings.push({ name: l.name, id: l.id, lux, distance: d, color: e.displayColor, emission: e });
    }
    const day = daylightAtPoint(p, scene.room, dl.sunDir, dl.sunLux, dl.skyLux);
    // daylight flux entering through all windows (direct sun lands mostly on the floor first)
    let sunFlux = 0;
    for (const w of scene.room.windows) {
      const area = w.width * w.height;
      if (w.kind === 'skylight') {
        sunFlux += dl.sunLux * Math.max(0, dl.sunDir[1]) * area * w.transmission;
        totalFlux += dl.skyLux * area * w.transmission;
        continue;
      }
      const r = windowWorldRect(w, scene.room);
      const cosSun = Math.max(0, -(dl.sunDir[0] * r.normal[0] + dl.sunDir[1] * r.normal[1] + dl.sunDir[2] * r.normal[2]));
      totalFlux += dl.skyLux * 0.5 * area * w.transmission;
      sunFlux += dl.sunLux * cosSun * area * w.transmission;
    }
    const { rho, rhoFloor, area } = avgReflectance(scene);
    // Split-flux interreflection estimate: E_indirect = Φ·ρ_first / (A·(1-ρ))
    const ambientLux = (totalFlux * rho + sunFlux * rhoFloor) / (area * (1 - rho));
    const direct = readings.reduce((s, r) => s + r.lux, 0);
    const totalLux = direct + day.sky + day.sun + ambientLux;
    // With a subject we meter incident light at the face. Without one, approximate an average-scene reading
    // (most surfaces don't face the windows squarely).
    const hasSubject = scene.objects.some((o) => o.kind === 'subject' && !o.hidden);
    const meterLux = hasSubject ? totalLux : direct + ambientLux + 0.3 * (day.sky + day.sun);
    const autoEV = Math.log2(Math.max(0.5, meterLux) * (100 / 250));
    const v = scene.view;
    const manual = ev100(v.aperture, v.shutter, v.iso);
    const ev = v.autoExposure ? autoEV - v.exposureComp : manual - v.exposureComp;
    return {
      point: p,
      readings: readings.sort((a, b) => b.lux - a.lux),
      sunLux: day.sun,
      skyLux: day.sky,
      ambientLux,
      totalLux,
      ev100: ev,
      exposure: exposureFromEV100(ev),
      autoEV,
    };
  }, [scene, dl, selectedId, calibration]);
}
