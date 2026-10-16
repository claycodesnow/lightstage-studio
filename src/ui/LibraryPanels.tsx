import { useMemo, useState } from 'react';
import { CATEGORY_LABEL, FIXTURES, FIXTURE_MAP, type FixtureCategory } from '../data/fixtures';
import { FLAGS } from '../data/modifiers';
import { PROPS } from '../data/props';
import { SKIN_TONES } from '../lib/color';
import { makeCamera, makeFlag, makeLight, makeProp, makeSubject, useStore } from '../store';
import type { CameraObject, LightObject, SceneObject, SubjectObject } from '../types';
import { Icon, NumberField, Row, Section, Seg, Select, Slider } from './controls';
import { aimAt, lightSpawnPoint, spawnPoint, subjectTarget, yawTowardViewer } from './placement';

const HOUSE = FIXTURES.filter((f) => f.category === 'house');

/** The fixtures already installed in a rental: grids of cans, troffers, pendants — with group on/off and dimming. */
function HouseLighting() {
  const scene = useStore((s) => s.scene);
  const update = useStore((s) => s.update);
  const [fixtureId, setFixtureId] = useState(HOUSE[1].id);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(3);
  const house = scene.objects.filter((o): o is LightObject => o.kind === 'light' && FIXTURE_MAP.get(o.fixtureId)?.category === 'house');
  const anyOn = house.some((l) => l.enabled);
  const avgDim = house.length ? house.reduce((s, l) => s + l.dimmer, 0) / house.length : 100;
  const f = FIXTURE_MAP.get(fixtureId)!;
  const gridable = f.houseMount === 'recessed' || f.houseMount === 'troffer' || f.houseMount === 'pendant' || f.houseMount === 'track' || f.houseMount === 'flush';
  const addGrid = () => {
    const { room } = scene;
    const r = gridable ? rows : 1, c = gridable ? cols : 1;
    const lights: LightObject[] = [];
    for (let i = 0; i < r; i++)
      for (let j = 0; j < c; j++) {
        // evenly spaced, half-spacing from the walls (how electricians lay out cans)
        const x = -room.width / 2 + (room.width / c) * (j + 0.5);
        const z = -room.depth / 2 + (room.depth / r) * (i + 0.5);
        const l = makeLight(fixtureId, [x, 0, z]);
        lights.push({ ...l, name: `${f.model.split(' · ')[0]} ${i * c + j + 1}`, rotationY: f.houseMount === 'track' ? 180 : 0 });
      }
    update((s) => ({ ...s, objects: [...s.objects, ...lights] }));
  };
  const setAll = (p: Partial<LightObject>) =>
    update((s) => ({ ...s, objects: s.objects.map((o) => (o.kind === 'light' && FIXTURE_MAP.get(o.fixtureId)?.category === 'house' ? ({ ...o, ...p } as LightObject) : o)) }));
  return (
    <Section title="House lighting (already installed)">
      <p className="fine">Rentals come with their own lights — usually the wrong colour. Add what the listing shows so you can see how it mixes with daylight and your kit.</p>
      <Row label="Fixture">
        <Select value={fixtureId} onChange={setFixtureId}>
          {HOUSE.map((h) => (
            <option key={h.id} value={h.id}>
              {h.model}
            </option>
          ))}
        </Select>
      </Row>
      {gridable && (
        <>
          <Row label="Rows (A → C)">
            <NumberField value={rows} min={1} max={8} onChange={(v) => setRows(Math.round(v))} />
          </Row>
          <Row label="Columns (D → B)">
            <NumberField value={cols} min={1} max={8} onChange={(v) => setCols(Math.round(v))} />
          </Row>
        </>
      )}
      <button className="btn wide" onClick={addGrid}>
        <Icon name="plus" size={15} /> {gridable ? `Add ${rows * cols} evenly spaced` : 'Add one'}
      </button>
      {house.length > 0 && (
        <>
          <Row label={`All ${house.length} house lights`}>
            <Seg
              small
              value={anyOn ? 'on' : 'off'}
              onChange={(v) => setAll({ enabled: v === 'on' })}
              options={[
                { v: 'on', label: 'On' },
                { v: 'off', label: 'Off' },
              ]}
            />
          </Row>
          <Slider label="House dimmer" value={avgDim} min={0} max={100} step={1} format={(v) => `${Math.round(v)}%`} onChange={(v) => setAll({ dimmer: v })} />
        </>
      )}
    </Section>
  );
}

export function LightsPanel() {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('All');
  const [cat, setCat] = useState<FixtureCategory | 'all'>('all');
  const add = useStore((s) => s.addObject);
  const brands = useMemo(() => ['All', ...Array.from(new Set(FIXTURES.map((f) => f.brand)))], []);
  const list = FIXTURES.filter(
    (f) =>
      (brand === 'All' || f.brand === brand) &&
      (cat === 'all' || f.category === cat) &&
      (!q || (f.brand + ' ' + f.model + ' ' + f.category + ' ' + f.color).toLowerCase().includes(q.toLowerCase())),
  );
  const place = (id: string) => {
    const p = lightSpawnPoint();
    const l = makeLight(id, p);
    const fixedMount = ['recessed', 'troffer', 'flush', 'pendant', 'cabinet', 'wall'].includes(FIXTURE_MAP.get(id)?.houseMount ?? '');
    add(fixedMount ? l : { ...l, ...aimAt({ ...l, rotationY: 0 }, l.headHeight, subjectTarget()) });
  };
  return (
    <div className="panel-scroll">
      <HouseLighting />
      <h4 className="sub-h">Your lighting kit</h4>
      <div className="search">
        <Icon name="search" size={15} />
        <input placeholder="Search 200+ fixtures (e.g. pavotube, 600d, bicolor)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips">
        {brands.map((b) => (
          <button key={b} className={'chip' + (b === brand ? ' on' : '')} onClick={() => setBrand(b)}>
            {b}
          </button>
        ))}
      </div>
      <div className="chips">
        <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>
          All types
        </button>
        {(Object.keys(CATEGORY_LABEL) as FixtureCategory[]).map((c) => (
          <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="lib-list">
        {list.map((f) => (
          <button key={f.id} className="lib-item" onClick={() => place(f.id)} title="Add to scene">
            <div className={'lib-ico cat-' + f.category}>
              <Icon name="light" size={16} />
            </div>
            <div className="lib-txt">
              <div className="lib-name">
                {f.brand} <b>{f.model}</b>
              </div>
              <div className="lib-meta">
                {f.category === 'strobe' ? `${f.ws} Ws · GN ${f.gn}` : f.lumens ? `${f.lumens} lm` : `${f.watts} W · ${f.lux1m.toLocaleString()} lx@1m`}
                {' · '}
                {f.color === 'rgbww' ? 'RGBWW' : f.color === 'rgb' ? 'RGB' : f.color === 'bicolor' ? `Bi ${f.cct[0]}–${f.cct[1]}K` : `${f.cct[0]}K`}
                {f.battery ? ' · 🔋' : ''}
              </div>
            </div>
            <Icon name="plus" size={16} />
          </button>
        ))}
        {!list.length && <div className="empty">No fixtures match.</div>}
      </div>
      <p className="fine">
        Output figures are compiled from published spec sheets, which often disagree between sources. Use <b>Output calibration</b> in the inspector to
        match a fixture you've metered yourself.
      </p>
    </div>
  );
}

export function SubjectsPanel() {
  const add = useStore((s) => s.addObject);
  const objects = useStore((s) => s.scene.objects);
  const select = useStore((s) => s.set);
  const [tone, setTone] = useState('mst5');
  const [pose, setPose] = useState<SubjectObject['pose']>('standing');
  const n = objects.filter((o) => o.kind === 'subject').length;
  const addOne = () => {
    const p = spawnPoint(2.2);
    const s = makeSubject(p, n + 1);
    add({ ...s, skinToneId: tone, pose, rotationY: yawTowardViewer(p) });
  };
  return (
    <div className="panel-scroll">
      <Section title="Add subject">
        <div className="tones">
          {SKIN_TONES.map((t) => (
            <button key={t.id} className={'tone' + (t.id === tone ? ' on' : '')} style={{ background: t.hex }} title={t.name} onClick={() => setTone(t.id)} />
          ))}
        </div>
        <p className="fine">Monk Skin Tone scale (10 tones) — spans the full range so you can check exposure & contrast across complexions.</p>
        <Seg
          value={pose}
          onChange={setPose}
          small
          options={[
            { v: 'standing', label: 'Standing' },
            { v: 'seated', label: 'Seated' },
            { v: 'seated-guitar', label: 'Guitar' },
            { v: 'seated-keys', label: 'Keys' },
            { v: 'standing-mic', label: 'Mic' },
          ]}
        />
        <button className="btn primary wide" onClick={addOne}>
          <Icon name="plus" size={16} /> Place subject
        </button>
      </Section>
      <Section title={`In scene (${n})`}>
        {objects
          .filter((o) => o.kind === 'subject')
          .map((o) => (
            <button key={o.id} className="list-row" onClick={() => select({ selectedId: o.id })}>
              <span className="dot" style={{ background: SKIN_TONES.find((t) => t.id === (o as SubjectObject).skinToneId)?.hex }} />
              {o.name}
            </button>
          ))}
        {!n && <div className="empty">No subjects yet — add as many as you need.</div>}
      </Section>
    </div>
  );
}

export function PropsPanel({ onCutout }: { onCutout: () => void }) {
  const add = useStore((s) => s.addObject);
  const hasPhotos = useStore((s) => s.scene.room.photos.length > 0);
  const cats = Array.from(new Set(PROPS.map((p) => p.category)));
  return (
    <div className="panel-scroll">
      <Section title="From your photos">
        <p className="fine">Cut furniture or set dressing straight out of the listing photos as movable, true-colour cards.</p>
        <button className="btn wide" disabled={!hasPhotos} onClick={onCutout}>
          <Icon name="image" size={16} /> Cut out object from photo
        </button>
      </Section>
      {cats.map((c) => (
        <Section key={c} title={c}>
          <div className="grid2">
            {PROPS.filter((p) => p.category === c).map((p) => (
              <button
                key={p.id}
                className="tile"
                onClick={() => {
                  const at = spawnPoint(2);
                  add({ ...makeProp(p.id, at), rotationY: yawTowardViewer(at) });
                }}
              >
                <span className="swatch" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

export function GripPanel() {
  const add = useStore((s) => s.addObject);
  const groups: [string, string[]][] = [
    ['Flags & negative fill', ['flag']],
    ['Diffusion frames & silks', ['frame', 'scrim']],
    ['Bounce & reflectors', ['bounce']],
    ['V-flats', ['vflat']],
    ['Cookies', ['cookie']],
  ];
  return (
    <div className="panel-scroll">
      {groups.map(([title, cats]) => (
        <Section key={title} title={title}>
          <div className="grid2">
            {FLAGS.filter((f) => cats.includes(f.category)).map((f) => (
              <button
                key={f.id}
                className="tile"
                onClick={() => {
                  const at = spawnPoint(1.6);
                  add({ ...makeFlag(f.id, at), rotationY: yawTowardViewer(at) });
                }}
              >
                <span className={'swatch mat-' + f.material} />
                {f.name}
              </button>
            ))}
          </div>
        </Section>
      ))}
      <p className="fine">Diffusion and bounce are simulated physically in <b>Render</b> (path-traced) mode; real-time mode approximates them.</p>
    </div>
  );
}

export function CamerasPanel() {
  const add = useStore((s) => s.addObject);
  const objects = useStore((s) => s.scene.objects);
  const view = useStore((s) => s.scene.view);
  const patchView = useStore((s) => s.patchView);
  const select = useStore((s) => s.set);
  const cams = objects.filter((o) => o.kind === 'camera') as CameraObject[];
  return (
    <div className="panel-scroll">
      <Section title="Camera positions">
        <p className="fine">Place cameras to document angles. Look through any camera to check framing, then capture with its lens & exposure data.</p>
        <button
          className="btn primary wide"
          onClick={() => {
            const at = spawnPoint(0.6);
            const c = makeCamera(at, cams.length);
            const aim = aimAt({ ...c, rotationY: 0 }, c.height, subjectTarget());
            add({ ...c, ...aim });
          }}
        >
          <Icon name="plus" size={16} /> Add camera at current view
        </button>
        {cams.map((c) => (
          <div key={c.id} className="list-row">
            <button className="lr-main" onClick={() => select({ selectedId: c.id })}>
              <Icon name="camera" size={15} /> {c.name} · {c.focalLength}mm
            </button>
            <button
              className={'btn small' + (view.activeCameraId === c.id ? ' primary' : '')}
              onClick={() => patchView({ activeCameraId: view.activeCameraId === c.id ? null : c.id })}
            >
              {view.activeCameraId === c.id ? 'Exit view' : 'Look through'}
            </button>
          </div>
        ))}
      </Section>
    </div>
  );
}

export function OutlinerPanel() {
  const objects = useStore((s) => s.scene.objects);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.set);
  const patch = useStore((s) => s.patchObject);
  const remove = useStore((s) => s.removeObject);
  const kinds: [SceneObject['kind'], string, string][] = [
    ['light', 'Lights', 'light'],
    ['subject', 'Subjects', 'person'],
    ['camera', 'Cameras', 'camera'],
    ['flag', 'Grip', 'flag'],
    ['prop', 'Props', 'guitar'],
    ['cutout', 'Photo cut-outs', 'image'],
  ];
  return (
    <div className="panel-scroll">
      {kinds.map(([k, title, icon]) => {
        const list = objects.filter((o) => o.kind === k);
        if (!list.length) return null;
        return (
          <Section key={k} title={`${title} (${list.length})`}>
            {list.map((o) => (
              <div key={o.id} className={'list-row' + (o.id === selectedId ? ' sel' : '')}>
                <button className="lr-main" onClick={() => select({ selectedId: o.id })}>
                  <Icon name={icon} size={14} />
                  {o.kind === 'light' && <span className="dot" style={{ background: (o as LightObject).enabled ? '#ffb547' : '#555' }} />}
                  {o.name}
                </button>
                <button className="icon-btn" title={o.hidden ? 'Show' : 'Hide'} onClick={() => patch(o.id, { hidden: !o.hidden })}>
                  <Icon name={o.hidden ? 'eyeOff' : 'eye'} size={14} />
                </button>
                <button className={'icon-btn' + (o.locked ? ' on' : '')} title="Lock" onClick={() => patch(o.id, { locked: !o.locked })}>
                  <Icon name="lock" size={14} />
                </button>
                <button className="icon-btn" title="Delete" onClick={() => remove(o.id)}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </Section>
        );
      })}
      {!objects.length && <div className="empty">Scene is empty. Add lights, subjects and props from the left rail.</div>}
    </div>
  );
}
