import { nanoid } from 'nanoid';
import { useStore } from '../store';
import type { FloorMaterial, WallId, WindowSpec } from '../types';
import { WALLS } from '../types';
import { ColorField, Icon, LenSlider, NumberField, Row, Section, Seg, Select, Slider, Toggle, useLen } from './controls';

export function RoomPanel({ onOpenMapper }: { onOpenMapper: () => void }) {
  const room = useStore((s) => s.scene.room);
  const patchRoom = useStore((s) => s.patchRoom);
  const { units, unit } = useLen();
  const sqft = room.width * room.depth * 10.7639;
  const setArea = (v: number) => {
    // keep the aspect ratio, scale to the listed area
    const m2 = units === 'metric' ? v : v / 10.7639;
    const k = Math.sqrt(m2 / (room.width * room.depth));
    patchRoom({ width: +(room.width * k).toFixed(2), depth: +(room.depth * k).toFixed(2) });
  };
  const patchWindow = (id: string, p: Partial<WindowSpec>) => patchRoom({ windows: room.windows.map((w) => (w.id === id ? { ...w, ...p } : w)) });
  const wallLen = (w: WallId) => (w === 'A' || w === 'C' ? room.width : room.depth);
  return (
    <div className="panel-scroll">
      <Section title="Photos → room">
        <p className="fine">
          Upload the listing photos, then tell LightStage where each wall is. Windows are the shared reference that ties photos together. Optional AI
          assist can do a first pass for you.
        </p>
        <button className="btn primary wide" onClick={onOpenMapper}>
          <Icon name="image" size={16} /> Open photo mapper {room.photos.length ? `(${room.photos.length} photos)` : ''}
        </button>
        <Row label="Photo textures">
          <Toggle value={room.showPhotoTextures} onChange={(v) => patchRoom({ showPhotoTextures: v })} />
        </Row>
        <Slider
          label="Photo look ↔ relit"
          value={room.photoBake}
          min={0}
          max={1}
          step={0.01}
          format={(v) => (v < 0.05 ? 'Fully relit' : v > 0.95 ? 'As shot' : `${Math.round(v * 100)}% photo`)}
          onChange={(v) => patchRoom({ photoBake: v })}
          hint="Photos already contain the light that was there when they were taken. 0 = treat photo as surface colour and relight it; 1 = show the photo exactly as shot."
        />
      </Section>
      <Section title="Dimensions">
        <LenSlider label="Width (walls A/C)" value={room.width} min={1.5} max={20} onChange={(v) => patchRoom({ width: v })} />
        <LenSlider label="Depth (walls B/D)" value={room.depth} min={1.5} max={20} onChange={(v) => patchRoom({ depth: v })} />
        <LenSlider label="Ceiling height" value={room.height} min={2} max={8} onChange={(v) => patchRoom({ height: v })} />
        <Row label={units === 'metric' ? 'Floor area (m²)' : 'Floor area (sq ft)'} hint="Type the listing's square footage — the room scales to match.">
          <NumberField value={units === 'metric' ? room.width * room.depth : sqft} step={1} onChange={setArea} />
        </Row>
        <Row label="Units">
          <Seg
            small
            value={units}
            onChange={(v) => useStore.getState().setSettings({ units: v })}
            options={[
              { v: 'imperial', label: 'ft / in' },
              { v: 'metric', label: 'm' },
            ]}
          />
        </Row>
      </Section>
      <Section title="Surfaces">
        {WALLS.map((w) => (
          <Row key={w} label={`Wall ${w}`}>
            <ColorField value={room.wallColors[w]} onChange={(c) => patchRoom({ wallColors: { ...room.wallColors, [w]: c } })} />
          </Row>
        ))}
        <Row label="All walls">
          <ColorField value={room.wallColors.A} onChange={(c) => patchRoom({ wallColors: { A: c, B: c, C: c, D: c } })} />
        </Row>
        <Row label="Ceiling">
          <ColorField value={room.ceilingColor} onChange={(c) => patchRoom({ ceilingColor: c })} />
        </Row>
        <Row label="Floor">
          <ColorField value={room.floorColor} onChange={(c) => patchRoom({ floorColor: c })} />
        </Row>
        <Row label="Floor type">
          <Select value={room.floorMaterial} onChange={(v) => patchRoom({ floorMaterial: v as FloorMaterial })}>
            <option value="wood">Hardwood</option>
            <option value="concrete">Concrete</option>
            <option value="carpet">Carpet</option>
            <option value="tile">Tile</option>
            <option value="painted">Painted / vinyl</option>
          </Select>
        </Row>
        <Slider label="Wall sheen" value={1 - room.wallRoughness} min={0} max={0.6} format={(v) => (v < 0.1 ? 'Flat / matte' : v < 0.25 ? 'Eggshell' : v < 0.4 ? 'Satin' : 'Semi-gloss')} onChange={(v) => patchRoom({ wallRoughness: 1 - v })} />
      </Section>
      <Section
        title={`Windows & doors (${room.windows.length})`}
        right={
          <button
            className="icon-btn"
            title="Add window"
            onClick={() =>
              patchRoom({
                windows: [...room.windows, { id: nanoid(6), wall: 'A', offset: room.width / 2, sill: 0.8, width: 1.2, height: 1.5, transmission: 0.85, diffuse: false, kind: 'window' }],
              })
            }
          >
            <Icon name="plus" size={15} />
          </button>
        }
      >
        {room.windows.map((w, i) => (
          <div key={w.id} className="card">
            <div className="card-head">
              <b>
                {w.kind === 'door' ? 'Door' : w.kind === 'skylight' ? 'Skylight' : 'Window'} {i + 1}
              </b>
              <Seg
                small
                value={w.wall}
                onChange={(v) => patchWindow(w.id, { wall: v as WallId, offset: Math.min(w.offset, wallLen(v as WallId) - w.width / 2) })}
                options={WALLS.map((x) => ({ v: x, label: x }))}
              />
              <button className="icon-btn" onClick={() => patchRoom({ windows: room.windows.filter((x) => x.id !== w.id) })}>
                <Icon name="trash" size={14} />
              </button>
            </div>
            <Seg
              small
              value={w.kind}
              onChange={(v) => patchWindow(w.id, { kind: v as WindowSpec['kind'], ...(v === 'door' ? { sill: 0, height: 2.03, width: 0.9 } : {}) })}
              options={[
                { v: 'window', label: 'Window' },
                { v: 'door', label: 'Door / glass door' },
                { v: 'skylight', label: 'Skylight' },
              ]}
            />
            <LenSlider label={w.kind === 'skylight' ? 'From wall D' : 'Centre from left edge'} value={w.offset} min={0.2} max={w.kind === 'skylight' ? room.width : wallLen(w.wall)} onChange={(v) => patchWindow(w.id, { offset: v })} />
            <LenSlider label={w.kind === 'skylight' ? 'From wall A' : 'Sill height'} value={w.sill} min={0} max={w.kind === 'skylight' ? room.depth : room.height - 0.3} onChange={(v) => patchWindow(w.id, { sill: v })} />
            <LenSlider label="Width" value={w.width} min={0.3} max={w.kind === 'skylight' ? room.width : wallLen(w.wall)} onChange={(v) => patchWindow(w.id, { width: v })} />
            <LenSlider label={w.kind === 'skylight' ? 'Length' : 'Height'} value={w.height} min={0.3} max={w.kind === 'skylight' ? room.depth : room.height} onChange={(v) => patchWindow(w.id, { height: v })} />
            <Row label="Covering">
              <Select
                value={w.transmission <= 0.02 ? 'blackout' : w.diffuse ? 'sheer' : w.transmission < 0.6 ? 'blinds' : 'none'}
                onChange={(v) =>
                  patchWindow(
                    w.id,
                    v === 'none'
                      ? { transmission: 0.85, diffuse: false }
                      : v === 'sheer'
                        ? { transmission: 0.45, diffuse: true }
                        : v === 'blinds'
                          ? { transmission: 0.4, diffuse: false }
                          : { transmission: 0, diffuse: false },
                  )
                }
              >
                <option value="none">Clear glass</option>
                <option value="sheer">Sheer curtains / frosted</option>
                <option value="blinds">Blinds half-open</option>
                <option value="blackout">Blackout / duvetyne</option>
              </Select>
            </Row>
          </div>
        ))}
      </Section>
      <p className="fine">
        Wall A = the main window wall. Standing in the room facing A: B is to your right, C behind, D to your left. Sizes shown in {unit}.
      </p>
    </div>
  );
}
