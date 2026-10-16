// Light modifiers, grids, stands and flags/frames.
// `efficiency` is fraction of fixture flux leaving the modifier (vs standard reflector).
// `beam` is the resulting full beam angle. `size` is the emitting face (meters) which drives shadow softness.

export type ModifierType =
  | 'reflector'
  | 'softbox'
  | 'octabox'
  | 'stripbox'
  | 'parabolic'
  | 'lantern'
  | 'umbrella-shoot'
  | 'umbrella-bounce'
  | 'beauty-dish'
  | 'fresnel'
  | 'projection'
  | 'dome'
  | 'barndoors'
  | 'snoot'
  | 'diffusion-sock';

export interface Modifier {
  id: string;
  brand: string;
  name: string;
  type: ModifierType;
  mount: 'bowens' | 'proprietary' | 'universal';
  shape: 'rect' | 'octa' | 'round' | 'sphere' | 'umbrella' | 'dish' | 'lens' | 'none';
  size: [number, number]; // face width, height (m)
  depth: number; // m
  efficiency: number;
  beam: number;
  /** spill: fraction of light emitted outside the beam (lanterns ~ high) */
  spill: number;
  /** zoom range for fresnels / projection mounts */
  zoom?: [number, number];
  gridDeg?: number; // included grid
  interior: 'silver' | 'white' | 'gold' | 'none';
}

const M = (
  brand: string,
  name: string,
  type: ModifierType,
  shape: Modifier['shape'],
  size: [number, number],
  depth: number,
  efficiency: number,
  beam: number,
  extra: Partial<Modifier> = {},
): Modifier => ({
  id: (brand + '-' + name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  brand,
  name,
  type,
  mount: 'bowens',
  shape,
  size,
  depth,
  efficiency,
  beam,
  spill: 0.05,
  interior: 'silver',
  ...extra,
});


export const MODIFIERS: Modifier[] = [
  // Generic / standard
  M('Standard', '55° Standard Reflector', 'reflector', 'round', [0.18, 0.18], 0.12, 1, 55),
  M('Standard', 'Barn Doors (4-leaf)', 'barndoors', 'round', [0.2, 0.2], 0.15, 0.85, 45),
  M('Standard', 'Snoot', 'snoot', 'round', [0.07, 0.07], 0.2, 0.35, 12),
  M('Standard', 'Bare Bulb (no reflector)', 'reflector', 'none', [0.1, 0.1], 0, 1.4, 180, { spill: 0.4 }),
  M('Generic', 'Softbox 60×90 cm (2×3 ft)', 'softbox', 'rect', [0.6, 0.9], 0.45, 0.45, 100, { interior: 'silver' }),
  M('Generic', 'Softbox 90×120 cm (3×4 ft)', 'softbox', 'rect', [0.9, 1.2], 0.55, 0.42, 100),
  M('Generic', 'Softbox 120×180 cm (4×6 ft)', 'softbox', 'rect', [1.2, 1.8], 0.65, 0.38, 105),
  M('Generic', 'Strip Box 30×120 cm (1×4 ft)', 'stripbox', 'rect', [0.3, 1.2], 0.35, 0.4, 95),
  M('Generic', 'Strip Box 35×160 cm', 'stripbox', 'rect', [0.35, 1.6], 0.4, 0.38, 95),
  M('Generic', 'Octabox 24" (60 cm)', 'octabox', 'octa', [0.6, 0.6], 0.4, 0.47, 100),
  M('Generic', 'Octabox 36" (90 cm)', 'octabox', 'octa', [0.9, 0.9], 0.5, 0.44, 100),
  M('Generic', 'Octabox 48" (120 cm)', 'octabox', 'octa', [1.2, 1.2], 0.55, 0.42, 105),
  M('Generic', 'Octabox 59" (150 cm)', 'octabox', 'octa', [1.5, 1.5], 0.6, 0.4, 110),
  M('Generic', 'Shoot-through Umbrella 43" White', 'umbrella-shoot', 'umbrella', [1.09, 1.09], 0.5, 0.45, 140, { spill: 0.35, mount: 'universal', interior: 'white' }),
  M('Generic', 'Reflective Umbrella 43" Silver', 'umbrella-bounce', 'umbrella', [1.09, 1.09], 0.5, 0.65, 90, { spill: 0.1, mount: 'universal' }),
  M('Generic', 'Reflective Umbrella 60" White', 'umbrella-bounce', 'umbrella', [1.52, 1.52], 0.65, 0.5, 110, { spill: 0.15, mount: 'universal', interior: 'white' }),
  M('Generic', 'Parabolic Umbrella 51" Silver', 'umbrella-bounce', 'umbrella', [1.3, 1.3], 0.7, 0.7, 70, { spill: 0.08, mount: 'universal' }),
  M('Generic', 'Beauty Dish 22" White', 'beauty-dish', 'dish', [0.56, 0.56], 0.2, 0.6, 70, { interior: 'white' }),
  M('Generic', 'Beauty Dish 22" Silver', 'beauty-dish', 'dish', [0.56, 0.56], 0.2, 0.72, 60),
  M('Generic', 'China Ball Lantern 26"', 'lantern', 'sphere', [0.65, 0.65], 0.65, 0.5, 300, { spill: 0.9, interior: 'white' }),
  M('Generic', 'Diffusion Sock / Dome', 'dome', 'sphere', [0.18, 0.18], 0.1, 0.75, 220, { spill: 0.6, interior: 'white' }),

  // Aputure
  M('Aputure', 'Light Dome Mini III', 'parabolic', 'octa', [0.6, 0.6], 0.4, 0.5, 90),
  M('Aputure', 'Light Dome SE', 'parabolic', 'octa', [0.85, 0.85], 0.55, 0.5, 90),
  M('Aputure', 'Light Dome III', 'parabolic', 'octa', [0.9, 0.9], 0.62, 0.52, 85, { gridDeg: 40 }),
  M('Aputure', 'Light Dome 150', 'parabolic', 'octa', [1.5, 1.5], 0.9, 0.48, 90),
  M('Aputure', 'Lantern 90', 'lantern', 'sphere', [0.9, 0.9], 0.7, 0.55, 300, { spill: 0.75, interior: 'white' }),
  M('Aputure', 'Lantern 26"', 'lantern', 'sphere', [0.66, 0.66], 0.6, 0.55, 300, { spill: 0.75, interior: 'white' }),
  M('Aputure', 'Lantern Mini', 'lantern', 'sphere', [0.34, 0.34], 0.3, 0.55, 300, { spill: 0.75, interior: 'white' }),
  M('Aputure', 'Light Box 30120', 'stripbox', 'rect', [0.3, 1.2], 0.4, 0.45, 90, { gridDeg: 40 }),
  M('Aputure', 'Light Box 60120', 'softbox', 'rect', [0.6, 1.2], 0.5, 0.45, 90, { gridDeg: 40 }),
  M('Aputure', 'Spotlight Mount 19°', 'projection', 'lens', [0.15, 0.15], 0.35, 0.22, 19),
  M('Aputure', 'Spotlight Mount 26°', 'projection', 'lens', [0.15, 0.15], 0.35, 0.25, 26),
  M('Aputure', 'Spotlight Mount 36°', 'projection', 'lens', [0.15, 0.15], 0.35, 0.28, 36),
  M('Aputure', 'F10 Fresnel', 'fresnel', 'lens', [0.26, 0.26], 0.28, 0.85, 45, { zoom: [15, 45] }),
  M('Aputure', 'Fresnel 2X', 'fresnel', 'lens', [0.2, 0.2], 0.22, 0.9, 40, { zoom: [12, 40] }),
  M('Aputure', 'CF4 Fresnel', 'fresnel', 'lens', [0.12, 0.12], 0.12, 0.85, 40, { zoom: [12, 40] }),
  M('Aputure', 'Space Light', 'lantern', 'round', [0.75, 0.75], 0.9, 0.5, 200, { spill: 0.6, interior: 'white' }),

  // Amaran
  M('Amaran', 'Light Dome SE (amaran)', 'parabolic', 'octa', [0.85, 0.85], 0.55, 0.48, 90),
  M('Amaran', 'Lantern (amaran)', 'lantern', 'sphere', [0.66, 0.66], 0.6, 0.5, 300, { spill: 0.75, interior: 'white' }),

  // Godox
  M('Godox', 'QR-P90 Parabolic', 'parabolic', 'round', [0.9, 0.9], 0.6, 0.55, 80),
  M('Godox', 'QR-P120 Parabolic', 'parabolic', 'round', [1.2, 1.2], 0.75, 0.52, 80),
  M('Godox', 'P90L Parabolic', 'parabolic', 'round', [0.9, 0.9], 0.65, 0.54, 75),
  M('Godox', 'SB-GUBW 120 Octa', 'octabox', 'octa', [1.2, 1.2], 0.5, 0.44, 100),
  M('Godox', 'SB-UBW 60×90', 'softbox', 'rect', [0.6, 0.9], 0.45, 0.45, 100),
  M('Godox', 'CS-65D Lantern', 'lantern', 'sphere', [0.65, 0.65], 0.6, 0.5, 300, { spill: 0.8, interior: 'white' }),
  M('Godox', 'CS-85D Lantern', 'lantern', 'sphere', [0.85, 0.85], 0.7, 0.5, 300, { spill: 0.8, interior: 'white' }),
  M('Godox', 'FLS8 Fresnel', 'fresnel', 'lens', [0.2, 0.2], 0.2, 0.85, 42, { zoom: [10, 42] }),
  M('Godox', 'FLS10 Fresnel', 'fresnel', 'lens', [0.26, 0.26], 0.25, 0.85, 45, { zoom: [12, 45] }),
  M('Godox', 'SA-P Projection Attachment', 'projection', 'lens', [0.15, 0.15], 0.35, 0.22, 26, { zoom: [19, 36] }),
  M('Godox', 'AD-S11 Gel Kit / Reflector (AD200)', 'reflector', 'round', [0.1, 0.07], 0.08, 0.95, 60, { mount: 'proprietary' }),
  M('Godox', 'BDR-W55 Beauty Dish', 'beauty-dish', 'dish', [0.55, 0.55], 0.2, 0.6, 70, { interior: 'white' }),

  // Nanlite
  M('Nanlite', 'Para 60', 'parabolic', 'round', [0.6, 0.6], 0.45, 0.5, 80),
  M('Nanlite', 'Para 90', 'parabolic', 'round', [0.9, 0.9], 0.6, 0.5, 80),
  M('Nanlite', 'Para 120', 'parabolic', 'round', [1.2, 1.2], 0.75, 0.5, 80),
  M('Nanlite', 'Para 150', 'parabolic', 'round', [1.5, 1.5], 0.9, 0.48, 80),
  M('Nanlite', 'Lantern LT-80', 'lantern', 'sphere', [0.8, 0.8], 0.65, 0.5, 300, { spill: 0.8, interior: 'white' }),
  M('Nanlite', 'Lantern LT-120', 'lantern', 'sphere', [1.2, 1.2], 0.9, 0.48, 300, { spill: 0.8, interior: 'white' }),
  M('Nanlite', 'Forza 60 Fresnel FL-11', 'fresnel', 'lens', [0.11, 0.11], 0.12, 0.85, 45, { zoom: [12, 44], mount: 'proprietary' }),
  M('Nanlite', 'FL-20G Fresnel', 'fresnel', 'lens', [0.2, 0.2], 0.2, 0.85, 45, { zoom: [12, 45] }),
  M('Nanlite', 'PJ-BM-19 Projector', 'projection', 'lens', [0.15, 0.15], 0.35, 0.22, 19),
  M('Nanlite', 'PavoTube Softbox (2ft)', 'softbox', 'rect', [0.65, 0.12], 0.08, 0.65, 110, { mount: 'proprietary', interior: 'white' }),
  M('Nanlite', 'PavoTube Softbox (4ft)', 'softbox', 'rect', [1.25, 0.12], 0.08, 0.65, 110, { mount: 'proprietary', interior: 'white' }),
  M('Nanlite', 'PavoTube Barndoor/Eggcrate (4ft)', 'barndoors', 'rect', [1.25, 0.1], 0.08, 0.55, 60, { mount: 'proprietary' }),

  // Profoto / Westcott / others
  M('Profoto', 'OCF Beauty Dish 2\' White', 'beauty-dish', 'dish', [0.6, 0.6], 0.2, 0.6, 70, { mount: 'proprietary', interior: 'white' }),
  M('Profoto', 'RFi Octa 3\'', 'octabox', 'octa', [0.9, 0.9], 0.5, 0.45, 100, { mount: 'proprietary' }),
  M('Profoto', 'Umbrella Deep White M', 'umbrella-bounce', 'umbrella', [1.05, 1.05], 0.6, 0.55, 90, { mount: 'universal', interior: 'white' }),
  M('Westcott', 'Rapid Box Switch Octa-M 36"', 'octabox', 'octa', [0.91, 0.91], 0.5, 0.45, 100),
  M('Westcott', 'Rapid Box Strip 1×3', 'stripbox', 'rect', [0.3, 0.9], 0.35, 0.42, 95),
  M('Westcott', 'Apollo Orb 43"', 'octabox', 'octa', [1.09, 1.09], 0.45, 0.45, 100, { mount: 'universal' }),
  M('Chimera', 'Lantern 30"', 'lantern', 'sphere', [0.76, 0.76], 0.7, 0.5, 300, { spill: 0.7, interior: 'white' }),
  M('DoPchoice', 'Snapbag 2×3', 'softbox', 'rect', [0.6, 0.9], 0.35, 0.5, 100, { interior: 'white' }),
  M('DoPchoice', 'Snapgrid 40°', 'barndoors', 'rect', [0.6, 0.9], 0.15, 0.6, 40),
];

export const MODIFIER_MAP = new Map(MODIFIERS.map((m) => [m.id, m]));

export interface Grid {
  id: string;
  name: string;
  deg: number;
  efficiency: number;
}

export const GRIDS: Grid[] = [
  { id: 'grid-20', name: '20° Fabric Grid', deg: 20, efficiency: 0.45 },
  { id: 'grid-30', name: '30° Fabric Grid', deg: 30, efficiency: 0.55 },
  { id: 'grid-40', name: '40° Fabric Grid', deg: 40, efficiency: 0.65 },
  { id: 'grid-50', name: '50° Fabric Grid', deg: 50, efficiency: 0.72 },
  { id: 'grid-60', name: '60° Fabric Grid', deg: 60, efficiency: 0.8 },
  { id: 'honeycomb-10', name: '10° Honeycomb (reflector)', deg: 10, efficiency: 0.3 },
  { id: 'honeycomb-20', name: '20° Honeycomb (reflector)', deg: 20, efficiency: 0.4 },
];
export const GRID_MAP = new Map(GRIDS.map((g) => [g.id, g]));

export interface Stand {
  id: string;
  name: string;
  minH: number;
  maxH: number;
  kind: 'c-stand' | 'light-stand' | 'boom' | 'floor' | 'combo' | 'clamp' | 'ceiling' | 'none' | 'tripod';
  /** horizontal arm reach for booms */
  reach?: number;
}

export const STANDS: Stand[] = [
  { id: 'light-stand-8', name: 'Light Stand 2.4 m (8 ft)', minH: 0.9, maxH: 2.4, kind: 'light-stand' },
  { id: 'light-stand-10', name: 'Air-cushioned Stand 3 m (10 ft)', minH: 1.1, maxH: 3.0, kind: 'light-stand' },
  { id: 'c-stand-40', name: 'C-Stand 40" w/ grip arm', minH: 1.1, maxH: 3.2, kind: 'c-stand' },
  { id: 'c-stand-20', name: 'Baby C-Stand 20"', minH: 0.6, maxH: 1.6, kind: 'c-stand' },
  { id: 'combo-stand', name: 'Combo / Junior Stand', minH: 1.1, maxH: 3.6, kind: 'combo' },
  { id: 'boom-arm', name: 'Boom Arm on Stand (overhead)', minH: 1.5, maxH: 3.6, kind: 'boom', reach: 1.2 },
  { id: 'floor-stand', name: 'Floor Stand / Low Boy', minH: 0.1, maxH: 0.5, kind: 'floor' },
  { id: 'clamp', name: 'Super Clamp / Magic Arm (rigged)', minH: 0.3, maxH: 3.5, kind: 'clamp' },
  { id: 'ceiling', name: 'Ceiling / Pipe Rigged', minH: 1.5, maxH: 4.5, kind: 'ceiling' },
  { id: 'no-stand', name: 'No stand (placed / hand-held)', minH: 0, maxH: 4.5, kind: 'none' },
];
export const STAND_MAP = new Map(STANDS.map((s) => [s.id, s]));

export interface FlagDef {
  id: string;
  name: string;
  category: 'flag' | 'frame' | 'bounce' | 'vflat' | 'scrim' | 'cookie';
  width: number;
  height: number;
  /** surface behaviour */
  material: 'black' | 'white' | 'silver' | 'gold' | 'diffusion' | 'net' | 'cookie';
  /** for diffusion: transmission and softening; for nets: stops reduction */
  transmission: number;
  doubleSidedColor?: string;
  standId: string;
}

export const FLAGS: FlagDef[] = [
  { id: 'flag-12x18', name: 'Flag 12×18"', category: 'flag', width: 12 * 0.0254, height: 18 * 0.0254, material: 'black', transmission: 0, standId: 'c-stand-40' },
  { id: 'flag-18x24', name: 'Flag 18×24"', category: 'flag', width: 18 * 0.0254, height: 24 * 0.0254, material: 'black', transmission: 0, standId: 'c-stand-40' },
  { id: 'flag-24x36', name: 'Flag 24×36"', category: 'flag', width: 24 * 0.0254, height: 36 * 0.0254, material: 'black', transmission: 0, standId: 'c-stand-40' },
  { id: 'floppy-4x4', name: 'Floppy 4×4\'', category: 'flag', width: 1.22, height: 1.22, material: 'black', transmission: 0, standId: 'c-stand-40' },
  { id: 'single-net', name: 'Single Net 24×36" (½ stop)', category: 'scrim', width: 0.61, height: 0.91, material: 'net', transmission: 0.7, standId: 'c-stand-40' },
  { id: 'double-net', name: 'Double Net 24×36" (1 stop)', category: 'scrim', width: 0.61, height: 0.91, material: 'net', transmission: 0.5, standId: 'c-stand-40' },
  { id: 'frame-216', name: '4×4 Frame · Lee 216 Full White', category: 'frame', width: 1.22, height: 1.22, material: 'diffusion', transmission: 0.36, standId: 'c-stand-40' },
  { id: 'frame-250', name: '4×4 Frame · Lee 250 Half White', category: 'frame', width: 1.22, height: 1.22, material: 'diffusion', transmission: 0.55, standId: 'c-stand-40' },
  { id: 'frame-251', name: '4×4 Frame · Lee 251 Quarter White', category: 'frame', width: 1.22, height: 1.22, material: 'diffusion', transmission: 0.7, standId: 'c-stand-40' },
  { id: 'frame-grid-full', name: '4×4 Frame · Full Grid Cloth', category: 'frame', width: 1.22, height: 1.22, material: 'diffusion', transmission: 0.3, standId: 'c-stand-40' },
  { id: 'frame-grid-half', name: '4×4 Frame · ½ Grid Cloth', category: 'frame', width: 1.22, height: 1.22, material: 'diffusion', transmission: 0.5, standId: 'c-stand-40' },
  { id: 'butterfly-6', name: '6×6 Butterfly · Silk', category: 'frame', width: 1.83, height: 1.83, material: 'diffusion', transmission: 0.45, standId: 'combo-stand' },
  { id: 'butterfly-8', name: '8×8 Butterfly · Ultrabounce', category: 'bounce', width: 2.44, height: 2.44, material: 'white', transmission: 0, doubleSidedColor: '#111111', standId: 'combo-stand' },
  { id: 'butterfly-12', name: '12×12 Overhead · Silk', category: 'frame', width: 3.66, height: 3.66, material: 'diffusion', transmission: 0.45, standId: 'combo-stand' },
  { id: 'vflat-white', name: 'V-Flat 4×8\' (white/black)', category: 'vflat', width: 1.22, height: 2.44, material: 'white', transmission: 0, doubleSidedColor: '#0d0d0d', standId: 'no-stand' },
  { id: 'vflat-black', name: 'V-Flat 4×8\' (black side out)', category: 'vflat', width: 1.22, height: 2.44, material: 'black', transmission: 0, doubleSidedColor: '#f2f2f2', standId: 'no-stand' },
  { id: 'vflat-world-30x40', name: 'Foam Core 30×40"', category: 'bounce', width: 0.76, height: 1.02, material: 'white', transmission: 0, standId: 'c-stand-40' },
  { id: 'reflector-5in1-white', name: '5-in-1 Reflector 42" (white)', category: 'bounce', width: 1.07, height: 1.07, material: 'white', transmission: 0, standId: 'c-stand-40' },
  { id: 'reflector-5in1-silver', name: '5-in-1 Reflector 42" (silver)', category: 'bounce', width: 1.07, height: 1.07, material: 'silver', transmission: 0, standId: 'c-stand-40' },
  { id: 'reflector-5in1-gold', name: '5-in-1 Reflector 42" (gold)', category: 'bounce', width: 1.07, height: 1.07, material: 'gold', transmission: 0, standId: 'c-stand-40' },
  { id: 'reflector-5in1-diff', name: '5-in-1 Reflector 42" (diffuser)', category: 'frame', width: 1.07, height: 1.07, material: 'diffusion', transmission: 0.6, standId: 'c-stand-40' },
  { id: 'cookie', name: 'Cucoloris (cookie) 24×36"', category: 'cookie', width: 0.61, height: 0.91, material: 'cookie', transmission: 0.35, standId: 'c-stand-40' },
  { id: 'negative-fill-4x8', name: 'Negative Fill Duvetyne 4×8\'', category: 'flag', width: 1.22, height: 2.44, material: 'black', transmission: 0, standId: 'combo-stand' },
];
export const FLAG_MAP = new Map(FLAGS.map((f) => [f.id, f]));

export const SENSORS = [
  { id: 'ff', name: 'Full Frame (36×24)', w: 36, h: 24 },
  { id: 's35', name: 'Super 35 (24.9×18.7)', w: 24.9, h: 18.7 },
  { id: 'apsc', name: 'APS-C (23.5×15.6)', w: 23.5, h: 15.6 },
  { id: 'apsc-canon', name: 'APS-C Canon (22.3×14.9)', w: 22.3, h: 14.9 },
  { id: 'mft', name: 'Micro Four Thirds (17.3×13)', w: 17.3, h: 13 },
  { id: 'phone', name: 'Phone main (≈9.8×7.3)', w: 9.8, h: 7.3 },
  { id: 'lf', name: 'ARRI LF (36.7×25.5)', w: 36.7, h: 25.5 },
];
export const SENSOR_MAP = new Map(SENSORS.map((s) => [s.id, s]));

export const ASPECTS: Record<string, number> = {
  '16:9': 16 / 9,
  '2.39:1': 2.39,
  '1.85:1': 1.85,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '1:1': 1,
};

