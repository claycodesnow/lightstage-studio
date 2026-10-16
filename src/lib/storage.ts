// Local persistence (IndexedDB). Scenes include photos, so they live in IndexedDB rather than localStorage.
import { del, get, set } from 'idb-keyval';
import type { Scene, SceneMeta } from '../types';

const INDEX_KEY = 'lightstage:index';
const sceneKey = (id: string) => `lightstage:scene:${id}`;

export async function listScenes(): Promise<SceneMeta[]> {
  const idx = (await get<SceneMeta[]>(INDEX_KEY)) ?? [];
  return idx.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadScene(id: string): Promise<Scene | undefined> {
  return get<Scene>(sceneKey(id));
}

export async function saveScene(scene: Scene): Promise<void> {
  const updated = { ...scene, updatedAt: Date.now() };
  await set(sceneKey(scene.id), updated);
  const idx = (await get<SceneMeta[]>(INDEX_KEY)) ?? [];
  const meta: SceneMeta = { id: scene.id, name: scene.name, updatedAt: updated.updatedAt, thumbnail: scene.thumbnail };
  const next = [meta, ...idx.filter((m) => m.id !== scene.id)];
  await set(INDEX_KEY, next);
}

export async function deleteScene(id: string): Promise<void> {
  await del(sceneKey(id));
  const idx = (await get<SceneMeta[]>(INDEX_KEY)) ?? [];
  await set(
    INDEX_KEY,
    idx.filter((m) => m.id !== id),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function exportScene(scene: Scene) {
  const blob = new Blob([JSON.stringify({ format: 'lightstage-scene', version: 1, scene })], { type: 'application/json' });
  downloadBlob(blob, `${scene.name.replace(/[^\w\- ]+/g, '').trim() || 'scene'}.lightstage.json`);
}

export async function importSceneFile(file: File): Promise<Scene> {
  const data = JSON.parse(await file.text());
  if (data?.format !== 'lightstage-scene' || !data.scene) throw new Error('Not a LightStage scene file');
  return data.scene as Scene;
}

const SETTINGS_KEY = 'lightstage:settings';
export interface AppSettings {
  anthropicKey?: string;
  units: 'metric' | 'imperial';
  calibration: Record<string, number>; // fixtureId → output multiplier
}

export function loadSettings(): AppSettings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { units: 'imperial', calibration: {}, ...s };
  } catch {
    return { units: 'imperial', calibration: {} };
  }
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
