import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, getFirstEncodableVideoCodec } from 'mediabunny';
import { useStore } from '../store';
import { viewportApi } from '../three/Viewport';
import { ASPECTS } from '../data/modifiers';
import { bearingName, dateToLocal, formatClock, localToDate, sunPosition } from '../lib/sun';
import { downloadBlob } from '../lib/storage';
import { meterPoint } from '../three/useLighting';
import type { CameraObject } from '../types';
import { Icon, Row, Select, Slider, Toggle } from './controls';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function VideoDialog({ onClose }: { onClose: () => void }) {
  const scene = useStore((s) => s.scene);
  const tz = scene.location.timeZone;
  const day = scene.time.local.slice(0, 10);
  const sp = useMemo(() => sunPosition(localToDate(day + 'T12:00', tz), scene.location.lat, scene.location.lon), [day, tz, scene.location.lat, scene.location.lon]);
  const hhmm = (d?: Date, fallback = '06:00') => (d ? dateToLocal(d, tz).slice(11, 16) : fallback);
  const [timelapse, setTimelapse] = useState(true);
  const [orbit, setOrbit] = useState(false);
  const [start, setStart] = useState(hhmm(sp.sunrise ? new Date(sp.sunrise.getTime() - 30 * 60000) : undefined, '06:00'));
  const [end, setEnd] = useState(hhmm(sp.sunset ? new Date(sp.sunset.getTime() + 30 * 60000) : undefined, '19:00'));
  const [arc, setArc] = useState(90);
  const [seconds, setSeconds] = useState(10);
  const [fps, setFps] = useState(30);
  const [width, setWidth] = useState(1920);
  const [overlay, setOverlay] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef(false);

  const cam = scene.objects.find((o) => o.id === scene.view.activeCameraId) as CameraObject | undefined;
  const lensAspect = cam?.aspect ?? scene.view.aspect;
  const aspect = ASPECTS[lensAspect] ?? 16 / 9;
  const height = Math.round(width / aspect / 2) * 2;
  const frames = Math.max(2, Math.round(seconds * fps));

  const record = async () => {
    const api = viewportApi.current;
    if (!api) return;
    if (!timelapse && !orbit) return setError('Turn on a time-lapse or a camera orbit.');
    setError(null);
    setResult(null);
    cancel.current = false;
    const st = useStore.getState();
    const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1', 'vp8'], { width, height });
    if (!codec) return setError('This browser cannot encode video at this size. Try a lower resolution, or Chrome/Edge.');
    const isMp4 = codec !== 'vp8';
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d')!;
    const output = new Output({ format: isMp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(), target: new BufferTarget() });
    const source = new CanvasSource(out, { codec, quality: QUALITY_HIGH });
    output.addVideoTrack(source, { frameRate: fps });
    await output.start();

    // remember state to restore afterwards
    const prevTime = st.scene.time;
    const prevRender = st.render;
    const camera = api.camera;
    const prevPos = camera.position.clone();
    const prevQuat = camera.quaternion.clone();
    if (prevRender !== 'realtime') st.set({ render: 'realtime' });
    const t0 = localToDate(day + 'T' + start, tz).getTime();
    let t1 = localToDate(day + 'T' + end, tz).getTime();
    if (t1 <= t0) t1 += 86400000;
    const m = meterPoint(st.scene, null);
    const center = api.orbitTarget()?.clone() ?? new THREE.Vector3(m[0], m[1] * 0.8, m[2]);
    const rel = prevPos.clone().sub(center);
    const radius = Math.hypot(rel.x, rel.z);
    const angle0 = Math.atan2(rel.x, rel.z);
    setProgress(0);
    try {
      for (let i = 0; i < frames; i++) {
        if (cancel.current) break;
        const k = i / (frames - 1);
        let when = localToDate(prevTime.local, tz);
        if (timelapse) {
          when = new Date(t0 + k * (t1 - t0));
          const local = dateToLocal(when, tz);
          useStore.getState().update((s) => ({ ...s, time: { ...s.time, local, live: false } }), { history: false });
        }
        if (orbit) {
          const a = angle0 + ((k - 0.5) * arc * Math.PI) / 180;
          camera.position.set(center.x + Math.sin(a) * radius, prevPos.y, center.z + Math.cos(a) * radius);
          camera.lookAt(center);
        }
        // let React/three apply the new state and refresh shadow maps
        await nextFrame();
        await nextFrame();
        api.renderFrame({ width, aspect }, (c) => ctx.drawImage(c, 0, 0, width, height));
        if (overlay) {
          const s = useStore.getState().scene;
          const p = sunPosition(when, s.location.lat, s.location.lon);
          const u = height / 1080;
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(24 * u, height - 92 * u, 430 * u, 68 * u);
          ctx.fillStyle = '#ffb547';
          ctx.font = `700 ${30 * u}px Inter, sans-serif`;
          ctx.fillText(formatClock(when, tz), 40 * u, height - 52 * u);
          ctx.fillStyle = '#e8eaee';
          ctx.font = `500 ${17 * u}px Inter, sans-serif`;
          ctx.fillText(`Sun ${p.altitude.toFixed(1)}° · ${bearingName(p.azimuth)}  ·  ${s.name}`.slice(0, 48), 40 * u, height - 32 * u);
        }
        await source.add(i / fps, 1 / fps);
        setProgress((i + 1) / frames);
      }
      await output.finalize();
      const buf = (output.target as BufferTarget).buffer!;
      const blob = new Blob([buf], { type: isMp4 ? 'video/mp4' : 'video/webm' });
      setResult({ url: URL.createObjectURL(blob), blob, ext: isMp4 ? 'mp4' : 'webm' });
    } catch (e) {
      console.error(e);
      setError('Recording failed: ' + (e as Error).message);
      await output.cancel().catch(() => {});
    } finally {
      useStore.getState().update((s) => ({ ...s, time: prevTime }), { history: false });
      camera.position.copy(prevPos);
      camera.quaternion.copy(prevQuat);
      if (prevRender !== 'realtime') useStore.getState().set({ render: prevRender });
      setProgress(null);
    }
  };

  const recording = progress !== null;
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && !recording && onClose()}>
      <div className="modal video">
        <header className="modal-head">
          <h2>Video export</h2>
          <div className="sp" />
          <button className="icon-btn" disabled={recording} onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        <div className="capture-body">
          <div className="capture-preview">
            {result ? (
              <video src={result.url} controls autoPlay loop muted />
            ) : recording ? (
              <div className="rec">
                <div className="rec-bar">
                  <span style={{ width: `${progress! * 100}%` }} />
                </div>
                <p>
                  Rendering frame {Math.round(progress! * frames)} of {frames}… the viewport is used for rendering, so keep this tab in front.
                </p>
                <button className="btn" onClick={() => (cancel.current = true)}>
                  Stop early
                </button>
              </div>
            ) : (
              <div className="empty big">
                Time-lapses show how sunlight sweeps through the room across the day. Orbits show the setup from every side. Uses the current view
                {cam ? ` (${cam.name})` : ''} and real-time renderer.
              </div>
            )}
          </div>
          <aside>
            <Row label="Time-lapse">
              <Toggle value={timelapse} onChange={setTimelapse} />
            </Row>
            {timelapse && (
              <>
                <Row label="From">
                  <input type="time" className="select" value={start} onChange={(e) => setStart(e.target.value)} />
                </Row>
                <Row label="To">
                  <input type="time" className="select" value={end} onChange={(e) => setEnd(e.target.value)} />
                </Row>
                <p className="fine">
                  {day} · sunrise {formatClock(sp.sunrise, tz)} · sunset {formatClock(sp.sunset, tz)}
                </p>
              </>
            )}
            <Row label="Camera orbit">
              <Toggle value={orbit} onChange={setOrbit} />
            </Row>
            {orbit && <Slider label="Orbit arc" value={arc} min={15} max={360} step={5} format={(v) => `${Math.round(v)}°`} onChange={setArc} />}
            <Slider label="Length" value={seconds} min={2} max={60} step={1} format={(v) => `${Math.round(v)} s`} onChange={setSeconds} />
            <Row label="Frame rate">
              <Select value={String(fps)} onChange={(v) => setFps(+v)}>
                <option value="24">24 fps</option>
                <option value="30">30 fps</option>
                <option value="60">60 fps</option>
              </Select>
            </Row>
            <Row label="Resolution">
              <Select value={String(width)} onChange={(v) => setWidth(+v)}>
                <option value="1280">1280 px</option>
                <option value="1920">1920 px (HD)</option>
                <option value="2560">2560 px</option>
                <option value="3840">3840 px (UHD)</option>
              </Select>
            </Row>
            <Row label="Clock overlay">
              <Toggle value={overlay} onChange={setOverlay} />
            </Row>
            <p className="fine">
              {frames} frames · {width}×{height} · {lensAspect}
            </p>
            {error && <p className="err">{error}</p>}
            <button className="btn primary wide" disabled={recording} onClick={record}>
              <Icon name="play" size={15} /> {result ? 'Record again' : 'Record'}
            </button>
            {result && (
              <button className="btn wide" onClick={() => downloadBlob(result.blob, `${scene.name.replace(/[^\w\- ]+/g, '').trim() || 'scene'}_${timelapse ? 'timelapse' : 'orbit'}.${result.ext}`)}>
                <Icon name="download" size={15} /> Download {result.ext.toUpperCase()}
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

