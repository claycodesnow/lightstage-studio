import { useMemo } from 'react';
import { FIXTURES, FIXTURE_MAP, isPracticalLike } from '../data/fixtures';
import { FLAG_MAP, GRIDS, MODIFIERS, SENSORS, STANDS, ASPECTS, STAND_MAP } from '../data/modifiers';
import { GELS, SKIN_TONES } from '../lib/color';
import { computeEmission, formatFStop, formatShutter, fstopForLux, inverseSquareDrop, luxAtPoint } from '../lib/photometry';
import { useStore } from '../store';
import type { CameraObject, CutoutObject, FlagObject, LightObject, PropObject, SceneObject, SubjectObject } from '../types';
import { meterPoint } from '../three/useLighting';
import { cameraFov } from '../three/Props';
import { ColorField, Icon, LenSlider, NumberField, Row, Section, Seg, Select, Slider, Toggle, useLen } from './controls';
import { aimAt, subjectTarget } from './placement';

const SHUTTERS = [1 / 8000, 1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 200, 1 / 125, 1 / 100, 1 / 60, 1 / 50, 1 / 48, 1 / 30, 1 / 25, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
const APERTURES = [1.2, 1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const ISOS = [100, 200, 400, 640, 800, 1250, 1600, 3200, 6400, 12800];

function Common({ o }: { o: SceneObject }) {
  const patch = useStore((s) => s.patchObject);
  const remove = useStore((s) => s.removeObject);
  const dup = useStore((s) => s.duplicateObject);
  const { units } = useLen();
  const room = useStore((s) => s.scene.room);
  return (
    <>
      <div className="insp-head">
        <input className="name" value={o.name} onChange={(e) => patch(o.id, { name: e.target.value })} />
        <button className="icon-btn" title="Duplicate (Ctrl+D)" onClick={() => dup(o.id)}>
          <Icon name="copy" size={15} />
        </button>
        <button className="icon-btn" title="Delete (Del)" onClick={() => remove(o.id)}>
          <Icon name="trash" size={15} />
        </button>
      </div>
      <Section title="Placement">
        <LenSlider label="Left ↔ right (x)" value={o.position[0]} min={-room.width / 2 - 3} max={room.width / 2 + 3} onChange={(v) => patch(o.id, { position: [v, o.position[1], o.position[2]] })} />
        <LenSlider label="Back ↔ front (z)" value={o.position[2]} min={-room.depth / 2 - 3} max={room.depth / 2 + 3} onChange={(v) => patch(o.id, { position: [o.position[0], o.position[1], v] })} />
        <Slider label="Rotation" value={o.rotationY} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => patch(o.id, { rotationY: v })} />
        {units && null}
      </Section>
    </>
  );
}

function LightInspector({ l }: { l: LightObject }) {
  const patch = useStore((s) => s.patchObject);
  const scene = useStore((s) => s.scene);
  const calibration = useStore((s) => s.settings.calibration);
  const setSettings = useStore((s) => s.setSettings);
  const { fmt } = useLen();
  const f = FIXTURE_MAP.get(l.fixtureId)!;
  const cal = calibration[l.fixtureId] ?? 1;
  const e = useMemo(() => computeEmission(l, scene.view.shutter, cal), [l, scene.view.shutter, cal]);
  const target = meterPoint(scene, null);
  const lux = e ? luxAtPoint(l, e, target) : 0;
  const dist = Math.hypot(target[0] - l.position[0], target[1] - l.headHeight, target[2] - l.position[2]);
  const stand = STAND_MAP.get(l.standId);
  const p = (x: Partial<LightObject>) => patch(l.id, x);
  const canColor = f.color === 'rgbww' || f.color === 'rgb';
  const canCCT = f.color === 'bicolor' || f.color === 'rgbww';
  const isTube = f.shape === 'tube' || f.shape === 'strip';
  const mods = MODIFIERS.filter((m) => {
    if (f.shape === 'tube' || f.shape === 'strip') return m.brand === 'Nanlite' && m.mount === 'proprietary' ? true : false;
    if (isPracticalLike(f) || f.shape === 'panel' || f.shape === 'ring') return false;
    if (f.mount === 'bowens') return m.mount !== 'proprietary' || m.brand === f.brand;
    return m.mount === 'universal' || m.brand === f.brand || m.type === 'barndoors';
  });
  const mod = e?.modifier;
  return (
    <>
      <div className="spec-card">
        <div className="spec-top">
          <span className="swatch big" style={{ background: e?.displayColor }} />
          <div>
            <div className="spec-name">
              {f.brand} <b>{f.model}</b>
            </div>
            <div className="spec-sub">
              {f.category === 'strobe' ? `${f.ws} Ws · GN ${f.gn}` : `${f.watts} W`} · {f.color.toUpperCase()} {canCCT ? `${f.cct[0]}–${f.cct[1]}K` : `${f.cct[0]}K`} · CRI {f.cri}
              {f.battery ? ' · battery' : ''}
            </div>
          </div>
          <Toggle value={l.enabled} onChange={(v) => p({ enabled: v })} />
        </div>
        <div className="spec-grid">
          <div>
            <span>At subject</span>
            <b>{Math.round(lux).toLocaleString()} lx</b>
          </div>
          <div>
            <span>Distance</span>
            <b>{fmt(dist)}</b>
          </div>
          <div>
            <span>Meter</span>
            <b>{formatFStop(fstopForLux(lux, scene.view.shutter, scene.view.iso))}</b>
          </div>
          <div>
            <span>Beam</span>
            <b>{Math.round(e?.beam ?? 0)}°</b>
          </div>
        </div>
        <div className="fine">
          Inverse-square: moving to {fmt(dist * 2)} drops {inverseSquareDrop(dist, dist * 2).toFixed(1)} stops. {e?.cctLabel}
          {f.notes ? ` · ${f.notes}` : ''}
        </div>
      </div>
      <Section title="Fixture & modifier">
        <Row label="Fixture">
          <Select value={l.fixtureId} onChange={(v) => p({ fixtureId: v, name: `${FIXTURE_MAP.get(v)!.brand} ${FIXTURE_MAP.get(v)!.model}`, modifierId: null })}>
            {Array.from(new Set(FIXTURES.map((x) => x.brand))).map((b) => (
              <optgroup key={b} label={b}>
                {FIXTURES.filter((x) => x.brand === b).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.model}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Row>
        {mods.length > 0 && (
          <Row label="Modifier">
            <Select value={l.modifierId ?? ''} onChange={(v) => p({ modifierId: v || null })}>
              <option value="">{f.category === 'strobe' || f.category === 'cob' ? 'Standard reflector' : 'None'}</option>
              {Array.from(new Set(mods.map((m) => m.brand))).map((b) => (
                <optgroup key={b} label={b}>
                  {mods
                    .filter((m) => m.brand === b)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </Row>
        )}
        {mod && (
          <div className="fine">
            {mod.type.replace('-', ' ')} · face {fmt(mod.size[0])} × {fmt(mod.size[1])} · ~{(Math.log2(1 / mod.efficiency)).toFixed(1)} stop loss vs reflector
          </div>
        )}
        {(mod?.type === 'softbox' || mod?.type === 'octabox' || mod?.type === 'stripbox' || mod?.type === 'parabolic' || mod?.type === 'beauty-dish' || (!mod && !isPracticalLike(f))) && (
          <Row label="Grid">
            <Select value={l.gridId ?? ''} onChange={(v) => p({ gridId: v || null })}>
              <option value="">No grid</option>
              {mod?.gridDeg && <option value="builtin">Included {mod.gridDeg}° grid</option>}
              {GRIDS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Row>
        )}
        {(f.zoom || mod?.zoom) && (
          <Slider
            label="Spot ↔ flood"
            value={l.fresnelZoom ?? (mod?.zoom ?? f.zoom)![1]}
            min={(mod?.zoom ?? f.zoom)![0]}
            max={(mod?.zoom ?? f.zoom)![1]}
            step={1}
            format={(v) => `${Math.round(v)}°`}
            onChange={(v) => p({ fresnelZoom: v })}
          />
        )}
      </Section>
      <Section title="Output & colour">
        {f.category === 'strobe' ? (
          <Slider
            label="Flash power"
            value={Math.log2(l.flashPower ?? 1)}
            min={-9}
            max={0}
            step={1 / 3}
            format={(v) => `1/${Math.round(Math.pow(2, -v))}${Math.abs(v - Math.round(v)) > 0.1 ? ' +' + (Math.round((v - Math.floor(v)) * 3) / 3).toFixed(1) : ''}`}
            onChange={(v) => p({ flashPower: Math.pow(2, v) })}
          />
        ) : (
          <Slider label="Dimmer" value={l.dimmer} min={0} max={100} step={1} format={(v) => `${Math.round(v)}%`} onChange={(v) => p({ dimmer: v })} />
        )}
        {(canColor || canCCT) && (
          <Seg
            small
            value={canColor ? l.colorMode : 'cct'}
            onChange={(v) => p({ colorMode: v })}
            options={[{ v: 'cct', label: 'CCT' }, ...(canColor ? [{ v: 'hsi' as const, label: 'HSI' }, { v: 'rgb' as const, label: 'RGB' }] : [])]}
          />
        )}
        {(l.colorMode === 'cct' || !canColor) && canCCT && (
          <>
            <Slider
              label="Colour temperature"
              value={l.cct}
              min={f.cct[0]}
              max={f.cct[1]}
              step={50}
              format={(v) => `${Math.round(v)}K`}
              gradient="linear-gradient(90deg,#ff8a2a,#ffd9a8,#fff,#cfe0ff,#9ec0ff)"
              onChange={(v) => p({ cct: v })}
            />
            <Slider label="Green ↔ magenta" value={l.gm} min={-1} max={1} step={0.05} format={(v) => (Math.abs(v) < 0.02 ? '0' : `${v > 0 ? '+G' : '−G'} ${Math.abs(v).toFixed(2)}`)} gradient="linear-gradient(90deg,#e06bd0,#fff,#7ee07e)" onChange={(v) => p({ gm: v })} />
          </>
        )}
        {canColor && l.colorMode === 'hsi' && (
          <>
            <Slider label="Hue" value={l.hue} min={0} max={360} step={1} format={(v) => `${Math.round(v)}°`} gradient="linear-gradient(90deg,red,yellow,lime,cyan,blue,magenta,red)" onChange={(v) => p({ hue: v })} />
            <Slider label="Saturation" value={l.sat} min={0} max={100} step={1} format={(v) => `${Math.round(v)}%`} onChange={(v) => p({ sat: v })} />
          </>
        )}
        {canColor && l.colorMode === 'rgb' && (
          <Row label="RGB">
            <ColorField value={l.rgb} onChange={(v) => p({ rgb: v })} />
          </Row>
        )}
        <Row label="Gel">
          <Select value={l.gelId ?? ''} onChange={(v) => p({ gelId: v || null })}>
            <option value="">No gel</option>
            {GELS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.brand} {g.name}
              </option>
            ))}
          </Select>
        </Row>
        <Slider
          label="Output calibration"
          hint="Multiplier on this fixture model's published output. Meter your own unit at 1 m and adjust until the readout matches."
          value={cal}
          min={0.25}
          max={2}
          step={0.01}
          format={(v) => `×${v.toFixed(2)}`}
          onChange={(v) => setSettings({ calibration: { ...calibration, [l.fixtureId]: v } })}
        />
        <Row label="Cast shadows">
          <Toggle value={l.castShadows} onChange={(v) => p({ castShadows: v })} />
        </Row>
      </Section>
      <Section title="Stand & aim">
        <Row label="Stand / rig">
          <Select value={l.standId} onChange={(v) => p({ standId: v })}>
            {STANDS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Row>
        <LenSlider label="Head height" value={l.headHeight} min={stand?.minH ?? 0} max={Math.max(stand?.maxH ?? 3, 0.5)} onChange={(v) => p({ headHeight: v })} />
        <Slider label="Pan" value={l.pan} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => p({ pan: v })} />
        <Slider label="Tilt" value={l.tilt} min={-90} max={90} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => p({ tilt: v })} />
        {isTube && (
          <Row label="Tube orientation">
            <Seg
              small
              value={l.tubeOrientation ?? 'vertical'}
              onChange={(v) => p({ tubeOrientation: v })}
              options={[
                { v: 'vertical', label: 'Vertical' },
                { v: 'horizontal', label: 'Horizontal' },
              ]}
            />
          </Row>
        )}
        <button className="btn wide" onClick={() => p(aimAt(l, l.headHeight, subjectTarget()))}>
          <Icon name="target" size={15} /> Aim at subject
        </button>
      </Section>
    </>
  );
}

function SubjectInspector({ s }: { s: SubjectObject }) {
  const patch = useStore((st) => st.patchObject);
  const p = (x: Partial<SubjectObject>) => patch(s.id, x);
  return (
    <Section title="Subject">
      <div className="tones">
        {SKIN_TONES.map((t) => (
          <button key={t.id} className={'tone' + (t.id === s.skinToneId ? ' on' : '')} style={{ background: t.hex }} title={t.name} onClick={() => p({ skinToneId: t.id })} />
        ))}
      </div>
      <Row label="Pose">
        <Select value={s.pose} onChange={(v) => p({ pose: v as SubjectObject['pose'] })}>
          <option value="standing">Standing</option>
          <option value="leaning">Standing, relaxed</option>
          <option value="seated">Seated (interview)</option>
          <option value="seated-guitar">Seated, playing guitar</option>
          <option value="seated-keys">Seated at keys</option>
          <option value="standing-mic">Standing at mic</option>
        </Select>
      </Row>
      <LenSlider label="Height" value={s.heightM} min={1.0} max={2.1} onChange={(v) => p({ heightM: v })} />
      <Row label="Build">
        <Seg
          small
          value={s.build}
          onChange={(v) => p({ build: v })}
          options={[
            { v: 'slim', label: 'Slim' },
            { v: 'average', label: 'Average' },
            { v: 'broad', label: 'Broad' },
          ]}
        />
      </Row>
      <Slider label="Head turn" value={s.headYaw} min={-80} max={80} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => p({ headYaw: v })} />
      <Row label="Top">
        <ColorField value={s.shirtColor} onChange={(v) => p({ shirtColor: v })} />
      </Row>
      <Row label="Bottoms">
        <ColorField value={s.pantsColor} onChange={(v) => p({ pantsColor: v })} />
      </Row>
      <Row label="Hair">
        <ColorField value={s.hairColor} onChange={(v) => p({ hairColor: v })} />
      </Row>
    </Section>
  );
}

function PropInspector({ o }: { o: PropObject }) {
  const patch = useStore((st) => st.patchObject);
  return (
    <Section title="Prop">
      <Row label="Colour">
        <ColorField value={o.color} onChange={(v) => patch(o.id, { color: v })} />
      </Row>
      <Slider label="Scale" value={o.scale} min={0.3} max={2.5} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch(o.id, { scale: v })} />
      <LenSlider label="Elevation (on table etc.)" value={o.elevation ?? 0} min={0} max={2} onChange={(v) => patch(o.id, { elevation: v })} />
    </Section>
  );
}

function FlagInspector({ o }: { o: FlagObject }) {
  const patch = useStore((st) => st.patchObject);
  const def = FLAG_MAP.get(o.flagId);
  return (
    <Section title={def?.name ?? 'Grip'}>
      <LenSlider label="Centre height" value={o.height} min={o.heightM / 2} max={3.5} onChange={(v) => patch(o.id, { height: v })} />
      <Slider label="Tilt" value={o.tilt} min={-90} max={90} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => patch(o.id, { tilt: v })} />
      <LenSlider label="Width" value={o.width} min={0.2} max={4} onChange={(v) => patch(o.id, { width: v })} />
      <LenSlider label="Height" value={o.heightM} min={0.2} max={4} onChange={(v) => patch(o.id, { heightM: v })} />
    </Section>
  );
}

function CameraInspector({ c }: { c: CameraObject }) {
  const patch = useStore((st) => st.patchObject);
  const view = useStore((st) => st.scene.view);
  const patchView = useStore((st) => st.patchView);
  const p = (x: Partial<CameraObject>) => patch(c.id, x);
  const fov = cameraFov(c.focalLength, c.sensorId, c.aspect);
  return (
    <>
      <Section title="Lens & body">
        <button className={'btn wide' + (view.activeCameraId === c.id ? ' primary' : '')} onClick={() => patchView({ activeCameraId: view.activeCameraId === c.id ? null : c.id })}>
          <Icon name="eye" size={15} /> {view.activeCameraId === c.id ? 'Exit camera view' : 'Look through this camera'}
        </button>
        <Slider label="Focal length" value={c.focalLength} min={10} max={200} step={1} format={(v) => `${Math.round(v)} mm`} onChange={(v) => p({ focalLength: v })} />
        <div className="chips">
          {[16, 24, 35, 50, 85, 135].map((f) => (
            <button key={f} className={'chip' + (c.focalLength === f ? ' on' : '')} onClick={() => p({ focalLength: f })}>
              {f}
            </button>
          ))}
        </div>
        <Row label="Sensor">
          <Select value={c.sensorId} onChange={(v) => p({ sensorId: v })}>
            {SENSORS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Row>
        <Row label="Aspect">
          <Select value={c.aspect} onChange={(v) => p({ aspect: v })}>
            {Object.keys(ASPECTS).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Row>
        <div className="fine">
          H-FOV {fov.hfovDeg.toFixed(1)}° · V-FOV {fov.vfovDeg.toFixed(1)}°
        </div>
        <LenSlider label="Lens height" value={c.height} min={0.3} max={2.6} onChange={(v) => p({ height: v })} />
        <Slider label="Pan" value={c.pan} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => p({ pan: v })} />
        <Slider label="Tilt" value={c.tilt} min={-60} max={60} step={0.5} format={(v) => `${v.toFixed(1)}°`} onChange={(v) => p({ tilt: v })} />
        <button className="btn wide" onClick={() => p(aimAt(c, c.height, subjectTarget()))}>
          <Icon name="target" size={15} /> Aim at subject
        </button>
        <Row label="Show frustum">
          <Toggle value={c.showFrustum} onChange={(v) => p({ showFrustum: v })} />
        </Row>
      </Section>
      <Section title="Exposure (documented with captures)">
        <Row label="ISO">
          <Select value={String(c.iso)} onChange={(v) => p({ iso: +v })}>
            {ISOS.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </Select>
        </Row>
        <Row label="Shutter">
          <Select value={String(c.shutter)} onChange={(v) => p({ shutter: +v })}>
            {SHUTTERS.map((s) => (
              <option key={s} value={String(s)}>
                {formatShutter(s)}
              </option>
            ))}
          </Select>
        </Row>
        <Row label="Aperture">
          <Select value={String(c.aperture)} onChange={(v) => p({ aperture: +v })}>
            {APERTURES.map((a) => (
              <option key={a} value={String(a)}>
                f/{a}
              </option>
            ))}
          </Select>
        </Row>
        <button
          className="btn wide"
          onClick={() => patchView({ iso: c.iso, shutter: c.shutter, aperture: c.aperture, autoExposure: false, focalLength: c.focalLength, sensorId: c.sensorId, aspect: c.aspect })}
        >
          Apply to viewport exposure
        </button>
      </Section>
    </>
  );
}

function CutoutInspector({ o }: { o: CutoutObject }) {
  const patch = useStore((st) => st.patchObject);
  const ratio = o.heightM / o.widthM;
  return (
    <Section title="Photo cut-out">
      <LenSlider label="Width" value={o.widthM} min={0.1} max={4} onChange={(v) => patch(o.id, { widthM: v, heightM: v * ratio })} />
      <LenSlider label="Height" value={o.heightM} min={0.1} max={4} onChange={(v) => patch(o.id, { heightM: v, widthM: v / ratio })} />
      {o.dataUrl && <img src={o.dataUrl} className="cut-preview" alt="" />}
    </Section>
  );
}

export function ViewInspector() {
  const view = useStore((s) => s.scene.view);
  const patchView = useStore((s) => s.patchView);
  return (
    <>
      <div className="insp-head">
        <div className="name static">Viewport camera</div>
      </div>
      <Section title="Lens">
        <Slider label="Focal length" value={view.focalLength} min={10} max={200} step={1} format={(v) => `${Math.round(v)} mm`} onChange={(v) => patchView({ focalLength: v })} />
        <div className="chips">
          {[16, 24, 35, 50, 85, 135].map((f) => (
            <button key={f} className={'chip' + (view.focalLength === f ? ' on' : '')} onClick={() => patchView({ focalLength: f })}>
              {f}
            </button>
          ))}
        </div>
        <Row label="Sensor">
          <Select value={view.sensorId} onChange={(v) => patchView({ sensorId: v })}>
            {SENSORS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Row>
        <Row label="Aspect">
          <Select value={view.aspect} onChange={(v) => patchView({ aspect: v })}>
            {Object.keys(ASPECTS).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Row>
        <Row label="Frame guides">
          <Toggle value={view.showGuides} onChange={(v) => patchView({ showGuides: v })} />
        </Row>
        <Row label="Show stands">
          <Toggle value={view.showStands} onChange={(v) => patchView({ showStands: v })} />
        </Row>
      </Section>
      <Section title="Exposure">
        <Row label="Mode">
          <Seg
            small
            value={view.autoExposure ? 'auto' : 'manual'}
            onChange={(v) => patchView({ autoExposure: v === 'auto' })}
            options={[
              { v: 'auto', label: 'Auto', title: 'Meters the subject face' },
              { v: 'manual', label: 'Manual' },
            ]}
          />
        </Row>
        <Row label="ISO">
          <Select value={String(view.iso)} onChange={(v) => patchView({ iso: +v })}>
            {ISOS.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </Select>
        </Row>
        <Row label="Shutter">
          <Select value={String(view.shutter)} onChange={(v) => patchView({ shutter: +v })}>
            {SHUTTERS.map((s) => (
              <option key={s} value={String(s)}>
                {formatShutter(s)}
              </option>
            ))}
          </Select>
        </Row>
        <Row label="Aperture">
          <Select value={String(view.aperture)} onChange={(v) => patchView({ aperture: +v })}>
            {APERTURES.map((a) => (
              <option key={a} value={String(a)}>
                f/{a}
              </option>
            ))}
          </Select>
        </Row>
        <Slider label="Exposure comp." value={view.exposureComp} min={-4} max={4} step={1 / 3} format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} EV`} onChange={(v) => patchView({ exposureComp: v })} />
        <Slider
          label="White balance"
          value={view.whiteBalance}
          min={2500}
          max={10000}
          step={50}
          format={(v) => `${Math.round(v)}K`}
          gradient="linear-gradient(90deg,#9ec0ff,#fff,#ffd9a8,#ff8a2a)"
          onChange={(v) => patchView({ whiteBalance: v })}
        />
        <div className="chips">
          {[
            ['Tungsten', 3200],
            ['Daylight', 5600],
            ['Shade', 7000],
          ].map(([n, k]) => (
            <button key={n} className={'chip' + (view.whiteBalance === k ? ' on' : '')} onClick={() => patchView({ whiteBalance: k as number })}>
              {n} {k}K
            </button>
          ))}
        </div>
        <Row label="Tone curve">
          <Select value={view.toneMapping} onChange={(v) => patchView({ toneMapping: v as typeof view.toneMapping })}>
            <option value="neutral">Neutral (colour-faithful)</option>
            <option value="agx">AgX (filmic)</option>
            <option value="aces">ACES</option>
            <option value="linear">Linear (clips)</option>
          </Select>
        </Row>
      </Section>
    </>
  );
}

export function Inspector() {
  const o = useStore((s) => s.scene.objects.find((x) => x.id === s.selectedId));
  if (!o) return <ViewInspector />;
  return (
    <>
      <Common o={o} />
      {o.kind === 'light' && <LightInspector l={o} />}
      {o.kind === 'subject' && <SubjectInspector s={o} />}
      {o.kind === 'prop' && <PropInspector o={o} />}
      {o.kind === 'flag' && <FlagInspector o={o} />}
      {o.kind === 'camera' && <CameraInspector c={o} />}
      {o.kind === 'cutout' && <CutoutInspector o={o} />}
    </>
  );
}

export { NumberField };
