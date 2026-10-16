import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, type Panel } from '../store';
import { Viewport, type ViewportInfo } from '../three/Viewport';
import { ASPECTS } from '../data/modifiers';
import { formatFStop, formatShutter, fstopForLux } from '../lib/photometry';
import { bearingName, formatClock, localToDate, dateToLocal } from '../lib/sun';
import { exportScene } from '../lib/storage';
import type { CameraObject } from '../types';
import { Icon, Seg, Toggle } from './controls';
import { RoomPanel } from './RoomPanel';
import { DaylightPanel } from './DaylightPanel';
import { CamerasPanel, GripPanel, LightsPanel, OutlinerPanel, PropsPanel, SubjectsPanel } from './LibraryPanels';
import { Inspector } from './Inspector';
import { PhotoMapper } from './PhotoMapper';
import { CaptureDialog } from './Capture';
import { VideoDialog } from './VideoDialog';
import { drawPlot } from './plot';
import { useLen } from './controls';

const RAIL: { id: Panel; icon: string; label: string }[] = [
  { id: 'room', icon: 'room', label: 'Room' },
  { id: 'daylight', icon: 'sun', label: 'Sun & Location' },
  { id: 'lights', icon: 'light', label: 'Lights' },
  { id: 'grip', icon: 'flag', label: 'Grip' },
  { id: 'subjects', icon: 'person', label: 'Subjects' },
  { id: 'props', icon: 'guitar', label: 'Props' },
  { id: 'cameras', icon: 'camera', label: 'Cameras' },
  { id: 'outliner', icon: 'list', label: 'Scene' },
];

function TopBar({ onCapture, onPlot, onVideo }: { onCapture: () => void; onPlot: () => void; onVideo: () => void }) {
  const scene = useStore((s) => s.scene);
  const st = useStore();
  const [saving, setSaving] = useState(false);
  return (
    <div className="topbar">
      <button className="icon-btn" title="All scenes" onClick={async () => {
        if (st.dirty) await st.save();
        st.set({ screen: 'home' });
      }}>
        <Icon name="home" />
      </button>
      <div className="brand">
        <span className="logo-dot" /> LightStage
      </div>
      <input className="scene-name" value={scene.name} onChange={(e) => st.update((s) => ({ ...s, name: e.target.value }), { history: false })} />
      <span className="save-state">{st.dirty ? 'Unsaved changes' : st.lastSaved ? 'Saved' : ''}</span>
      <div className="sp" />
      <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!st.past.length} onClick={st.undo}>
        <Icon name="undo" />
      </button>
      <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!st.future.length} onClick={st.redo}>
        <Icon name="redo" />
      </button>
      <div className="divider" />
      <Seg
        value={st.transformMode}
        onChange={(v) => st.set({ transformMode: v })}
        options={[
          { v: 'translate', label: <Icon name="move" size={16} />, title: 'Move (G)' },
          { v: 'rotate', label: <Icon name="rotate" size={16} />, title: 'Rotate (R)' },
        ]}
      />
      <Seg
        value={st.nav}
        onChange={(v) => st.set({ nav: v })}
        options={[
          { v: 'orbit', label: <Icon name="orbit" size={16} />, title: 'Orbit navigation' },
          { v: 'fly', label: <Icon name="walk" size={16} />, title: 'Free roam: WASD + drag to look, Q/E down/up, Shift = fast' },
        ]}
      />
      <Seg
        value={st.render}
        onChange={(v) => st.set({ render: v })}
        options={[
          { v: 'realtime', label: 'Real-time', title: 'Interactive raster preview' },
          { v: 'pathtrace', label: 'Render', title: 'Physically based path tracing: true bounce, soft shadows, diffusion' },
        ]}
      />
      <div className="divider" />
      <button className="btn" onClick={onPlot}>
        <Icon name="plot" size={16} /> Plot
      </button>
      <button className="btn" onClick={() => exportScene(scene)} title="Export scene file to share">
        <Icon name="download" size={16} />
      </button>
      <button
        className="btn"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await st.save();
          setSaving(false);
          st.notify('Scene saved');
        }}
      >
        <Icon name="save" size={16} /> Save
      </button>
      <button className="btn" onClick={onVideo} title="Time-lapse / orbit video">
        <Icon name="play" size={15} /> Video
      </button>
      <button className="btn primary" onClick={onCapture}>
        <Icon name="shot" size={16} /> Capture
      </button>
    </div>
  );
}

function Timeline({ info }: { info: ViewportInfo | null }) {
  const time = useStore((s) => s.scene.time);
  const tz = useStore((s) => s.scene.location.timeZone);
  const patchTime = useStore((s) => s.patchTime);
  const [playing, setPlaying] = useState(false);
  const mins = parseInt(time.local.slice(11, 13)) * 60 + parseInt(time.local.slice(14, 16));
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (t: number) => {
      const dt = t - last;
      last = t;
      const { scene } = useStore.getState();
      const d = localToDate(scene.time.local, scene.location.timeZone);
      const next = new Date(d.getTime() + dt * 60 * 20); // 20 minutes per second
      useStore.getState().update((s) => ({ ...s, time: { ...s.time, local: dateToLocal(next, s.location.timeZone), live: false } }), { history: false });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);
  const toMin = (d?: Date) => {
    if (!d) return null;
    const l = dateToLocal(d, tz);
    return parseInt(l.slice(11, 13)) * 60 + parseInt(l.slice(14, 16));
  };
  const rise = toMin(info?.dl.sunrise), set = toMin(info?.dl.sunset);
  const setMins = (m: number) => {
    const hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(Math.round(m % 60)).padStart(2, '0');
    patchTime({ local: time.local.slice(0, 11) + hh + ':' + mm, live: false });
  };
  const bg =
    rise !== null && set !== null
      ? `linear-gradient(90deg, #11131a 0%, #11131a ${(rise / 1440) * 100 - 2}%, #ff8a3d ${(rise / 1440) * 100}%, #ffd28a ${(rise / 1440) * 100 + 4}%, #8fc7ff ${((rise + set) / 2880) * 100}%, #ffd28a ${(set / 1440) * 100 - 4}%, #ff6a3d ${(set / 1440) * 100}%, #2a2f4a ${(set / 1440) * 100 + 2}%, #11131a 100%)`
      : '#1a1d24';
  return (
    <div className="timeline">
      <button className="icon-btn" onClick={() => setPlaying(!playing)} title="Animate time of day">
        <Icon name={playing ? 'pause' : 'play'} size={16} />
      </button>
      <div className="tl-date">
        <input type="date" value={time.local.slice(0, 10)} onChange={(e) => e.target.value && patchTime({ local: e.target.value + time.local.slice(10), live: false })} />
      </div>
      <div className="tl-track">
        <input type="range" min={0} max={1439} step={1} value={mins} style={{ background: bg }} onChange={(e) => setMins(+e.target.value)} />
        <div className="tl-ticks">
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
              {h === 24 ? '' : h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? h - 12 + 'p' : h + 'a'}
            </span>
          ))}
        </div>
      </div>
      <div className="tl-clock">
        <b>{info ? formatClock(info.dl.date, tz) : '--'}</b>
        <span>
          {info ? `${info.dl.altitude.toFixed(1)}° · ${bearingName(info.dl.azimuth)}` : ''}
        </span>
      </div>
      <label className="tl-live">
        <Toggle value={time.live} onChange={(v) => patchTime({ live: v })} /> Live
      </label>
    </div>
  );
}

/** Flags the classic rental-location problems: mixed colour temperatures and green fluorescent spikes. */
function colourWarnings(info: ViewportInfo): string[] {
  const m = info.meter;
  const total = Math.max(1, m.totalLux);
  const srcs: { name: string; k: number; share: number; gm: number }[] = [];
  // group identical fixtures (a ceiling grid of cans acts as one source)
  const groups = new Map<string, { name: string; k: number; share: number; gm: number; n: number }>();
  for (const r of m.readings) {
    if (!r.emission.cct) continue;
    const key = r.emission.fixture.id + ':' + Math.round(r.emission.cct);
    const g = groups.get(key) ?? { name: r.emission.fixture.model.split(' · ')[0], k: r.emission.cct, share: 0, gm: r.emission.gm, n: 0 };
    g.share += r.lux / total;
    g.n++;
    groups.set(key, g);
  }
  for (const g of groups.values()) srcs.push({ ...g, name: g.n > 1 ? `${g.n}× ${g.name}` : g.name });
  if (m.sunLux > 0) srcs.push({ name: 'direct sun', k: info.dl.sunK, share: m.sunLux / total, gm: 0 });
  if (m.skyLux > 0) srcs.push({ name: 'window daylight', k: info.dl.skyK, share: m.skyLux / total, gm: 0 });
  const big = srcs.filter((s) => s.share >= 0.12);
  const out: string[] = [];
  if (big.length > 1) {
    const warm = big.reduce((a, b) => (b.k < a.k ? b : a));
    const cool = big.reduce((a, b) => (b.k > a.k ? b : a));
    const mired = 1e6 / warm.k - 1e6 / cool.k;
    if (mired > 60) {
      const cto = mired >= 140 ? 'full' : mired >= 70 ? '½' : '¼';
      out.push(`Mixed colour: ${warm.name} ${Math.round(warm.k)}K vs ${cool.name} ${Math.round(cool.k)}K — about ${cto} CTO apart. Gel one to match, or split the difference with white balance.`);
    }
  }
  const green = big.find((s) => s.gm > 0.2);
  if (green) out.push(`Green spike from ${green.name} — add ${green.gm > 0.3 ? '½' : '¼'} minus-green on your lights or switch it off.`);
  return out;
}

function MeterHUD({ info }: { info: ViewportInfo }) {
  const view = useStore((s) => s.scene.view);
  const show = useStore((s) => s.meter);
  const set = useStore((s) => s.set);
  const render = useStore((s) => s.render);
  const { fmt } = useLen();
  const m = info.meter;
  if (!show)
    return (
      <button className="hud-pill" onClick={() => set({ meter: true })}>
        <Icon name="target" size={14} /> Meter
      </button>
    );
  const rec = fstopForLux(m.totalLux, view.shutter, view.iso);
  const warnings = colourWarnings(info);
  const diff = view.autoExposure ? 0 : 2 * Math.log2(view.aperture / rec);
  const total = Math.max(1, m.totalLux);
  return (
    <div className="hud">
      <div className="hud-head">
        <b>Incident meter</b>
        <span className="fine">at subject face</span>
        <div className="sp" />
        <button className="icon-btn" onClick={() => set({ meter: false })}>
          <Icon name="x" size={13} />
        </button>
      </div>
      <div className="hud-big">
        <div>
          <span>{Math.round(m.totalLux).toLocaleString()}</span> lx
        </div>
        <div className="hud-f">{formatFStop(rec)}</div>
      </div>
      <div className="fine">
        ISO {view.iso} · {formatShutter(view.shutter)} {view.autoExposure ? '· auto exposure' : `· set f/${view.aperture} (${diff > 0 ? '−' : '+'}${Math.abs(diff).toFixed(1)} EV)`}
      </div>
      <div className="hud-bar">
        {m.readings.slice(0, 6).map((r) => (
          <span key={r.id} style={{ width: `${(r.lux / total) * 100}%`, background: r.color }} title={`${r.name}: ${Math.round(r.lux)} lx`} />
        ))}
        <span style={{ width: `${(m.sunLux / total) * 100}%`, background: '#ffb547' }} title="Direct sun" />
        <span style={{ width: `${(m.skyLux / total) * 100}%`, background: '#8fc7ff' }} title="Sky through windows" />
        <span style={{ width: `${(m.ambientLux / total) * 100}%`, background: '#666' }} title="Bounce" />
      </div>
      <div className="hud-rows">
        {m.readings.slice(0, 4).map((r) => (
          <div key={r.id}>
            <i style={{ background: r.color }} />
            <span>{r.name}</span>
            <b>{Math.round(r.lux)} lx</b>
            <em>{fmt(r.distance)}</em>
          </div>
        ))}
        {m.sunLux > 1 && (
          <div>
            <i style={{ background: '#ffb547' }} />
            <span>Direct sun</span>
            <b>{Math.round(m.sunLux).toLocaleString()} lx</b>
          </div>
        )}
        <div>
          <i style={{ background: '#8fc7ff' }} />
          <span>Window sky</span>
          <b>{Math.round(m.skyLux)} lx</b>
        </div>
        <div>
          <i style={{ background: '#666' }} />
          <span>Room bounce</span>
          <b>{Math.round(m.ambientLux)} lx</b>
        </div>
      </div>
      {warnings.map((w) => (
        <div key={w} className="hud-warn">
          {w}
        </div>
      ))}
      {render === 'pathtrace' && <div className="fine pt-samples">Path tracing · {info.samples} samples</div>}
    </div>
  );
}

function FrameGuides() {
  const view = useStore((s) => s.scene.view);
  const active = useStore((s) => s.scene.objects.find((o) => o.id === s.scene.view.activeCameraId)) as CameraObject | undefined;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const a = ASPECTS[active?.aspect ?? view.aspect] ?? 16 / 9;
  const ca = size.w / size.h;
  const w = ca > a ? size.h * a : size.w;
  const h = ca > a ? size.h : size.w / a;
  return (
    <div className="guides" ref={ref}>
      {view.showGuides && (
        <div className="frame" style={{ width: w, height: h }}>
          <div className="thirds v1" />
          <div className="thirds v2" />
          <div className="thirds h1" />
          <div className="thirds h2" />
          <div className="safe" />
          <span className="frame-lbl">
            {active ? `${active.name} · ` : ''}
            {active?.focalLength ?? view.focalLength}mm · {active?.aspect ?? view.aspect}
          </span>
        </div>
      )}
    </div>
  );
}

function PlotModal({ info, onClose }: { info: ViewportInfo; onClose: () => void }) {
  const scene = useStore((s) => s.scene);
  const calibration = useStore((s) => s.settings.calibration);
  const { fmt } = useLen();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = 1600;
    c.height = Math.round(1600 * Math.min(1.2, scene.room.depth / scene.room.width)) + 200;
    drawPlot(c.getContext('2d')!, scene, info.dl, c.width, c.height, fmt, calibration);
  }, [scene, info, fmt, calibration]);
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal plot">
        <header className="modal-head">
          <h2>Lighting plot</h2>
          <div className="sp" />
          <button
            className="btn"
            onClick={() =>
              ref.current?.toBlob((b) => {
                if (!b) return;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(b);
                a.download = `${scene.name}_plot.png`;
                a.click();
              })
            }
          >
            <Icon name="download" size={16} /> PNG
          </button>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        <canvas ref={ref} className="plot-canvas" />
      </div>
    </div>
  );
}

export function Editor() {
  const st = useStore();
  const [info, setInfo] = useState<ViewportInfo | null>(null);
  const [mapper, setMapper] = useState<null | 'walls' | 'cutout'>(null);
  const [video, setVideo] = useState(false);
  const onInfo = useCallback((i: ViewportInfo) => setInfo(i), []);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        s.save().then(() => s.notify('Scene saved'));
      } else if (mod && e.key.toLowerCase() === 'd' && s.selectedId) {
        e.preventDefault();
        s.duplicateObject(s.selectedId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) {
        s.removeObject(s.selectedId);
      } else if (e.key === 'Escape') {
        s.set({ selectedId: null });
        if (s.scene.view.activeCameraId) s.patchView({ activeCameraId: null });
      } else if (s.nav !== 'fly') {
        if (e.key === 'g') s.set({ transformMode: 'translate' });
        if (e.key === 'r') s.set({ transformMode: 'rotate' });
      }
      if (e.key === 'f' && !mod) s.set({ nav: s.nav === 'fly' ? 'orbit' : 'fly' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // autosave every 30 s when dirty
  useEffect(() => {
    const id = setInterval(() => {
      const s = useStore.getState();
      if (s.dirty && s.screen === 'editor') s.save();
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const panel = st.panel;
  return (
    <div className="editor">
      <TopBar onCapture={() => st.set({ captureOpen: true })} onPlot={() => st.set({ plotOpen: true })} onVideo={() => setVideo(true)} />
      <div className="workspace">
        <nav className="rail">
          {RAIL.map((r) => (
            <button key={r.id} className={'rail-btn' + (panel === r.id ? ' on' : '')} onClick={() => st.set({ panel: r.id })} title={r.label}>
              <Icon name={r.icon} size={20} />
              <span>{r.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
        <aside className="left-panel">
          <h2 className="panel-title">{RAIL.find((r) => r.id === panel)?.label}</h2>
          {panel === 'room' && <RoomPanel onOpenMapper={() => setMapper('walls')} />}
          {panel === 'daylight' && <DaylightPanel />}
          {panel === 'lights' && <LightsPanel />}
          {panel === 'grip' && <GripPanel />}
          {panel === 'subjects' && <SubjectsPanel />}
          {panel === 'props' && <PropsPanel onCutout={() => setMapper('cutout')} />}
          {panel === 'cameras' && <CamerasPanel />}
          {panel === 'outliner' && <OutlinerPanel />}
        </aside>
        <main className="viewport">
          <Viewport onInfo={onInfo} />
          <FrameGuides />
          {info && <MeterHUD info={info} />}
          {st.nav === 'fly' && <div className="nav-hint">Free roam · WASD move · drag to look · Q/E down/up · Shift faster · F to exit</div>}
          {st.scene.view.activeCameraId && (
            <div className="nav-hint top">
              Looking through camera · <button className="link" onClick={() => st.patchView({ activeCameraId: null })}>Exit (Esc)</button>
            </div>
          )}
          {!st.scene.objects.length && !st.scene.room.photos.length && (
            <div className="onboard">
              <h3>Start with your location</h3>
              <ol>
                <li>
                  <button className="link" onClick={() => setMapper('walls')}>Upload listing photos</button> and map the walls (or let AI do it)
                </li>
                <li>
                  <button className="link" onClick={() => st.set({ panel: 'daylight' })}>Enter the address</button> so the sun comes through the right windows
                </li>
                <li>
                  <button className="link" onClick={() => st.set({ panel: 'lights' })}>Add lights</button>, <button className="link" onClick={() => st.set({ panel: 'subjects' })}>subjects</button> and props, then hit Capture
                </li>
              </ol>
            </div>
          )}
        </main>
        <aside className="right-panel">
          <Inspector />
        </aside>
      </div>
      <Timeline info={info} />
      {mapper && <PhotoMapper initialMode={mapper} onClose={() => setMapper(null)} />}
      {st.captureOpen && info && <CaptureDialog info={info} onClose={() => st.set({ captureOpen: false })} />}
      {st.plotOpen && info && <PlotModal info={info} onClose={() => st.set({ plotOpen: false })} />}
      {video && <VideoDialog onClose={() => setVideo(false)} />}
      {st.toast && <div className="toast">{st.toast}</div>}
    </div>
  );
}
