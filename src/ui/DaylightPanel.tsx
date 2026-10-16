import { useState } from 'react';
import { useStore } from '../store';
import { analyzeFootprint, fetchFootprint, geocode, timeZoneFor, type Footprint, type GeoResult } from '../lib/geo';
import { bearingName, dateToLocal, formatClock, localToDate, sunPosition, wallFacingBearing } from '../lib/sun';
import { Icon, NumberField, Row, Section, Slider, Toggle } from './controls';
import { WALLS } from '../types';

function Compass({ wallABearing, sunAz, sunAlt, onChange }: { wallABearing: number; sunAz: number; sunAlt: number; onChange: (b: number) => void }) {
  // Room drawn fixed with wall A at top; north arrow rotates.
  const S = 200, c = S / 2;
  const northAngle = -wallABearing; // screen rotation of true north relative to "up = wall A outward"
  const rot = (deg: number, r: number) => {
    const a = ((deg + northAngle) * Math.PI) / 180;
    return [c + Math.sin(a) * r, c - Math.cos(a) * r];
  };
  const [sx, sy] = rot(sunAz, 82);
  const drag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1) return;
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    // dragging sets where north is: angle of pointer = north direction on screen
    const screenDeg = (Math.atan2(x, -y) * 180) / Math.PI;
    onChange(Math.round(((-screenDeg % 360) + 360) % 360));
  };
  return (
    <svg className="compass" viewBox={`0 0 ${S} ${S}`} onPointerDown={drag} onPointerMove={drag}>
      <circle cx={c} cy={c} r={92} className="ring" />
      {Array.from({ length: 36 }).map((_, i) => {
        const [x1, y1] = rot(i * 10, 92);
        const [x2, y2] = rot(i * 10, i % 9 === 0 ? 80 : 86);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="tick" />;
      })}
      {['N', 'E', 'S', 'W'].map((n, i) => {
        const [x, y] = rot(i * 90, 70);
        return (
          <text key={n} x={x} y={y + 4} className={'cardinal' + (n === 'N' ? ' n' : '')}>
            {n}
          </text>
        );
      })}
      <rect x={c - 34} y={c - 26} width={68} height={52} className="roomrect" />
      <line x1={c - 34} y1={c - 26} x2={c + 34} y2={c - 26} className="wallA" />
      <text x={c} y={c - 32} className="walllbl">A</text>
      <text x={c + 42} y={c + 4} className="walllbl">B</text>
      <text x={c} y={c + 40} className="walllbl">C</text>
      <text x={c - 42} y={c + 4} className="walllbl">D</text>
      {sunAlt > -6 && (
        <g>
          <line x1={c} y1={c} x2={sx} y2={sy} className="sunray" />
          <circle cx={sx} cy={sy} r={8} className={'sundot' + (sunAlt < 0 ? ' down' : '')} />
        </g>
      )}
    </svg>
  );
}

function FootprintView({ fp, wallABearing, onPick }: { fp: Footprint; wallABearing: number; onPick: (b: number) => void }) {
  const xs = fp.polygon.map((p) => p[0]), ys = fp.polygon.map((p) => p[1]);
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 0), minY = Math.min(...ys, 0), maxY = Math.max(...ys, 0);
  const span = Math.max(maxX - minX, maxY - minY, 10);
  const S = 220, pad = 24;
  const tx = (x: number) => pad + ((x - minX) / span) * (S - 2 * pad);
  const ty = (y: number) => S - pad - ((y - minY) / span) * (S - 2 * pad);
  return (
    <svg className="footprint" viewBox={`0 0 ${S} ${S}`}>
      <text x={S - 16} y={18} className="cardinal n">N↑</text>
      <polygon points={fp.polygon.map((p) => `${tx(p[0])},${ty(p[1])}`).join(' ')} className="fp-poly" />
      {fp.facades.map((f, i) => {
        const on = Math.abs(((f.bearing - wallABearing + 540) % 360) - 180) < 12;
        const mx = (tx(f.a[0]) + tx(f.b[0])) / 2, my = (ty(f.a[1]) + ty(f.b[1])) / 2;
        return (
          <g key={i} onClick={() => onPick(Math.round(f.bearing))} className="fp-edge-g">
            <line x1={tx(f.a[0])} y1={ty(f.a[1])} x2={tx(f.b[0])} y2={ty(f.b[1])} className={'fp-edge' + (on ? ' on' : '')} />
            {f.length > span * 0.12 && (
              <text x={mx + Math.sin((f.bearing * Math.PI) / 180) * 12} y={my - Math.cos((f.bearing * Math.PI) / 180) * 12 + 3} className="fp-lbl">
                {bearingName(f.bearing)}
              </text>
            )}
          </g>
        );
      })}
      <circle cx={tx(0)} cy={ty(0)} r={4} className="fp-pin" />
    </svg>
  );
}

export function DaylightPanel() {
  const scene = useStore((s) => s.scene);
  const patchLocation = useStore((s) => s.patchLocation);
  const patchTime = useStore((s) => s.patchTime);
  const notify = useStore((s) => s.notify);
  const { location, time } = scene;
  const [q, setQ] = useState(location.address);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [fp, setFp] = useState<Footprint | null>(location.footprint ? analyzeFootprint(location.footprint) : null);

  const date = localToDate(time.local, location.timeZone);
  const sp = sunPosition(date, location.lat, location.lon);

  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const r = await geocode(q);
      setResults(r);
      if (!r.length) notify('No matches — try adding the city or ZIP code.');
    } catch (e) {
      notify(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const pick = async (r: GeoResult) => {
    setResults([]);
    setQ(r.displayName);
    patchLocation({ address: r.displayName, lat: r.lat, lon: r.lon, timeZone: r.timeZone });
    // keep the same wall-clock time at the new location
    setBusy(true);
    try {
      const f = await fetchFootprint(r.lat, r.lon);
      setFp(f);
      if (f) {
        patchLocation({ footprint: f.polygon });
        notify(`Found the building outline — façades face ${f.dominant.slice(0, 4).map((d) => bearingName(d.bearing)).join(', ')}. Click the façade your main window is on.`);
      } else notify('No building outline found nearby. Set the window direction with the compass.');
    } catch {
      notify('Building lookup unavailable right now. Set the window direction with the compass.');
    } finally {
      setBusy(false);
    }
  };

  const setClock = (d: Date) => patchTime({ local: dateToLocal(d, location.timeZone), live: false });
  const golden = sp.sunset ? new Date(sp.sunset.getTime() - 50 * 60000) : undefined;
  const morningGolden = sp.sunrise ? new Date(sp.sunrise.getTime() + 40 * 60000) : undefined;
  const blue = sp.sunset ? new Date(sp.sunset.getTime() + 20 * 60000) : undefined;

  return (
    <div className="panel-scroll">
      <Section title="Location">
        <div className="search">
          <Icon name="search" size={15} />
          <input placeholder="Street address, venue or city" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
          <button className="btn small" onClick={search} disabled={busy}>
            {busy ? '…' : 'Find'}
          </button>
        </div>
        {results.map((r) => (
          <button key={r.lat + ',' + r.lon} className="list-row" onClick={() => pick(r)}>
            {r.displayName}
          </button>
        ))}
        <div className="kv">
          <span>Lat / Lon</span>
          <b>
            {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
          </b>
        </div>
        <div className="kv">
          <span>Time zone</span>
          <b>{location.timeZone}</b>
        </div>
        <Row label="Manual lat">
          <NumberField value={location.lat} step={0.0001} min={-90} max={90} onChange={(v) => patchLocation({ lat: v, timeZone: timeZoneFor(v, location.lon) })} />
        </Row>
        <Row label="Manual lon">
          <NumberField value={location.lon} step={0.0001} min={-180} max={180} onChange={(v) => patchLocation({ lon: v, timeZone: timeZoneFor(location.lat, v) })} />
        </Row>
      </Section>

      <Section title="Window orientation">
        {fp && (
          <>
            <p className="fine">Building outline from OpenStreetMap. Click the façade that your main window (wall A) is on.</p>
            <FootprintView fp={fp} wallABearing={location.wallABearing} onPick={(b) => patchLocation({ wallABearing: b, orientationSource: 'osm-footprint' })} />
          </>
        )}
        <p className="fine">Drag on the compass to rotate north. The room is drawn from above with wall A at the top.</p>
        <Compass wallABearing={location.wallABearing} sunAz={sp.azimuth} sunAlt={sp.altitude} onChange={(b) => patchLocation({ wallABearing: b, orientationSource: 'manual' })} />
        <Slider
          label="Wall A faces"
          value={location.wallABearing}
          min={0}
          max={359}
          step={1}
          format={(v) => `${Math.round(v)}° ${bearingName(v)}`}
          onChange={(v) => patchLocation({ wallABearing: v, orientationSource: 'manual' })}
        />
        <div className="facing">
          {WALLS.map((w) => (
            <div key={w}>
              <span>Wall {w}</span>
              <b>{bearingName(wallFacingBearing(w, location.wallABearing))}</b>
            </div>
          ))}
        </div>
        <p className="fine">
          Source: {location.orientationSource === 'osm-footprint' ? 'building footprint (OSM)' : location.orientationSource === 'ai' ? 'AI photo analysis' : location.orientationSource === 'manual' ? 'set manually' : 'default — please set'}.
          Tip: a phone compass held flat against the window gives an exact reading on a scout.
        </p>
      </Section>

      <Section title="Date & time">
        <Row label="Date">
          <input
            type="date"
            className="select"
            value={time.local.slice(0, 10)}
            onChange={(e) => e.target.value && patchTime({ local: e.target.value + 'T' + time.local.slice(11, 16), live: false })}
          />
        </Row>
        <Row label="Time">
          <input type="time" className="select" value={time.local.slice(11, 16)} onChange={(e) => e.target.value && patchTime({ local: time.local.slice(0, 10) + 'T' + e.target.value, live: false })} />
        </Row>
        <Row label="Follow real time">
          <Toggle value={time.live} onChange={(v) => patchTime({ live: v })} />
        </Row>
        <div className="chips">
          <button className="chip" onClick={() => setClock(new Date())}>
            Now
          </button>
          {morningGolden && (
            <button className="chip" onClick={() => setClock(morningGolden)}>
              Morning golden
            </button>
          )}
          {sp.solarNoon && (
            <button className="chip" onClick={() => setClock(sp.solarNoon!)}>
              Solar noon
            </button>
          )}
          {golden && (
            <button className="chip" onClick={() => setClock(golden)}>
              Golden hour
            </button>
          )}
          {blue && (
            <button className="chip" onClick={() => setClock(blue)}>
              Blue hour
            </button>
          )}
        </div>
        <div className="kv">
          <span>Sunrise / sunset</span>
          <b>
            {formatClock(sp.sunrise, location.timeZone)} / {formatClock(sp.sunset, location.timeZone)}
          </b>
        </div>
        <div className="kv">
          <span>Sun</span>
          <b>
            {sp.altitude.toFixed(1)}° alt · {sp.azimuth.toFixed(0)}° {bearingName(sp.azimuth)}
          </b>
        </div>
        {scene.room.photos.some((p) => p.takenAt) && (
          <>
            <p className="fine">Match the light in a listing photo (from its EXIF timestamp):</p>
            <div className="chips">
              {scene.room.photos
                .filter((p) => p.takenAt)
                .map((p) => (
                  <button key={p.id} className="chip" onClick={() => patchTime({ local: p.takenAt!, live: false })}>
                    {p.name.slice(0, 16)} · {p.takenAt!.replace('T', ' ')}
                  </button>
                ))}
            </div>
          </>
        )}
      </Section>

      <Section title="Weather & exterior">
        <Slider label="Cloud cover" value={time.cloudCover} min={0} max={1} format={(v) => (v < 0.15 ? 'Clear' : v < 0.45 ? 'Scattered' : v < 0.8 ? 'Broken' : 'Overcast')} onChange={(v) => patchTime({ cloudCover: v })} />
        <Slider label="Ground outside (albedo)" value={time.outdoorBounce} min={0.05} max={0.8} format={(v) => (v < 0.15 ? 'Asphalt' : v < 0.3 ? 'Grass / street' : v < 0.5 ? 'Concrete' : 'Snow / white')} onChange={(v) => patchTime({ outdoorBounce: v })} />
      </Section>
    </div>
  );
}
