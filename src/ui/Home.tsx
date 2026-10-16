import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { defaultScene, makeLight, makeSubject, makeCamera, makeProp, useStore } from '../store';
import { deleteScene, importSceneFile, listScenes, loadScene, saveScene } from '../lib/storage';
import type { SceneMeta } from '../types';
import { Icon } from './controls';

function demoScene() {
  const s = defaultScene('Demo · Music lesson loft');
  s.room = { ...s.room, width: 6, depth: 5, height: 3.2, floorColor: '#8a6a4c', wallColors: { A: '#e9e4da', B: '#e9e4da', C: '#d9d2c4', D: '#e9e4da' } };
  s.room.windows = [
    { id: nanoid(6), wall: 'A', offset: 1.8, sill: 0.6, width: 1.4, height: 2.0, transmission: 0.85, diffuse: false, kind: 'window' },
    { id: nanoid(6), wall: 'A', offset: 4.2, sill: 0.6, width: 1.4, height: 2.0, transmission: 0.85, diffuse: false, kind: 'window' },
  ];
  s.location = { ...s.location, address: 'Brooklyn, NY (demo)', lat: 40.7081, lon: -73.9571, timeZone: 'America/New_York', wallABearing: 250, orientationSource: 'manual' };
  s.time = { ...s.time, local: new Date().toISOString().slice(0, 10) + 'T16:30', cloudCover: 0.1 };
  const subj = { ...makeSubject([0.4, 0, -0.2], 1), pose: 'seated-guitar' as const, skinToneId: 'mst7', rotationY: 20 };
  const key = { ...makeLight('aputure-ls-300d-ii', [-1.4, 0, 0.9], 'aputure-light-dome-iii'), headHeight: 2.0, pan: -40, tilt: -18 };
  const fill = { ...makeLight('nanlite-pavotube-ii-30x', [1.8, 0, 0.6]), headHeight: 1.3, pan: 63, tilt: 0, dimmer: 35, colorMode: 'cct' as const, cct: 3200 };
  const rim = { ...makeLight('amaran-pt4c', [2.0, 0, -1.6]), headHeight: 1.4, pan: 115, tilt: 0, colorMode: 'hsi' as const, hue: 215, sat: 70, dimmer: 60 };
  const lamp = { ...makeLight('practical-floor-lamp-with-shade-2700k-', [-2.4, 0, -1.8]), headHeight: 1.5 };
  const cam = { ...makeCamera([1.7, 0, 1.9], 0), pan: 35, tilt: -6, focalLength: 35, height: 1.15 };
  s.objects = [subj, key, fill, rim, lamp, cam, makeProp('guitar-amp', [1.1, 0, -0.9]), { ...makeProp('plant-tall', [-2.3, 0, -1.9]) }, { ...makeProp('rug', [0.2, 0, 0.3]), rotationY: 0 }, { ...makeProp('bookshelf', [2.6, 0, -1.4]), rotationY: -90 }];
  s.viewer = { position: [-0.9, 1.55, 2.2], target: [0.3, 1.0, -0.5] };
  return s;
}

export function Home() {
  const [scenes, setScenes] = useState<SceneMeta[]>([]);
  const open = useStore((s) => s.openScene);
  const notify = useStore((s) => s.notify);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => listScenes().then(setScenes);
  useEffect(() => {
    refresh();
  }, []);
  const create = async (s = defaultScene()) => {
    await saveScene(s);
    open(s);
  };
  return (
    <div className="home">
      <header className="home-head">
        <div className="brand big">
          <span className="logo-dot" /> LightStage <span className="brand-sub">Studio</span>
        </div>
        <p className="tagline">Turn a location listing into a lighting-accurate 3D set. Real sun, real fixtures, real exposure.</p>
        <div className="home-actions">
          <button className="btn primary big" onClick={() => create()}>
            <Icon name="plus" /> New location
          </button>
          <button className="btn big" onClick={() => create(demoScene())}>
            <Icon name="sparkle" /> Open demo scene
          </button>
          <button className="btn big" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Import scene file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const s = await importSceneFile(f);
                s.id = nanoid(10);
                await saveScene(s);
                open(s);
              } catch (err) {
                notify((err as Error).message);
              }
            }}
          />
        </div>
      </header>
      <section className="saves">
        <h2>Your scenes</h2>
        {!scenes.length && <div className="empty">Saved scenes appear here. Everything stays in this browser until you export it.</div>}
        <div className="save-grid">
          {scenes.map((m) => (
            <div key={m.id} className="save-card" onClick={async () => {
              const s = await loadScene(m.id);
              if (s) open(s);
            }}>
              <div className="save-thumb">{m.thumbnail ? <img src={m.thumbnail} alt="" /> : <Icon name="room" size={40} />}</div>
              <div className="save-meta">
                <b>{m.name}</b>
                <span>{new Date(m.updatedAt).toLocaleString()}</span>
              </div>
              <div className="save-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="icon-btn"
                  title="Duplicate"
                  onClick={async () => {
                    const s = await loadScene(m.id);
                    if (!s) return;
                    await saveScene({ ...s, id: nanoid(10), name: s.name + ' (copy)' });
                    refresh();
                  }}
                >
                  <Icon name="copy" size={15} />
                </button>
                <button
                  className="icon-btn"
                  title="Delete"
                  onClick={async () => {
                    if (!confirm(`Delete "${m.name}"? This cannot be undone.`)) return;
                    await deleteScene(m.id);
                    refresh();
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <footer className="home-foot">
        Sun position: NOAA solar algorithm · Building outlines © OpenStreetMap contributors · Skin tones: Monk Skin Tone Scale (CC-BY 4.0)
      </footer>
    </div>
  );
}
