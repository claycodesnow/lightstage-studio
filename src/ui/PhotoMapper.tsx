import { nanoid } from 'nanoid';
import { useEffect, useRef, useState } from 'react';
import { makeCutout, makeLight, makeProp, useStore } from '../store';
import { FIXTURE_MAP } from '../data/fixtures';
import type { Photo, Vec2, WallId, WallProjection, WindowSpec } from '../types';
import { WALLS } from '../types';
import { cropImage, fileToDataUrl, photoToSpan, readExifDate, sampleColor } from '../lib/homography';
import { analyzePhotos } from '../lib/ai';
import { Icon, NumberField, Row, Seg } from './controls';
import { PROP_MAP } from '../data/props';

const WALL_COLORS: Record<WallId, string> = { A: '#ffb547', B: '#4fd1c5', C: '#a78bfa', D: '#f472b6' };
type Mode = 'walls' | 'windows' | 'colors' | 'cutout';

function useImageRect(img: HTMLImageElement | null, deps: unknown[]) {
  const [rect, setRect] = useState({ x: 0, y: 0, w: 1, h: 1 });
  useEffect(() => {
    if (!img) return;
    const update = () => {
      const r = img.getBoundingClientRect();
      const pr = img.parentElement!.getBoundingClientRect();
      setRect({ x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, ...deps]);
  return rect;
}

export function PhotoMapper({ onClose, initialMode = 'walls' }: { onClose: () => void; initialMode?: Mode }) {
  const room = useStore((s) => s.scene.room);
  const patchRoom = useStore((s) => s.patchRoom);
  const addObject = useStore((s) => s.addObject);
  const notify = useStore((s) => s.notify);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [photoId, setPhotoId] = useState<string | null>(room.photos[0]?.id ?? null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [wall, setWall] = useState<WallId>('A');
  const [colorTarget, setColorTarget] = useState<string>('wall-A');
  const [selProj, setSelProj] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ kind: 'corner'; proj: string; idx: number } | { kind: 'rect'; start: Vec2; cur: Vec2 } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [facts, setFacts] = useState({ sqft: 0, height: 0, notes: '' });
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photo = room.photos.find((p) => p.id === photoId) ?? null;
  const rect = useImageRect(imgEl, [photoId]);
  const projections = room.projections.filter((p) => p.photoId === photoId);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: Photo[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const { dataUrl, width, height } = await fileToDataUrl(f);
      added.push({ id: nanoid(8), name: f.name.replace(/\.[^.]+$/, ''), dataUrl, width, height, takenAt: await readExifDate(f) });
    }
    patchRoom({ photos: [...room.photos, ...added] });
    if (!photoId && added[0]) setPhotoId(added[0].id);
    notify(`${added.length} photo${added.length === 1 ? '' : 's'} added`);
  };

  const toNorm = (e: React.PointerEvent): Vec2 => {
    const host = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [(e.clientX - host.left - rect.x) / rect.w, (e.clientY - host.top - rect.y) / rect.h];
  };

  const updateProj = (id: string, p: Partial<WallProjection>) =>
    patchRoom({ projections: room.projections.map((x) => (x.id === id ? { ...x, ...p, rectified: undefined } : x)) });

  const addProjection = () => {
    if (!photo) return;
    const proj: WallProjection = {
      id: nanoid(8),
      photoId: photo.id,
      wall,
      quad: [
        [0.15, 0.82],
        [0.85, 0.82],
        [0.85, 0.15],
        [0.15, 0.15],
      ],
      span: { u0: 0, u1: 1, v0: 0, v1: 1 },
    };
    patchRoom({ projections: [...room.projections, proj] });
    setSelProj(proj.id);
  };

  const wallLen = (w: WallId) => (w === 'A' || w === 'C' ? room.width : room.depth);

  const onUp = async (e: React.PointerEvent) => {
    if (!drag || !photo) return setDrag(null);
    if (drag.kind === 'rect') {
      const a = drag.start, b = toNorm(e);
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      setDrag(null);
      if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
      if (mode === 'windows') {
        const proj = projections.find((p) => p.id === selProj) ?? projections[0];
        if (!proj) return notify('Map a wall on this photo first, then draw windows on it.');
        // map rectangle corners through the wall homography into metres on the wall
        const bl = photoToSpan(proj.quad, [x0, y1]);
        const tr = photoToSpan(proj.quad, [x1, y0]);
        const L = wallLen(proj.wall);
        const u = (s: number) => (proj.span.u0 + s * (proj.span.u1 - proj.span.u0)) * L;
        const v = (s: number) => (proj.span.v0 + s * (proj.span.v1 - proj.span.v0)) * room.height;
        const left = u(bl[0]), right = u(tr[0]), bottom = v(bl[1]), top = v(tr[1]);
        const w: WindowSpec = {
          id: nanoid(6),
          wall: proj.wall,
          offset: +((left + right) / 2).toFixed(2),
          sill: +Math.max(0, bottom).toFixed(2),
          width: +Math.abs(right - left).toFixed(2),
          height: +Math.abs(top - bottom).toFixed(2),
          transmission: 0.85,
          diffuse: false,
          kind: bottom < 0.15 ? 'door' : 'window',
        };
        // the starter placeholder window is replaced by the first real one
        patchRoom({ windows: [...room.windows.filter((x) => x.id !== 'placeholder'), w] });
        notify(`${w.kind === 'door' ? 'Door' : 'Window'} added on wall ${w.wall}: ${w.width} × ${w.height} m`);
      } else if (mode === 'cutout') {
        const crop = { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(1, x1) - Math.max(0, x0), h: Math.min(1, y1) - Math.max(0, y0) };
        const dataUrl = await cropImage(photo.dataUrl, crop);
        let widthM = 1;
        const proj = projections[0];
        if (proj) {
          const l = photoToSpan(proj.quad, [x0, y1]), r = photoToSpan(proj.quad, [x1, y1]);
          widthM = Math.max(0.2, Math.abs(r[0] - l[0]) * (proj.span.u1 - proj.span.u0) * wallLen(proj.wall));
        }
        const heightM = widthM * ((crop.h * photo.height) / (crop.w * photo.width));
        addObject(makeCutout(photo.id, crop, dataUrl, +widthM.toFixed(2), +heightM.toFixed(2), [0, 0, 0]));
        notify('Cut-out added to the scene — move it into place.');
      }
      return;
    }
    setDrag(null);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toNorm(e);
    if (drag.kind === 'corner') {
      const proj = room.projections.find((x) => x.id === drag.proj);
      if (!proj) return;
      const q = proj.quad.map((c) => [...c]) as WallProjection['quad'];
      q[drag.idx] = [Math.max(-0.5, Math.min(1.5, p[0])), Math.max(-0.5, Math.min(1.5, p[1]))];
      useStore.getState().update((s) => ({ ...s, room: { ...s.room, projections: s.room.projections.map((x) => (x.id === proj.id ? { ...x, quad: q, rectified: undefined } : x)) } }), { history: false });
    } else setDrag({ ...drag, cur: p });
  };

  const onDown = async (e: React.PointerEvent) => {
    if (!photo) return;
    const p = toNorm(e);
    if (mode === 'colors') {
      const hex = await sampleColor(photo.dataUrl, p[0], p[1]);
      if (colorTarget.startsWith('wall-')) {
        const w = colorTarget.slice(5) as WallId;
        patchRoom({ wallColors: { ...room.wallColors, [w]: hex } });
      } else if (colorTarget === 'all-walls') patchRoom({ wallColors: { A: hex, B: hex, C: hex, D: hex } });
      else if (colorTarget === 'floor') patchRoom({ floorColor: hex });
      else if (colorTarget === 'ceiling') patchRoom({ ceilingColor: hex });
      notify(`Sampled ${hex} → ${colorTarget.replace('-', ' ')}`);
      return;
    }
    if (mode === 'windows' || mode === 'cutout') setDrag({ kind: 'rect', start: p, cur: p });
  };

  const runAI = async () => {
    let key = settings.anthropicKey;
    if (!key) {
      key = prompt('Paste your Anthropic API key (stored only in this browser). Get one at console.anthropic.com') ?? undefined;
      if (!key) return;
      setSettings({ anthropicKey: key });
    }
    if (!room.photos.length) return notify('Add photos first.');
    setAiBusy(true);
    setAiNote('Analyzing photos… this can take a minute.');
    try {
      const r = await analyzePhotos(key, room.photos, {
        sqft: facts.sqft || undefined,
        height: facts.height ? (settings.units === 'metric' ? facts.height : facts.height * 0.3048) : undefined,
        notes: facts.notes || undefined,
      });
      const projs: WallProjection[] = [];
      for (const ph of r.photos) {
        const photoRef = room.photos[ph.photo_index];
        if (!photoRef) continue;
        for (const w of ph.walls) {
          projs.push({
            id: nanoid(8),
            photoId: photoRef.id,
            wall: w.wall,
            quad: [w.quad.bl, w.quad.br, w.quad.tr, w.quad.tl] as WallProjection['quad'],
            span: { u0: Math.max(0, Math.min(1, w.u0)), u1: Math.max(0, Math.min(1, w.u1)), v0: 0, v1: 1 },
          });
        }
      }
      patchRoom({
        width: r.room.width_m,
        depth: r.room.depth_m,
        height: r.room.height_m,
        floorMaterial: r.room.floor_material,
        floorColor: r.room.floor_color,
        ceilingColor: r.room.ceiling_color,
        wallColors: r.wall_colors,
        projections: projs.length ? projs : room.projections,
        windows: r.windows.map((w) => ({
          id: nanoid(6),
          wall: w.wall,
          offset: w.offset_m,
          sill: w.sill_m,
          width: w.width_m,
          height: w.height_m,
          kind: w.kind,
          transmission: w.covering === 'blackout' ? 0 : w.covering === 'sheer' ? 0.45 : w.covering === 'blinds' ? 0.4 : 0.85,
          diffuse: w.covering === 'sheer',
        })),
      });
      for (const f of r.furniture) {
        if (!PROP_MAP.has(f.prop_id)) continue;
        addObject({ ...makeProp(f.prop_id, [f.x_m, 0, f.z_m]), rotationY: f.rotation_deg, color: f.color, name: f.label || PROP_MAP.get(f.prop_id)!.name });
      }
      for (const h of r.house_lights ?? []) {
        if (!FIXTURE_MAP.has(h.fixture_id)) continue;
        addObject({ ...makeLight(h.fixture_id, [h.x_m, 0, h.z_m]), name: h.label || FIXTURE_MAP.get(h.fixture_id)!.model });
      }
      setAiNote(`${r.room.reasoning}\n\nOrientation clues: ${r.orientation_hint}`);
      notify('AI layout applied — review the wall corners and windows.');
    } catch (err) {
      console.error(err);
      setAiNote(null);
      notify('AI analysis failed: ' + (err as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const rectDraw = drag?.kind === 'rect' ? drag : null;

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal mapper">
        <header className="modal-head">
          <h2>Photo mapper</h2>
          <Seg
            value={mode}
            onChange={setMode}
            options={[
              { v: 'walls', label: '1 · Wall corners' },
              { v: 'windows', label: '2 · Windows & doors' },
              { v: 'colors', label: '3 · Sample colours' },
              { v: 'cutout', label: '4 · Cut out props' },
            ]}
          />
          <div className="sp" />
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        <div className="mapper-body">
          <aside className="mapper-photos">
            <button className="btn wide" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} /> Add photos
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                upload(e.dataTransfer.files);
              }}
            >
              {room.photos.map((p) => (
                <div key={p.id} className={'thumb' + (p.id === photoId ? ' on' : '')} onClick={() => setPhotoId(p.id)}>
                  <img src={p.dataUrl} alt="" />
                  <div className="thumb-tags">
                    {room.projections
                      .filter((x) => x.photoId === p.id)
                      .map((x) => (
                        <span key={x.id} style={{ background: WALL_COLORS[x.wall] }}>
                          {x.wall}
                        </span>
                      ))}
                  </div>
                  <button
                    className="thumb-del"
                    title="Remove photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      patchRoom({ photos: room.photos.filter((x) => x.id !== p.id), projections: room.projections.filter((x) => x.photoId !== p.id) });
                      if (photoId === p.id) setPhotoId(null);
                    }}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}
              {!room.photos.length && <div className="empty">Drop listing photos here (JPG/PNG). Wide shots that show where walls meet the floor & ceiling work best.</div>}
            </div>
            <div className="ai-box">
              <h4>
                <Icon name="sparkle" size={15} /> AI first pass
              </h4>
              <p className="fine">Claude reads every photo, uses the windows to work out how they fit together, and proposes dimensions, wall mapping, windows, colours and furniture.</p>
              <Row label={settings.units === 'metric' ? 'Listed m²' : 'Listed sq ft'}>
                <NumberField value={facts.sqft} onChange={(v) => setFacts({ ...facts, sqft: settings.units === 'metric' ? v * 10.7639 : v })} />
              </Row>
              <Row label={`Ceiling (${settings.units === 'metric' ? 'm' : 'ft'})`}>
                <NumberField value={facts.height} step={0.1} onChange={(v) => setFacts({ ...facts, height: v })} />
              </Row>
              <textarea className="notes" placeholder="Listing description / notes (optional)" value={facts.notes} onChange={(e) => setFacts({ ...facts, notes: e.target.value })} />
              <button className="btn primary wide" disabled={aiBusy || !room.photos.length} onClick={runAI}>
                {aiBusy ? 'Analyzing…' : 'Analyze photos with Claude'}
              </button>
              {aiNote && <pre className="ai-note">{aiNote}</pre>}
            </div>
          </aside>
          <main className="mapper-stage" onPointerMove={onMove} onPointerUp={onUp} onPointerDown={onDown}>
            {photo ? (
              <>
                <img ref={setImgEl} src={photo.dataUrl} alt="" draggable={false} className={'stage-img mode-' + mode} />
                <svg className="stage-svg" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} viewBox="0 0 1 1" preserveAspectRatio="none">
                  {projections.map((p) => (
                    <g key={p.id} onPointerDown={(e) => mode === 'walls' && (e.stopPropagation(), setSelProj(p.id))}>
                      <polygon
                        points={p.quad.map((c) => c.join(',')).join(' ')}
                        fill={WALL_COLORS[p.wall] + (p.id === selProj ? '33' : '1a')}
                        stroke={WALL_COLORS[p.wall]}
                        strokeWidth={p.id === selProj ? 0.004 : 0.0025}
                        vectorEffect="non-scaling-stroke"
                      />
                      <text x={(p.quad[0][0] + p.quad[2][0]) / 2} y={(p.quad[0][1] + p.quad[2][1]) / 2} fontSize={0.06} fill={WALL_COLORS[p.wall]} textAnchor="middle" className="quad-lbl">
                        {p.wall}
                      </text>
                    </g>
                  ))}
                  {rectDraw && (
                    <rect
                      x={Math.min(rectDraw.start[0], rectDraw.cur[0])}
                      y={Math.min(rectDraw.start[1], rectDraw.cur[1])}
                      width={Math.abs(rectDraw.cur[0] - rectDraw.start[0])}
                      height={Math.abs(rectDraw.cur[1] - rectDraw.start[1])}
                      fill="#ffffff22"
                      stroke="#fff"
                      strokeDasharray="0.01 0.006"
                      strokeWidth={0.003}
                    />
                  )}
                </svg>
                {mode === 'walls' &&
                  projections.map((p) =>
                    p.quad.map((c, i) => (
                      <div
                        key={p.id + i}
                        className="handle"
                        style={{ left: rect.x + c[0] * rect.w, top: rect.y + c[1] * rect.h, borderColor: WALL_COLORS[p.wall] }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                          setSelProj(p.id);
                          setDrag({ kind: 'corner', proj: p.id, idx: i });
                        }}
                        title={['floor-left', 'floor-right', 'ceiling-right', 'ceiling-left'][i]}
                      >
                        <span>{['FL', 'FR', 'CR', 'CL'][i]}</span>
                      </div>
                    )),
                  )}
              </>
            ) : (
              <div className="empty big">Add a photo to begin.</div>
            )}
          </main>
          <aside className="mapper-side">
            {mode === 'walls' && (
              <>
                <h4>Map a wall</h4>
                <p className="fine">
                  Choose the wall this photo shows, then drag the four handles to where that wall meets the floor (FL, FR) and ceiling (CR, CL). The window wall is <b>A</b>; B is to its right.
                </p>
                <Seg value={wall} onChange={setWall} options={WALLS.map((w) => ({ v: w, label: `Wall ${w}` }))} />
                <button className="btn primary wide" disabled={!photo} onClick={addProjection}>
                  <Icon name="plus" size={15} /> Map wall {wall} on this photo
                </button>
                {projections.map((p) => (
                  <div key={p.id} className={'card' + (p.id === selProj ? ' sel' : '')} onClick={() => setSelProj(p.id)}>
                    <div className="card-head">
                      <span className="dot" style={{ background: WALL_COLORS[p.wall] }} />
                      <b>Wall {p.wall}</b>
                      <Seg small value={p.wall} onChange={(v) => updateProj(p.id, { wall: v })} options={WALLS.map((w) => ({ v: w, label: w }))} />
                      <button className="icon-btn" onClick={() => patchRoom({ projections: room.projections.filter((x) => x.id !== p.id) })}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                    <p className="fine">Portion of the wall visible (0 = left end, 1 = right end, facing the wall):</p>
                    <Row label="From">
                      <NumberField value={p.span.u0} step={0.01} min={0} max={1} onChange={(v) => updateProj(p.id, { span: { ...p.span, u0: v } })} />
                    </Row>
                    <Row label="To">
                      <NumberField value={p.span.u1} step={0.01} min={0} max={1} onChange={(v) => updateProj(p.id, { span: { ...p.span, u1: v } })} />
                    </Row>
                  </div>
                ))}
              </>
            )}
            {mode === 'windows' && (
              <>
                <h4>Windows & doors</h4>
                <p className="fine">Select a mapped wall, then drag a box around each window or door in the photo. Its real size and position are worked out from the wall's perspective.</p>
                {projections.map((p) => (
                  <button key={p.id} className={'list-row' + ((selProj ?? projections[0]?.id) === p.id ? ' sel' : '')} onClick={() => setSelProj(p.id)}>
                    <span className="dot" style={{ background: WALL_COLORS[p.wall] }} /> Draw on wall {p.wall}
                  </button>
                ))}
                {!projections.length && <div className="empty">Map a wall on this photo first (step 1).</div>}
                <h4>On the plan</h4>
                {room.windows.map((w) => (
                  <div key={w.id} className="kv">
                    <span>
                      {w.kind} · wall {w.wall}
                    </span>
                    <b>
                      {w.width.toFixed(2)} × {w.height.toFixed(2)} m
                    </b>
                  </div>
                ))}
              </>
            )}
            {mode === 'colors' && (
              <>
                <h4>Eyedropper</h4>
                <p className="fine">Pick a target, then click a clean, evenly lit patch in the photo. Colour is sampled as-photographed (sRGB).</p>
                <div className="grid2">
                  {[...WALLS.map((w) => ['wall-' + w, 'Wall ' + w]), ['all-walls', 'All walls'], ['floor', 'Floor'], ['ceiling', 'Ceiling']].map(([id, label]) => (
                    <button key={id} className={'tile' + (colorTarget === id ? ' on' : '')} onClick={() => setColorTarget(id)}>
                      <span
                        className="swatch"
                        style={{
                          background: id.startsWith('wall-') ? room.wallColors[id.slice(5) as WallId] : id === 'floor' ? room.floorColor : id === 'ceiling' ? room.ceilingColor : room.wallColors.A,
                        }}
                      />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {mode === 'cutout' && (
              <>
                <h4>Cut out props</h4>
                <p className="fine">Drag a box around a piece of furniture or decor. It becomes a movable card textured from the photo. Size is estimated from the mapped wall; adjust in the inspector.</p>
                <p className="fine">For fully 3D, relightable furniture, use the Props library and sample its colour from the photo.</p>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
