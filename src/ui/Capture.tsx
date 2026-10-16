import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { viewportApi, type ViewportInfo } from '../three/Viewport';
import { ASPECTS, SENSOR_MAP } from '../data/modifiers';
import { formatFStop, formatShutter, fstopForLux } from '../lib/photometry';
import { bearingName } from '../lib/sun';
import { downloadBlob } from '../lib/storage';
import type { CameraObject } from '../types';
import { drawPlot } from './plot';
import { Icon, Row, Select, Toggle, useLen } from './controls';
import { loadImage } from '../lib/homography';

function dataUrlToBlob(url: string) {
  const [meta, b64] = url.split(',');
  const mime = meta.match(/:(.*?);/)![1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function CaptureDialog({ info, onClose }: { info: ViewportInfo; onClose: () => void }) {
  const scene = useStore((s) => s.scene);
  const save = useStore((s) => s.save);
  const calibration = useStore((s) => s.settings.calibration);
  const render = useStore((s) => s.render);
  const { fmt } = useLen();
  const [width, setWidth] = useState(1920);
  const [withData, setWithData] = useState(true);
  const [withPlot, setWithPlot] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const busy = useRef(false);
  const cam = scene.objects.find((o) => o.id === scene.view.activeCameraId) as CameraObject | undefined;
  const lens = cam ?? scene.view;
  const aspect = ASPECTS[lens.aspect] ?? 16 / 9;

  useEffect(() => {
    if (busy.current) return;
    busy.current = true;
    viewportApi.current
      ?.capture({ width, aspect })
      .then(setFrame)
      .finally(() => (busy.current = false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  useEffect(() => {
    if (!frame) return;
    (async () => {
      const img = await loadImage(frame);
      const W = img.width;
      const panelH = withData ? Math.round(Math.max(260, W * 0.2)) : 0;
      const plotW = withPlot && withData ? Math.round(panelH * 1.3) : 0;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = img.height + panelH;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      if (withData) {
        const y0 = img.height;
        ctx.fillStyle = '#0b0c0f';
        ctx.fillRect(0, y0, W, panelH);
        const k = panelH / 300;
        const pad = 22 * k;
        ctx.fillStyle = '#ffb547';
        ctx.font = `700 ${20 * k}px Inter, sans-serif`;
        ctx.fillText(scene.name, pad, y0 + pad + 16 * k);
        ctx.fillStyle = '#9aa0ab';
        ctx.font = `500 ${13 * k}px Inter, sans-serif`;
        const when = info.dl.date.toLocaleString(undefined, { timeZone: scene.location.timeZone, dateStyle: 'medium', timeStyle: 'short' });
        ctx.fillText(`${when} · ${scene.location.address || `${scene.location.lat.toFixed(3)}, ${scene.location.lon.toFixed(3)}`}`.slice(0, 120), pad, y0 + pad + 38 * k);
        const sensor = SENSOR_MAP.get(lens.sensorId)?.name ?? '';
        const cols: [string, string][] = [
          ['Lens', `${lens.focalLength}mm · ${sensor}`],
          ['Frame', `${lens.aspect}`],
          ['Exposure', `ISO ${scene.view.iso} · ${formatShutter(scene.view.shutter)} · f/${scene.view.aperture}${scene.view.autoExposure ? ' (auto)' : ''}`],
          ['White balance', `${scene.view.whiteBalance}K`],
          ['Sun', `${info.dl.altitude.toFixed(1)}° alt · ${info.dl.azimuth.toFixed(0)}° ${bearingName(info.dl.azimuth)} · ${Math.round(info.dl.sunLux).toLocaleString()} lx`],
          ['At subject', `${Math.round(info.meter.totalLux).toLocaleString()} lx → ${formatFStop(fstopForLux(info.meter.totalLux, scene.view.shutter, scene.view.iso))}`],
          ['Wall A faces', `${scene.location.wallABearing}° ${bearingName(scene.location.wallABearing)}`],
          ['Render', render === 'pathtrace' ? `Path traced · ${info.samples} spp` : 'Real-time'],
        ];
        ctx.font = `500 ${12 * k}px Inter, sans-serif`;
        cols.forEach(([kk, v], i) => {
          const col = i % 2, row = Math.floor(i / 2);
          const x = pad + col * 300 * k, y = y0 + pad + (70 + row * 34) * k;
          ctx.fillStyle = '#6b7280';
          ctx.fillText(kk.toUpperCase(), x, y);
          ctx.fillStyle = '#e8eaee';
          ctx.font = `600 ${13 * k}px Inter, sans-serif`;
          ctx.fillText(v, x, y + 16 * k);
          ctx.font = `500 ${12 * k}px Inter, sans-serif`;
        });
        // lights list
        const lx = pad + 620 * k;
        ctx.fillStyle = '#6b7280';
        ctx.fillText('LIGHTS → SUBJECT', lx, y0 + pad + 70 * k);
        info.meter.readings.slice(0, 6).forEach((r, i) => {
          const y = y0 + pad + (92 + i * 32) * k;
          ctx.fillStyle = r.color;
          ctx.fillRect(lx, y - 10 * k, 10 * k, 10 * k);
          ctx.fillStyle = '#e8eaee';
          ctx.font = `600 ${12 * k}px Inter, sans-serif`;
          const mod = r.emission.modifier ? ` + ${r.emission.modifier.name.split(' (')[0]}` : '';
          ctx.fillText(`${r.name}${mod}`.slice(0, 46), lx + 16 * k, y);
          ctx.fillStyle = '#9aa0ab';
          ctx.font = `500 ${12 * k}px Inter, sans-serif`;
          ctx.fillText(`${fmt(r.distance)} · ${Math.round(r.lux)} lx · ${formatFStop(fstopForLux(r.lux, scene.view.shutter, scene.view.iso))} · ${r.emission.cctLabel}`, lx + 16 * k, y + 15 * k);
        });
        if (plotW) {
          const pc = document.createElement('canvas');
          pc.width = plotW * 2;
          pc.height = panelH * 2;
          drawPlot(pc.getContext('2d')!, scene, info.dl, pc.width, pc.height, fmt, calibration);
          ctx.drawImage(pc, W - plotW, y0, plotW, panelH);
        }
      }
      setResult(c.toDataURL('image/png'));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, withData, withPlot]);

  const filename = `${scene.name.replace(/[^\w\- ]+/g, '').trim() || 'shot'}_${info.dl.date.toISOString().slice(0, 16).replace(/[:T]/g, '-')}_${lens.focalLength}mm.png`;

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal capture">
        <header className="modal-head">
          <h2>Capture</h2>
          <div className="sp" />
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        <div className="capture-body">
          <div className="capture-preview">{result ? <img src={result} alt="capture" /> : <div className="empty big">Rendering…</div>}</div>
          <aside>
            <Row label="Resolution">
              <Select value={String(width)} onChange={(v) => setWidth(+v)}>
                <option value="1280">1280 px</option>
                <option value="1920">1920 px (HD)</option>
                <option value="2560">2560 px</option>
                <option value="3840">3840 px (UHD)</option>
              </Select>
            </Row>
            <Row label="Data strip">
              <Toggle value={withData} onChange={setWithData} />
            </Row>
            <Row label="Lighting plot">
              <Toggle value={withPlot} onChange={setWithPlot} />
            </Row>
            {render === 'pathtrace' && <p className="fine">Path-traced captures use the current viewport accumulation ({info.samples} samples). Let it converge for cleaner shadows.</p>}
            <button className="btn primary wide" disabled={!result} onClick={() => result && downloadBlob(dataUrlToBlob(result), filename)}>
              <Icon name="download" size={16} /> Download PNG
            </button>
            <button
              className="btn wide"
              disabled={!frame}
              onClick={async () => {
                if (!frame) return;
                const img = await loadImage(frame);
                const c = document.createElement('canvas');
                c.width = 480;
                c.height = Math.round(480 / aspect);
                c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
                await save(c.toDataURL('image/jpeg', 0.8));
                useStore.getState().notify('Saved with this frame as the thumbnail');
              }}
            >
              <Icon name="save" size={16} /> Use as scene thumbnail
            </button>
            <button
              className="btn wide"
              onClick={() => {
                const pc = document.createElement('canvas');
                pc.width = 2000;
                pc.height = Math.round(2000 * (scene.room.depth / scene.room.width)) + 300;
                drawPlot(pc.getContext('2d')!, scene, info.dl, pc.width, pc.height, fmt, calibration);
                pc.toBlob((b) => b && downloadBlob(b, filename.replace('.png', '_plot.png')));
              }}
            >
              <Icon name="plot" size={16} /> Download lighting plot
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
