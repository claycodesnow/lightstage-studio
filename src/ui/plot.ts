// Top-down lighting diagram, drawn to a 2D canvas (used in captures and the plot viewer).
import type { CameraObject, FlagObject, LightObject, PropObject, Scene, SubjectObject } from '../types';
import { computeEmission, lightDirection, windowWorldRect } from '../lib/photometry';
import { FLAG_MAP } from '../data/modifiers';
import { PROP_MAP } from '../data/props';
import { SKIN_TONES } from '../lib/color';
import { cameraFov } from '../three/Props';
import type { DaylightState } from '../three/useLighting';
import { bearingName } from '../lib/sun';

export function drawPlot(ctx: CanvasRenderingContext2D, scene: Scene, dl: DaylightState, W: number, H: number, fmtLen: (m: number) => string, calibration: Record<string, number>) {
  const { room } = scene;
  const margin = 70;
  const s = Math.min((W - margin * 2) / room.width, (H - margin * 2) / room.depth);
  const cx = W / 2, cy = H / 2;
  const X = (x: number) => cx + x * s;
  const Y = (z: number) => cy + z * s;
  ctx.save();
  ctx.fillStyle = '#0f1115';
  ctx.fillRect(0, 0, W, H);
  // grid (1 ft or 0.5 m)
  const step = 0.6096;
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = -room.width / 2; x <= room.width / 2 + 0.001; x += step) {
    ctx.beginPath();
    ctx.moveTo(X(x), Y(-room.depth / 2));
    ctx.lineTo(X(x), Y(room.depth / 2));
    ctx.stroke();
  }
  for (let z = -room.depth / 2; z <= room.depth / 2 + 0.001; z += step) {
    ctx.beginPath();
    ctx.moveTo(X(-room.width / 2), Y(z));
    ctx.lineTo(X(room.width / 2), Y(z));
    ctx.stroke();
  }
  // walls
  ctx.strokeStyle = '#d8dbe2';
  ctx.lineWidth = 5;
  ctx.strokeRect(X(-room.width / 2), Y(-room.depth / 2), room.width * s, room.depth * s);
  // wall labels & dims
  ctx.fillStyle = '#8a8f9a';
  ctx.font = '600 13px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`A · ${fmtLen(room.width)}`, cx, Y(-room.depth / 2) - 14);
  ctx.fillText('C', cx, Y(room.depth / 2) + 24);
  ctx.save();
  ctx.translate(X(room.width / 2) + 20, cy);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(`B · ${fmtLen(room.depth)}`, 0, 0);
  ctx.restore();
  ctx.fillText('D', X(-room.width / 2) - 20, cy);
  // windows
  for (const w of room.windows) {
    if (w.kind === 'skylight') {
      ctx.strokeStyle = '#7cc6ff';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(X(-room.width / 2 + w.offset - w.width / 2), Y(-room.depth / 2 + w.sill), w.width * s, w.height * s);
      ctx.setLineDash([]);
      continue;
    }
    const r = windowWorldRect(w, room);
    const ax = r.axisU;
    ctx.strokeStyle = w.kind === 'door' ? '#c9a46a' : '#7cc6ff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(X(r.center[0] - (ax[0] * w.width) / 2), Y(r.center[2] - (ax[2] * w.width) / 2));
    ctx.lineTo(X(r.center[0] + (ax[0] * w.width) / 2), Y(r.center[2] + (ax[2] * w.width) / 2));
    ctx.stroke();
  }
  // sun arrow
  if (dl.altitude > -6) {
    const len = Math.max(room.width, room.depth) * 0.42;
    const dx = dl.sunDir[0], dz = dl.sunDir[2];
    const n = Math.hypot(dx, dz) || 1;
    const sx = cx + (dx / n) * (len * s + 40), sy = cy + (dz / n) * (len * s + 40);
    ctx.strokeStyle = '#ffb547';
    ctx.fillStyle = '#ffb547';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(cx + (dx / n) * len * s * 0.5, cy + (dz / n) * len * s * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = '700 10px Inter';
    ctx.fillText('SUN', sx, sy + 3);
  }
  // north arrow
  const nb = -scene.location.wallABearing * (Math.PI / 180);
  ctx.save();
  ctx.translate(W - 40, 44);
  ctx.rotate(nb);
  ctx.fillStyle = '#e8eaee';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(7, 8);
  ctx.lineTo(0, 3);
  ctx.lineTo(-7, 8);
  ctx.closePath();
  ctx.fill();
  ctx.font = '700 11px Inter';
  ctx.fillText('N', 0, -22);
  ctx.restore();

  const rotPt = (o: { position: number[]; rotationY: number }, lx: number, lz: number) => {
    const a = (o.rotationY * Math.PI) / 180;
    return [o.position[0] + lx * Math.cos(a) + lz * Math.sin(a), o.position[2] - lx * Math.sin(a) + lz * Math.cos(a)];
  };
  // props
  for (const o of scene.objects) {
    if (o.hidden) continue;
    if (o.kind === 'prop' || o.kind === 'cutout') {
      const def = o.kind === 'prop' ? PROP_MAP.get((o as PropObject).propId) : null;
      const w = (def?.size[0] ?? (o as { widthM?: number }).widthM ?? 0.5) * (o.kind === 'prop' ? (o as PropObject).scale : 1);
      const d = (def?.size[1] ?? 0.05) * (o.kind === 'prop' ? (o as PropObject).scale : 1);
      const pts = [rotPt(o, -w / 2, -d / 2), rotPt(o, w / 2, -d / 2), rotPt(o, w / 2, d / 2), rotPt(o, -w / 2, d / 2)];
      ctx.fillStyle = 'rgba(160,170,185,0.18)';
      ctx.strokeStyle = 'rgba(160,170,185,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z))));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // flags
  for (const o of scene.objects) {
    if (o.kind !== 'flag' || o.hidden) continue;
    const f = o as FlagObject;
    const def = FLAG_MAP.get(f.flagId);
    const a = rotPt(f, -f.width / 2, 0), b = rotPt(f, f.width / 2, 0);
    ctx.strokeStyle = def?.material === 'white' ? '#f2f2f0' : def?.material === 'diffusion' ? '#bfe3ff' : def?.material === 'silver' ? '#cfd3d8' : def?.material === 'gold' ? '#e3b964' : '#555';
    ctx.lineWidth = 5;
    if (def?.category === 'vflat') {
      const m = rotPt(f, 0, 0);
      const l = rotPt(f, -f.width * 0.88, f.width * 0.48), r = rotPt(f, f.width * 0.88, f.width * 0.48);
      ctx.beginPath();
      ctx.moveTo(X(l[0]), Y(l[1]));
      ctx.lineTo(X(m[0]), Y(m[1]));
      ctx.lineTo(X(r[0]), Y(r[1]));
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(X(a[0]), Y(a[1]));
      ctx.lineTo(X(b[0]), Y(b[1]));
      ctx.stroke();
    }
  }
  // cameras
  for (const o of scene.objects) {
    if (o.kind !== 'camera' || o.hidden) continue;
    const c = o as CameraObject;
    const { hfovDeg } = cameraFov(c.focalLength, c.sensorId, c.aspect);
    const yaw = ((c.rotationY + c.pan) * Math.PI) / 180;
    const L = 1.6;
    const h = (hfovDeg / 2) * (Math.PI / 180);
    const p0 = [X(c.position[0]), Y(c.position[2])];
    const dir = (ang: number) => [p0[0] + -Math.sin(yaw + ang) * L * s, p0[1] + -Math.cos(yaw + ang) * L * s];
    const l = dir(h), r = dir(-h);
    ctx.fillStyle = 'rgba(255,181,71,0.08)';
    ctx.strokeStyle = 'rgba(255,181,71,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(l[0], l[1]);
    ctx.lineTo(r[0], r[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffb547';
    ctx.fillRect(p0[0] - 8, p0[1] - 6, 16, 12);
    ctx.fillStyle = '#e8eaee';
    ctx.font = '600 12px Inter';
    ctx.fillText(`${c.name} ${c.focalLength}mm`, p0[0], p0[1] + 24);
  }
  // subjects
  for (const o of scene.objects) {
    if (o.kind !== 'subject' || o.hidden) continue;
    const sub = o as SubjectObject;
    const x = X(sub.position[0]), y = Y(sub.position[2]);
    ctx.fillStyle = SKIN_TONES.find((t) => t.id === sub.skinToneId)?.hex ?? '#a07e56';
    ctx.beginPath();
    ctx.ellipse(x, y, 0.24 * s, 0.14 * s, -(sub.rotationY * Math.PI) / 180, 0, Math.PI * 2);
    ctx.fill();
    // nose → facing
    const yaw = ((sub.rotationY + sub.headYaw) * Math.PI) / 180;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.sin(yaw) * 0.25 * s, y - Math.cos(yaw) * 0.25 * s);
    ctx.stroke();
    ctx.fillStyle = '#e8eaee';
    ctx.font = '600 12px Inter';
    ctx.fillText(sub.name, x, y + 0.24 * s + 14);
  }
  // lights
  for (const o of scene.objects) {
    if (o.kind !== 'light' || o.hidden) continue;
    const l = o as LightObject;
    const e = computeEmission(l, scene.view.shutter, calibration[l.fixtureId] ?? 1);
    if (!e) continue;
    const x = X(l.position[0]), y = Y(l.position[2]);
    const d = lightDirection(l);
    const yaw = Math.atan2(d[0], d[2]);
    const half = Math.min(Math.PI * 0.95, ((e.beam / 2) * Math.PI) / 180);
    const R = Math.min(3.2, 1.2 + e.beam / 120) * s;
    if (l.enabled) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, e.displayColor + '55');
      g.addColorStop(1, e.displayColor + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, R, Math.PI / 2 - yaw - half, Math.PI / 2 - yaw + half);
      ctx.closePath();
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw + Math.PI);
    const fw = Math.max(14, (e.modifier ? e.modifier.size[0] : e.fixture.size[0]) * s);
    ctx.fillStyle = l.enabled ? e.displayColor : '#444';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-fw / 2, -6, fw, 12, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#e8eaee';
    ctx.font = '600 12px Inter';
    ctx.fillText(l.name.replace(/^(Godox|Aputure|Amaran|Nanlite) /, ''), x, y - 18);
    ctx.fillStyle = '#9aa0ab';
    ctx.font = '500 11px Inter';
    ctx.fillText(`${e.modifier ? e.modifier.name.split(' (')[0] : ''}${e.modifier ? ' · ' : ''}${l.dimmer}% · ${e.cctLabel} · ${fmtLen(l.headHeight)} high`, x, y + 26);
  }
  // legend
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9aa0ab';
  ctx.font = '500 12px Inter';
  ctx.fillText(`Sun ${dl.altitude.toFixed(1)}° alt · ${dl.azimuth.toFixed(0)}° ${bearingName(dl.azimuth)} · grid = 2 ft`, 16, H - 16);
  ctx.restore();
}
