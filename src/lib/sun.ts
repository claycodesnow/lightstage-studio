// Solar position (NOAA algorithm, accurate to ~0.01° for 1800-2100) and
// time-zone helpers. Azimuth is degrees clockwise from true north.

const rad = Math.PI / 180;
const deg = 180 / Math.PI;

export interface SunPosition {
  azimuth: number; // deg from north, clockwise
  altitude: number; // deg above horizon (refraction corrected)
  sunrise?: Date;
  sunset?: Date;
  solarNoon?: Date;
}

function julianDay(date: Date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function solarCore(date: Date) {
  const jd = julianDay(date);
  const t = (jd - 2451545.0) / 36525.0;
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C =
    Math.sin(M * rad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * M * rad) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * M * rad) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad)) * deg;
  const y = Math.tan((eps / 2) * rad) ** 2;
  const eqTime =
    4 *
    deg *
    (y * Math.sin(2 * L0 * rad) -
      2 * e * Math.sin(M * rad) +
      4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad) -
      0.5 * y * y * Math.sin(4 * L0 * rad) -
      1.25 * e * e * Math.sin(2 * M * rad));
  return { decl, eqTime };
}

export function sunPosition(date: Date, lat: number, lon: number): SunPosition {
  const { decl, eqTime } = solarCore(date);
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  let trueSolarTime = (utcMin + eqTime + 4 * lon) % 1440;
  if (trueSolarTime < 0) trueSolarTime += 1440;
  let hourAngle = trueSolarTime / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;
  const cosZen =
    Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(hourAngle * rad);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZen))) * deg;
  let az: number;
  const denom = Math.cos(lat * rad) * Math.sin(zenith * rad);
  if (Math.abs(denom) > 0.0001) {
    let azRad = (Math.sin(lat * rad) * Math.cos(zenith * rad) - Math.sin(decl * rad)) / denom;
    azRad = Math.min(1, Math.max(-1, azRad));
    az = 180 - Math.acos(azRad) * deg;
    if (hourAngle > 0) az = -az;
  } else {
    az = lat > 0 ? 180 : 0;
  }
  az = (az + 360) % 360;
  const elev = 90 - zenith;
  // atmospheric refraction
  let refr = 0;
  if (elev <= 85) {
    const te = Math.tan(elev * rad);
    if (elev > 5) refr = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
    else if (elev > -0.575) refr = 1735 + elev * (-518.2 + elev * (103.4 + elev * (-12.79 + elev * 0.711)));
    else refr = -20.774 / te;
    refr /= 3600;
  }
  // sunrise/sunset/noon for that UTC day
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
  const c2 = solarCore(day);
  const haArg =
    Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(c2.decl * rad)) - Math.tan(lat * rad) * Math.tan(c2.decl * rad);
  const noonMin = 720 - 4 * lon - c2.eqTime;
  const base = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const res: SunPosition = { azimuth: az, altitude: elev + refr, solarNoon: new Date(base + noonMin * 60000) };
  if (haArg >= -1 && haArg <= 1) {
    const ha = Math.acos(haArg) * deg;
    res.sunrise = new Date(base + (noonMin - 4 * ha) * 60000);
    res.sunset = new Date(base + (noonMin + 4 * ha) * 60000);
  }
  return res;
}

/** Offset in minutes of a time zone at a given instant (positive east of UTC). */
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const p = Object.fromEntries(dtf.formatToParts(at).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return -at.getTimezoneOffset();
  }
}

/** Convert 'YYYY-MM-DDTHH:mm' wall-clock time in timeZone to a real instant. */
export function localToDate(local: string, timeZone: string): Date {
  const [d, t = '12:00'] = local.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  let off = tzOffsetMinutes(timeZone, new Date(guess));
  let real = guess - off * 60000;
  off = tzOffsetMinutes(timeZone, new Date(real));
  real = guess - off * 60000;
  return new Date(real);
}

export function dateToLocal(date: Date, timeZone: string): string {
  const off = tzOffsetMinutes(timeZone, date);
  const d = new Date(date.getTime() + off * 60000);
  return d.toISOString().slice(0, 16);
}

export function formatClock(date: Date | undefined, timeZone: string) {
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit' }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

/** Convert a compass bearing into a room-space direction (x right/east-ish, z toward wall C).
 * wallABearing is the bearing Wall A faces outward. Wall A outward normal is -z. */
export function bearingToRoomDir(bearing: number, wallABearing: number): [number, number] {
  const a = (bearing - wallABearing) * rad;
  return [Math.sin(a), -Math.cos(a)];
}

export function wallFacingBearing(wall: 'A' | 'B' | 'C' | 'D', wallABearing: number) {
  const idx = { A: 0, B: 1, C: 2, D: 3 }[wall];
  return (wallABearing + idx * 90) % 360;
}

export function bearingName(b: number) {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return names[Math.round((((b % 360) + 360) % 360) / 22.5) % 16];
}

/** Rough daylight model. Returns sun illuminance (lux on a surface normal to the sun),
 * sky diffuse horizontal illuminance, and colour temperatures. */
export function daylight(altitude: number, cloudCover: number) {
  const h = altitude;
  if (h < -6) return { sunLux: 0, skyLux: 2 + 0 * h, sunK: 2000, skyK: 9000, twilight: true };
  const hc = Math.max(h, 0.0001);
  // Air mass (Kasten & Young)
  const am = 1 / (Math.sin(hc * rad) + 0.50572 * Math.pow(hc + 6.07995, -1.6364));
  const clear = h > 0 ? 133000 * Math.pow(0.7, Math.pow(am, 0.678)) : 0;
  const sunLux = clear * (1 - 0.95 * cloudCover);
  // Diffuse sky on horizontal plane: clear sky up to ~20k lux, overcast proportionally brighter diffuse
  const skyClear = h > 0 ? 3000 + 17000 * Math.sin(hc * rad) ** 0.7 : 400 * Math.max(0, (h + 6) / 6);
  const skyOver = h > 0 ? 25000 * Math.sin(hc * rad) ** 0.9 + 500 : 300 * Math.max(0, (h + 6) / 6);
  const skyLux = Math.max(1, skyClear * (1 - cloudCover) + skyOver * cloudCover);
  // Colour temperature of direct sun by altitude
  const sunK = h <= 0 ? 1900 : Math.min(5600, 1900 + 3700 * (1 - Math.exp(-h / 9)));
  const skyK = cloudCover > 0.6 ? 6500 + 500 * (1 - cloudCover) : h < 5 ? 7500 + 2000 * Math.max(0, (5 - h) / 11) : 9000 - 1500 * Math.min(1, h / 60);
  return { sunLux, skyLux, sunK, skyK, twilight: h < 0 };
}
