// Address research: geocode with OpenStreetMap Nominatim, find the building footprint via Overpass,
// and derive the compass bearing each façade faces. Time zone comes from an offline lookup table.
import tzlookup from '@photostructure/tz-lookup';
import type { Vec2 } from '../types';

export interface GeoResult {
  displayName: string;
  lat: number;
  lon: number;
  timeZone: string;
}

export async function geocode(address: string): Promise<GeoResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return data.map((d) => {
    const lat = parseFloat(d.lat);
    const lon = parseFloat(d.lon);
    return { displayName: d.display_name, lat, lon, timeZone: timeZoneFor(lat, lon) };
  });
}

export function timeZoneFor(lat: number, lon: number): string {
  try {
    return tzlookup(lat, lon);
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

export interface Facade {
  /** outward-facing compass bearing (deg clockwise from north) */
  bearing: number;
  length: number; // meters
  a: Vec2;
  b: Vec2;
}

export interface Footprint {
  polygon: Vec2[]; // local meters (x east, y north) relative to the geocoded point
  facades: Facade[];
  /** dominant grid orientations (bearings) merged from parallel façades */
  dominant: { bearing: number; length: number }[];
  source: string;
  tags?: Record<string, string>;
}

const R = 6378137;
function toLocal(lat0: number, lon0: number, lat: number, lon: number): Vec2 {
  const x = ((lon - lon0) * Math.PI) / 180 * R * Math.cos((lat0 * Math.PI) / 180);
  const y = ((lat - lat0) * Math.PI) / 180 * R;
  return [x, y];
}

function pointInPoly(p: Vec2, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polyDistance(p: Vec2, poly: Vec2[]) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return best;
}

export async function fetchFootprint(lat: number, lon: number): Promise<Footprint | null> {
  const q = `[out:json][timeout:20];(way(around:60,${lat},${lon})["building"];relation(around:60,${lat},${lon})["building"];);out geom tags;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(q),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`Building lookup failed (${res.status})`);
  const data = (await res.json()) as {
    elements: { type: string; geometry?: { lat: number; lon: number }[]; members?: { role: string; geometry?: { lat: number; lon: number }[] }[]; tags?: Record<string, string> }[];
  };
  const candidates: { poly: Vec2[]; tags?: Record<string, string> }[] = [];
  for (const el of data.elements) {
    let geom = el.geometry;
    if (!geom && el.members) geom = el.members.find((m) => m.role === 'outer' && m.geometry)?.geometry;
    if (!geom || geom.length < 4) continue;
    const poly = geom.map((g) => toLocal(lat, lon, g.lat, g.lon));
    if (poly.length > 1) {
      const f = poly[0], l = poly[poly.length - 1];
      if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 0.01) poly.pop();
    }
    candidates.push({ poly, tags: el.tags });
  }
  if (!candidates.length) return null;
  const origin: Vec2 = [0, 0];
  candidates.sort((a, b) => {
    const ai = pointInPoly(origin, a.poly) ? 0 : 1;
    const bi = pointInPoly(origin, b.poly) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return polyDistance(origin, a.poly) - polyDistance(origin, b.poly);
  });
  const best = candidates[0];
  return analyzeFootprint(best.poly, best.tags);
}

export function analyzeFootprint(poly: Vec2[], tags?: Record<string, string>): Footprint {
  // signed area → winding
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const ccw = area > 0;
  const facades: Facade[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 1.5) continue;
    // outward normal: for CCW polygons it's (dy, -dx)
    const nx = ccw ? dy : -dy;
    const ny = ccw ? -dx : dx;
    const bearing = ((Math.atan2(nx, ny) * 180) / Math.PI + 360) % 360;
    facades.push({ bearing, length, a, b });
  }
  // Merge into 4 dominant directions
  const bins: { bearing: number; length: number; sx: number; sy: number }[] = [];
  for (const f of facades) {
    const bin = bins.find((b) => Math.abs(((f.bearing - b.bearing + 540) % 360) - 180) < 20);
    const rad = (f.bearing * Math.PI) / 180;
    if (bin) {
      bin.sx += Math.sin(rad) * f.length;
      bin.sy += Math.cos(rad) * f.length;
      bin.length += f.length;
      bin.bearing = ((Math.atan2(bin.sx, bin.sy) * 180) / Math.PI + 360) % 360;
    } else bins.push({ bearing: f.bearing, length: f.length, sx: Math.sin(rad) * f.length, sy: Math.cos(rad) * f.length });
  }
  bins.sort((a, b) => b.length - a.length);
  return {
    polygon: poly,
    facades,
    dominant: bins.slice(0, 8).map((b) => ({ bearing: b.bearing, length: b.length })),
    source: 'OpenStreetMap contributors (ODbL)',
    tags,
  };
}
