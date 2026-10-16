// Lighting fixture catalog.
// Photometrics are compiled from published manufacturer/retailer spec sheets. Published numbers are
// frequently inconsistent between sources, so every fixture has an editable output calibration in the
// inspector. `lux1m` is the on-axis illuminance at 1 m with the fixture's standard reflector/optic at
// `beam` degrees (full-angle), at its brightest white setting.

export type FixtureCategory =
  | 'cob'
  | 'panel'
  | 'tube'
  | 'fresnel'
  | 'flexible'
  | 'mini'
  | 'strobe'
  | 'ring'
  | 'practical'
  | 'house'
  | 'spot';

export type ColorCapability = 'daylight' | 'tungsten' | 'bicolor' | 'rgbww' | 'rgb' | 'fixed';

export interface Fixture {
  id: string;
  brand: string;
  model: string;
  category: FixtureCategory;
  watts: number;
  /** on-axis lux at 1m with standard reflector/optic (continuous) */
  lux1m: number;
  beam: number; // full beam angle in degrees for lux1m
  /** zoomable/fresnel beam range */
  zoom?: [number, number];
  cct: [number, number];
  color: ColorCapability;
  cri?: number;
  mount: 'bowens' | 'proprietary' | 'none' | 'spigot' | 'e26';
  /** emitting shape and size (meters) */
  shape: 'point' | 'panel' | 'tube' | 'ring' | 'bulb' | 'strip';
  size: [number, number];
  battery?: boolean;
  /** strobes: guide number (m, ISO100) with standard reflector, and modelling lamp watts */
  gn?: number;
  ws?: number;
  /** practicals: lumens and whether they emit omni (bulb) or downward (shade) */
  lumens?: number;
  pixelControl?: boolean;
  /** built-in green(+)/magenta(-) cast of cheap or fluorescent sources, -1..1 */
  gmBias?: number;
  /** house fixtures: how it is mounted in a typical rental */
  houseMount?: 'recessed' | 'track' | 'pendant' | 'flush' | 'wall' | 'troffer' | 'cabinet';
  year?: number;
  notes?: string;
}

const F = (
  brand: string,
  model: string,
  category: FixtureCategory,
  watts: number,
  lux1m: number,
  beam: number,
  cct: [number, number],
  color: ColorCapability,
  mount: Fixture['mount'],
  shape: Fixture['shape'],
  size: [number, number],
  extra: Partial<Fixture> = {},
): Fixture => ({
  id: (brand + '-' + model).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  brand,
  model,
  category,
  watts,
  lux1m,
  beam,
  cct,
  color,
  mount,
  shape,
  size,
  cri: 95,
  ...extra,
});

const COB: [number, number] = [0.12, 0.12];
const D56: [number, number] = [5600, 5600];
const BI: [number, number] = [2700, 6500];
const TUBE = (len: number): [number, number] => [len, 0.03];

export const FIXTURES: Fixture[] = [
  // ───────────── GODOX ─────────────
  F('Godox', 'SL60W', 'cob', 60, 4300, 55, D56, 'daylight', 'bowens', 'point', COB, { cri: 93, notes: 'Budget fan-cooled COB' }),
  F('Godox', 'SL60IIBi', 'cob', 60, 3200, 55, [2800, 6500], 'bicolor', 'bowens', 'point', COB, { cri: 96 }),
  F('Godox', 'SL60IID', 'cob', 70, 4700, 55, D56, 'daylight', 'bowens', 'point', COB, { cri: 96 }),
  F('Godox', 'SL100D', 'cob', 100, 7600, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Godox', 'SL100Bi', 'cob', 100, 6000, 55, [2800, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Godox', 'SL150 II', 'cob', 150, 47000, 30, D56, 'daylight', 'bowens', 'point', COB),
  F('Godox', 'SL150 III', 'cob', 160, 73600, 25, D56, 'daylight', 'bowens', 'point', COB, { cri: 96, year: 2022 }),
  F('Godox', 'SL150 IIIBi', 'cob', 160, 62000, 25, [2800, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Godox', 'SL200 II', 'cob', 200, 72800, 25, D56, 'daylight', 'bowens', 'point', COB),
  F('Godox', 'SL200 III', 'cob', 215, 87500, 25, D56, 'daylight', 'bowens', 'point', COB, { year: 2022 }),
  F('Godox', 'SL200 IIIBi', 'cob', 215, 76000, 25, [2800, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Godox', 'SL300 II', 'cob', 300, 95000, 25, D56, 'daylight', 'bowens', 'point', COB),
  F('Godox', 'SL300 III', 'cob', 330, 112000, 25, D56, 'daylight', 'bowens', 'point', COB, { year: 2022 }),
  F('Godox', 'SL300 IIIBi', 'cob', 330, 98000, 25, [2800, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Godox', 'VL150', 'cob', 150, 61000, 25, D56, 'daylight', 'bowens', 'point', COB, { battery: true }),
  F('Godox', 'VL200', 'cob', 200, 75000, 25, D56, 'daylight', 'bowens', 'point', COB, { battery: true }),
  F('Godox', 'VL300', 'cob', 300, 92000, 25, D56, 'daylight', 'bowens', 'point', COB, { battery: true }),
  F('Godox', 'VL150 II', 'cob', 150, 66000, 25, D56, 'daylight', 'bowens', 'point', COB, { battery: true }),
  F('Godox', 'VL300 II', 'cob', 300, 98000, 25, D56, 'daylight', 'bowens', 'point', COB, { battery: true }),
  F('Godox', 'ML30', 'mini', 30, 1600, 55, D56, 'daylight', 'proprietary', 'point', [0.06, 0.06], { battery: true }),
  F('Godox', 'ML30Bi', 'mini', 30, 1300, 55, [2800, 6500], 'bicolor', 'proprietary', 'point', [0.06, 0.06], { battery: true }),
  F('Godox', 'ML60', 'mini', 60, 3000, 55, D56, 'daylight', 'proprietary', 'point', [0.07, 0.07], { battery: true }),
  F('Godox', 'ML60 II Bi', 'mini', 70, 3450, 55, [2800, 6500], 'bicolor', 'bowens', 'point', [0.07, 0.07], { battery: true }),
  F('Godox', 'ML100Bi', 'mini', 100, 6800, 55, [2800, 6500], 'bicolor', 'bowens', 'point', [0.08, 0.08], { battery: true }),
  F('Godox', 'M200D', 'cob', 230, 45000, 30, D56, 'daylight', 'bowens', 'point', COB),
  F('Godox', 'M300D', 'cob', 330, 70000, 30, D56, 'daylight', 'bowens', 'point', COB),
  F('Godox', 'M600D', 'cob', 740, 125000, 30, D56, 'daylight', 'bowens', 'point', [0.15, 0.15]),
  F('Godox', 'M600Bi', 'cob', 720, 100000, 30, [2800, 6500], 'bicolor', 'bowens', 'point', [0.15, 0.15]),
  F('Godox', 'MG1200Bi', 'cob', 1200, 175000, 30, [2800, 6500], 'bicolor', 'bowens', 'point', [0.2, 0.2]),
  F('Godox', 'MS200', 'cob', 200, 27500, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Godox', 'MS300', 'cob', 300, 41000, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Godox', 'UL60', 'cob', 60, 3100, 55, D56, 'daylight', 'bowens', 'point', COB, { notes: 'Silent, fanless' }),
  F('Godox', 'UL150 II', 'cob', 165, 34000, 25, D56, 'daylight', 'bowens', 'point', COB, { notes: 'Silent, fanless' }),
  F('Godox', 'UL150 IIBi', 'cob', 165, 30000, 25, [2800, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Godox', 'LA150D', 'cob', 190, 76000, 25, D56, 'daylight', 'bowens', 'point', COB, { notes: 'Litemons' }),
  F('Godox', 'LA200Bi', 'cob', 230, 70000, 25, [2800, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Godox', 'KNOWLED MG1200R', 'cob', 1200, 160000, 30, [1800, 20000], 'rgbww', 'bowens', 'point', [0.2, 0.2]),
  F('Godox', 'KNOWLED M600R', 'cob', 700, 85000, 30, [1800, 20000], 'rgbww', 'bowens', 'point', [0.15, 0.15]),
  F('Godox', 'SZ150R', 'cob', 150, 18000, 55, [2800, 6500], 'rgbww', 'bowens', 'point', COB, { zoom: [10, 60] }),
  F('Godox', 'SZ300R', 'cob', 300, 32000, 55, [2500, 10000], 'rgbww', 'bowens', 'point', COB, { zoom: [10, 60] }),
  F('Godox', 'LD75R', 'panel', 75, 1300, 120, [2500, 8500], 'rgbww', 'none', 'panel', [0.4, 0.4]),
  F('Godox', 'LD150RS', 'panel', 150, 2600, 120, [2500, 8500], 'rgbww', 'none', 'panel', [0.55, 0.55]),
  F('Godox', 'P260C', 'panel', 30, 2400, 60, [3300, 5600], 'bicolor', 'none', 'panel', [0.25, 0.19]),
  F('Godox', 'LDX50R', 'panel', 50, 1800, 120, [2500, 8500], 'rgbww', 'none', 'panel', [0.42, 0.42]),
  F('Godox', 'LDX100R', 'panel', 100, 3100, 120, [2500, 8500], 'rgbww', 'none', 'panel', [0.58, 0.58]),
  F('Godox', 'TL30', 'tube', 22, 230, 140, [2700, 6500], 'rgbww', 'none', 'tube', TUBE(0.6), { battery: true, pixelControl: true }),
  F('Godox', 'TL60', 'tube', 40, 400, 140, [2700, 6500], 'rgbww', 'none', 'tube', TUBE(1.2), { battery: true, pixelControl: true }),
  F('Godox', 'TL120', 'tube', 80, 760, 140, [2700, 6500], 'rgbww', 'none', 'tube', TUBE(2.4), { battery: true, pixelControl: true }),
  F('Godox', 'TP2R', 'tube', 12, 140, 140, [2700, 6500], 'rgbww', 'none', 'tube', TUBE(0.6), { battery: true, pixelControl: true, notes: 'Knowled TP pixel tube' }),
  F('Godox', 'TP4R', 'tube', 25, 270, 140, [2700, 6500], 'rgbww', 'none', 'tube', TUBE(1.2), { battery: true, pixelControl: true }),
  F('Godox', 'TP8R', 'tube', 50, 520, 140, [2700, 6500], 'rgbww', 'none', 'tube', TUBE(2.4), { battery: true, pixelControl: true }),
  F('Godox', 'F200Bi', 'flexible', 200, 4300, 120, [2800, 6500], 'bicolor', 'none', 'panel', [0.6, 0.6], { notes: 'Flexible LED mat 2x2' }),
  F('Godox', 'F400Bi', 'flexible', 400, 6800, 120, [2800, 6500], 'bicolor', 'none', 'panel', [0.6, 1.2]),
  F('Godox', 'F600Bi', 'flexible', 600, 9400, 120, [2800, 6500], 'bicolor', 'none', 'panel', [1.2, 1.2]),
  F('Godox', 'ES45 Kit', 'panel', 45, 1600, 70, [2700, 6500], 'bicolor', 'none', 'panel', [0.3, 0.3]),
  F('Godox', 'LR150 Ring', 'ring', 38, 1700, 90, [3000, 6000], 'bicolor', 'none', 'ring', [0.46, 0.46]),
  F('Godox', 'R1 Mini RGB', 'mini', 5, 300, 60, [2500, 8500], 'rgbww', 'none', 'panel', [0.08, 0.08], { battery: true }),
  F('Godox', 'M1 RGB', 'mini', 8, 540, 60, [2500, 8500], 'rgbww', 'none', 'panel', [0.12, 0.07], { battery: true }),
  F('Godox', 'AD100Pro', 'strobe', 100, 0, 78, D56, 'daylight', 'proprietary', 'point', [0.06, 0.06], { gn: 30, ws: 100, battery: true }),
  F('Godox', 'AD200Pro', 'strobe', 200, 0, 78, D56, 'daylight', 'proprietary', 'point', [0.06, 0.06], { gn: 52, ws: 200, battery: true }),
  F('Godox', 'AD300Pro', 'strobe', 300, 0, 78, D56, 'daylight', 'bowens', 'point', [0.06, 0.06], { gn: 60, ws: 300, battery: true }),
  F('Godox', 'AD400Pro', 'strobe', 400, 0, 78, D56, 'daylight', 'proprietary', 'point', [0.06, 0.06], { gn: 72, ws: 400, battery: true }),
  F('Godox', 'AD600Pro', 'strobe', 600, 0, 78, D56, 'daylight', 'bowens', 'point', [0.06, 0.06], { gn: 87, ws: 600, battery: true }),
  F('Godox', 'AD1200Pro', 'strobe', 1200, 0, 78, D56, 'daylight', 'bowens', 'point', [0.08, 0.08], { gn: 105, ws: 1200, battery: true }),
  F('Godox', 'MS300V', 'strobe', 300, 0, 78, D56, 'daylight', 'bowens', 'point', [0.06, 0.06], { gn: 58, ws: 300 }),
  F('Godox', 'SK400II', 'strobe', 400, 0, 78, D56, 'daylight', 'bowens', 'point', [0.06, 0.06], { gn: 65, ws: 400 }),
  F('Godox', 'V1 Speedlight', 'strobe', 76, 0, 60, D56, 'daylight', 'none', 'point', [0.05, 0.05], { gn: 60, ws: 76, battery: true }),

  // ───────────── APUTURE ─────────────
  F('Aputure', 'LS 60d', 'cob', 80, 8300, 60, D56, 'daylight', 'proprietary', 'point', [0.06, 0.06], { zoom: [15, 60], battery: true, notes: '50,000 lux spot, 8,300 lux flood (zoom)' }),
  F('Aputure', 'LS 60x', 'cob', 80, 7400, 60, [2700, 6500], 'bicolor', 'proprietary', 'point', [0.06, 0.06], { zoom: [15, 60], battery: true }),
  F('Aputure', 'LS C120d II', 'cob', 180, 37000, 30, D56, 'daylight', 'bowens', 'point', COB),
  F('Aputure', 'LS C300d II', 'cob', 350, 45000, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Aputure', 'LS 300d II', 'cob', 350, 45000, 55, D56, 'daylight', 'bowens', 'point', COB, { notes: 'Hyper reflector; ~80,000 lux w/ Fresnel 2X spot' }),
  F('Aputure', 'LS 300x', 'cob', 350, 36000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Aputure', 'LS 600d', 'cob', 600, 76500, 55, D56, 'daylight', 'bowens', 'point', [0.15, 0.15], { notes: '8,500 lux @ 3m (hyper reflector)' }),
  F('Aputure', 'LS 600d Pro', 'cob', 720, 76500, 55, D56, 'daylight', 'bowens', 'point', [0.15, 0.15], { notes: '8,500 lux @ 3m (hyper reflector)' }),
  F('Aputure', 'LS 600x Pro', 'cob', 720, 62000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', [0.15, 0.15]),
  F('Aputure', 'LS 600c Pro', 'cob', 720, 52000, 55, [2300, 10000], 'rgbww', 'bowens', 'point', [0.15, 0.15]),
  F('Aputure', 'LS 600c Pro II', 'cob', 720, 62000, 55, [2300, 10000], 'rgbww', 'bowens', 'point', [0.15, 0.15]),
  F('Aputure', 'LS 1200d Pro', 'cob', 1440, 143000, 55, D56, 'daylight', 'bowens', 'point', [0.2, 0.2]),
  F('Aputure', 'STORM 80c', 'cob', 120, 9600, 55, [2000, 10000], 'rgbww', 'bowens', 'point', COB, { year: 2024 }),
  F('Aputure', 'STORM 400x', 'cob', 500, 64000, 55, [2500, 10000], 'bicolor', 'bowens', 'point', COB, { year: 2024 }),
  F('Aputure', 'STORM 1000c', 'cob', 1350, 120000, 55, [2000, 10000], 'rgbww', 'bowens', 'point', [0.2, 0.2], { year: 2024 }),
  F('Aputure', 'STORM 1200x', 'cob', 1500, 155000, 55, [2500, 10000], 'bicolor', 'bowens', 'point', [0.2, 0.2], { year: 2024 }),
  F('Aputure', 'Nova P300c', 'panel', 360, 4580, 110, [2300, 10000], 'rgbww', 'none', 'panel', [0.6, 0.31]),
  F('Aputure', 'Nova P600c', 'panel', 720, 9520, 110, [2300, 10000], 'rgbww', 'none', 'panel', [0.84, 0.43]),
  F('Aputure', 'MC', 'mini', 5, 390, 60, [3200, 6500], 'rgbww', 'none', 'panel', [0.09, 0.06], { battery: true }),
  F('Aputure', 'MC Pro', 'mini', 8, 1000, 60, [2000, 10000], 'rgbww', 'none', 'panel', [0.1, 0.07], { battery: true }),
  F('Aputure', 'MT Pro', 'tube', 7.5, 150, 140, [2000, 10000], 'rgbww', 'none', 'tube', TUBE(0.3), { battery: true, pixelControl: true }),
  F('Aputure', 'INFINIBAR PB3', 'tube', 25, 600, 120, [2000, 10000], 'rgbww', 'none', 'strip', [0.3, 0.05], { pixelControl: true }),
  F('Aputure', 'INFINIBAR PB6', 'tube', 50, 1100, 120, [2000, 10000], 'rgbww', 'none', 'strip', [0.6, 0.05], { pixelControl: true }),
  F('Aputure', 'INFINIBAR PB12', 'tube', 100, 2100, 120, [2000, 10000], 'rgbww', 'none', 'strip', [1.2, 0.05], { pixelControl: true }),
  F('Aputure', 'Accent B7c', 'practical', 7, 0, 300, [2000, 10000], 'rgbww', 'e26', 'bulb', [0.06, 0.06], { lumens: 550, battery: true }),
  F('Aputure', 'Electro Storm XT26', 'fresnel', 2600, 180000, 60, [2500, 10000], 'bicolor', 'none', 'point', [0.3, 0.3], { zoom: [15, 60] }),

  // ───────────── AMARAN (by Aputure) ─────────────
  F('Amaran', '60d', 'cob', 65, 3800, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Amaran', '60x', 'cob', 65, 3100, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Amaran', '100d', 'cob', 130, 6500, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Amaran', '100x', 'cob', 130, 5500, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Amaran', '100d S', 'cob', 130, 7100, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Amaran', '200d', 'cob', 200, 9800, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Amaran', '200x', 'cob', 200, 8800, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Amaran', '200d S', 'cob', 200, 11000, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Amaran', '300c', 'cob', 300, 11500, 55, [2500, 7500], 'rgbww', 'bowens', 'point', COB),
  F('Amaran', '150c', 'cob', 150, 6000, 55, [2500, 7500], 'rgbww', 'bowens', 'point', COB),
  F('Amaran', 'COB 60d S', 'cob', 65, 4200, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Amaran', 'COB 60x S', 'cob', 65, 3600, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Amaran', 'Ray 60c', 'cob', 70, 3600, 55, [2500, 7500], 'rgbww', 'bowens', 'point', COB, { year: 2025 }),
  F('Amaran', 'F21c', 'flexible', 100, 2900, 120, [2500, 7500], 'rgbww', 'none', 'panel', [0.6, 0.3]),
  F('Amaran', 'F22c', 'flexible', 200, 4800, 120, [2500, 7500], 'rgbww', 'none', 'panel', [0.6, 0.6]),
  F('Amaran', 'F21x', 'flexible', 100, 3100, 120, [2500, 7500], 'bicolor', 'none', 'panel', [0.6, 0.3]),
  F('Amaran', 'F22x', 'flexible', 200, 5000, 120, [2500, 7500], 'bicolor', 'none', 'panel', [0.6, 0.6]),
  F('Amaran', 'P60c', 'panel', 60, 2100, 110, [2500, 7500], 'rgbww', 'none', 'panel', [0.3, 0.3]),
  F('Amaran', 'P60x', 'panel', 60, 2300, 110, [3200, 6500], 'bicolor', 'none', 'panel', [0.3, 0.3]),
  F('Amaran', 'PT1c', 'tube', 7, 150, 140, [2500, 7500], 'rgbww', 'none', 'tube', TUBE(0.3), { battery: true, pixelControl: true }),
  F('Amaran', 'PT2c', 'tube', 14, 280, 140, [2500, 7500], 'rgbww', 'none', 'tube', TUBE(0.6), { battery: true, pixelControl: true }),
  F('Amaran', 'PT4c', 'tube', 28, 550, 140, [2500, 7500], 'rgbww', 'none', 'tube', TUBE(1.2), { battery: true, pixelControl: true }),
  F('Amaran', 'T2c', 'tube', 32, 450, 140, [2500, 7500], 'rgbww', 'none', 'tube', TUBE(0.6), { pixelControl: true }),
  F('Amaran', 'T4c', 'tube', 64, 870, 140, [2500, 7500], 'rgbww', 'none', 'tube', TUBE(1.2), { pixelControl: true }),
  F('Amaran', 'Verge', 'tube', 20, 400, 120, [2700, 6500], 'bicolor', 'none', 'strip', [0.5, 0.03]),
  F('Amaran', 'SM5c Smart Strip', 'practical', 30, 0, 160, [2500, 7500], 'rgbww', 'none', 'strip', [5, 0.01], { lumens: 1500, pixelControl: true }),
  F('Amaran', 'Ace 25c', 'mini', 25, 1600, 70, [2500, 7500], 'rgbww', 'none', 'panel', [0.15, 0.15], { battery: true }),

  // ───────────── NANLITE ─────────────
  F('Nanlite', 'Forza 60', 'cob', 72, 3700, 55, D56, 'daylight', 'proprietary', 'point', COB, { battery: true }),
  F('Nanlite', 'Forza 60B', 'cob', 88, 3400, 55, [2700, 6500], 'bicolor', 'proprietary', 'point', COB, { battery: true }),
  F('Nanlite', 'Forza 60C', 'cob', 88, 3000, 55, [1800, 20000], 'rgbww', 'proprietary', 'point', COB, { battery: true }),
  F('Nanlite', 'Forza 150', 'cob', 170, 10800, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Nanlite', 'Forza 150B', 'cob', 190, 9000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Nanlite', 'Forza 300 II', 'cob', 350, 33000, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Nanlite', 'Forza 300B II', 'cob', 350, 29000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Nanlite', 'Forza 500 II', 'cob', 560, 53000, 55, D56, 'daylight', 'bowens', 'point', [0.15, 0.15]),
  F('Nanlite', 'Forza 500B II', 'cob', 560, 46000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', [0.15, 0.15]),
  F('Nanlite', 'Forza 720', 'cob', 800, 80000, 55, D56, 'daylight', 'bowens', 'point', [0.2, 0.2]),
  F('Nanlite', 'Forza 720B', 'cob', 800, 68000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', [0.2, 0.2]),
  F('Nanlite', 'FS-150', 'cob', 160, 10500, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Nanlite', 'FS-200', 'cob', 230, 14700, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Nanlite', 'FS-300', 'cob', 330, 21000, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Nanlite', 'FS-150B', 'cob', 160, 8500, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Nanlite', 'FS-300B', 'cob', 330, 17000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Nanlite', 'FC-120B', 'cob', 120, 7000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Nanlite', 'FC-300B', 'cob', 300, 17200, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Nanlite', 'FC-500B', 'cob', 500, 28000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', [0.15, 0.15]),
  F('Nanlite', 'Evoke 150C', 'cob', 150, 9000, 55, [1800, 20000], 'rgbww', 'bowens', 'point', COB, { year: 2024 }),
  F('Nanlite', 'Evoke 600C', 'cob', 750, 45000, 55, [1800, 20000], 'rgbww', 'bowens', 'point', [0.15, 0.15]),
  F('Nanlite', 'Evoke 1200', 'cob', 1200, 150000, 55, D56, 'daylight', 'bowens', 'point', [0.2, 0.2]),
  F('Nanlite', 'Evoke 2400B', 'cob', 2600, 210000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', [0.3, 0.3]),
  F('Nanlite', 'Evoke 900C', 'cob', 1000, 72000, 55, [1800, 20000], 'rgbww', 'bowens', 'point', [0.2, 0.2]),
  // PavoTube — every generation
  F('Nanlite', 'PavoTube 15C (Gen 1)', 'tube', 16, 240, 140, [2700, 6500], 'rgbww', 'none', 'tube', TUBE(0.6), { battery: true, pixelControl: true, year: 2018 }),
  F('Nanlite', 'PavoTube 30C (Gen 1)', 'tube', 32, 430, 140, [2700, 6500], 'rgbww', 'none', 'tube', TUBE(1.2), { battery: true, pixelControl: true, year: 2018 }),
  F('Nanlite', 'PavoTube 6C (Gen 1)', 'tube', 7, 110, 140, [2700, 6500], 'rgbww', 'none', 'tube', TUBE(0.3), { battery: true, year: 2019 }),
  F('Nanlite', 'PavoTube II 6C', 'tube', 9, 180, 140, [2700, 7500], 'rgbww', 'none', 'tube', TUBE(0.3), { battery: true, year: 2020 }),
  F('Nanlite', 'PavoTube II 15X', 'tube', 18, 330, 140, [2700, 7500], 'rgbww', 'none', 'tube', TUBE(0.6), { battery: true, pixelControl: true, year: 2021 }),
  F('Nanlite', 'PavoTube II 30X', 'tube', 36, 600, 140, [2700, 7500], 'rgbww', 'none', 'tube', TUBE(1.2), { battery: true, pixelControl: true, year: 2021 }),
  F('Nanlite', 'PavoTube II 15C', 'tube', 30, 423, 140, [2500, 7500], 'rgbww', 'none', 'tube', TUBE(0.6), { battery: true, pixelControl: true, year: 2022, notes: '423 lux @1m 5600K (spec)' }),
  F('Nanlite', 'PavoTube II 30C', 'tube', 60, 790, 140, [2500, 7500], 'rgbww', 'none', 'tube', TUBE(1.2), { battery: true, pixelControl: true, year: 2022 }),
  F('Nanlite', 'PavoTube II 15XR', 'tube', 18, 350, 140, [2700, 12000], 'rgbww', 'none', 'tube', TUBE(0.6), { battery: true, pixelControl: true, year: 2023, notes: 'Built-in CRMX' }),
  F('Nanlite', 'PavoTube II 30XR', 'tube', 36, 640, 140, [2700, 12000], 'rgbww', 'none', 'tube', TUBE(1.2), { battery: true, pixelControl: true, year: 2023, notes: 'Built-in CRMX' }),
  F('Nanlite', 'PavoTube II 60XR', 'tube', 72, 1150, 140, [2700, 12000], 'rgbww', 'none', 'tube', TUBE(2.4), { pixelControl: true, year: 2023 }),
  F('Nanlite', 'PavoTube T8-7X', 'tube', 8, 120, 160, [2700, 7500], 'rgbww', 'none', 'tube', TUBE(0.6), { pixelControl: true, year: 2021, notes: 'Practical-style T8 tube' }),
  F('Nanlite', 'PavoSlim 60C', 'panel', 60, 1700, 110, [2700, 7500], 'rgbww', 'none', 'panel', [0.37, 0.37]),
  F('Nanlite', 'PavoSlim 120C', 'panel', 125, 3200, 110, [2700, 7500], 'rgbww', 'none', 'panel', [0.65, 0.37]),
  F('Nanlite', 'PavoSlim 240C', 'panel', 240, 5800, 110, [2700, 7500], 'rgbww', 'none', 'panel', [1.21, 0.37]),
  F('Nanlite', 'Compac 20', 'panel', 24, 1000, 120, D56, 'daylight', 'none', 'panel', [0.2, 0.2]),
  F('Nanlite', 'Compac 68B', 'panel', 70, 2400, 120, [3200, 5600], 'bicolor', 'none', 'panel', [0.36, 0.36]),
  F('Nanlite', 'Lumipad 25', 'mini', 12, 500, 120, [3200, 5600], 'bicolor', 'none', 'panel', [0.25, 0.08], { battery: true }),
  F('Nanlite', 'Litolite 5C', 'mini', 5, 300, 70, [2700, 7500], 'rgbww', 'none', 'panel', [0.08, 0.08], { battery: true }),
  F('Nanlite', 'MixPanel 60', 'panel', 70, 2000, 120, [2700, 7500], 'rgbww', 'none', 'panel', [0.42, 0.25]),
  F('Nanlite', 'MixPanel 150', 'panel', 150, 4200, 120, [1800, 20000], 'rgbww', 'none', 'panel', [0.62, 0.35]),

  // ───────────── OTHER PRO / PROSUMER ─────────────
  F('Litepanels', 'Gemini 2x1 Soft', 'panel', 350, 3300, 100, [2700, 10000], 'rgbww', 'none', 'panel', [0.65, 0.33]),
  F('Litepanels', 'Astra 6X Bi-Color', 'panel', 200, 4300, 50, [3200, 5600], 'bicolor', 'none', 'panel', [0.3, 0.3]),
  F('ARRI', 'SkyPanel S30-C', 'panel', 420, 3600, 105, [2800, 10000], 'rgbww', 'none', 'panel', [0.65, 0.3]),
  F('ARRI', 'SkyPanel S60-C', 'panel', 450, 6300, 105, [2800, 10000], 'rgbww', 'none', 'panel', [0.65, 0.3]),
  F('ARRI', 'Orbiter', 'cob', 500, 23000, 50, [2000, 20000], 'rgbww', 'proprietary', 'point', [0.15, 0.15]),
  F('ARRI', 'L5-C Fresnel', 'fresnel', 115, 3400, 50, [2800, 10000], 'rgbww', 'none', 'point', [0.13, 0.13], { zoom: [14, 50] }),
  F('ARRI', '650 Plus Tungsten', 'fresnel', 650, 2100, 40, [3200, 3200], 'tungsten', 'none', 'point', [0.13, 0.13], { zoom: [15, 60], cri: 100 }),
  F('ARRI', '150 Tungsten Fresnel', 'fresnel', 150, 600, 40, [3200, 3200], 'tungsten', 'none', 'point', [0.06, 0.06], { zoom: [15, 60], cri: 100 }),
  F('Astera', 'Titan Tube', 'tube', 72, 680, 140, [1750, 20000], 'rgbww', 'none', 'tube', TUBE(1.0), { battery: true, pixelControl: true }),
  F('Astera', 'Helios Tube', 'tube', 36, 340, 140, [1750, 20000], 'rgbww', 'none', 'tube', TUBE(0.5), { battery: true, pixelControl: true }),
  F('Astera', 'HydraPanel', 'mini', 15, 900, 60, [1750, 20000], 'rgbww', 'none', 'panel', [0.1, 0.1], { battery: true }),
  F('Astera', 'NYX Bulb', 'practical', 15, 0, 300, [1750, 20000], 'rgbww', 'e26', 'bulb', [0.07, 0.07], { lumens: 1100 }),
  F('Quasar Science', 'Double Rainbow 4ft', 'tube', 100, 900, 140, [2000, 10000], 'rgbww', 'none', 'tube', TUBE(1.2), { pixelControl: true }),
  F('Quasar Science', 'Rainbow 2 2ft', 'tube', 25, 240, 140, [2000, 10000], 'rgbww', 'none', 'tube', TUBE(0.6), { pixelControl: true }),
  F('Quasar Science', 'Q-LED Crossfade 4ft', 'tube', 50, 520, 140, [2000, 6000], 'bicolor', 'none', 'tube', TUBE(1.2)),
  F('Zhiyun', 'MOLUS X100', 'mini', 100, 6800, 55, [2700, 6500], 'bicolor', 'bowens', 'point', [0.06, 0.06], { battery: true }),
  F('Zhiyun', 'MOLUS G60', 'mini', 60, 3800, 55, [2700, 6500], 'bicolor', 'bowens', 'point', [0.06, 0.06], { battery: true }),
  F('SmallRig', 'RC 120B', 'cob', 120, 5800, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('SmallRig', 'RC 220B', 'cob', 220, 9100, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('SmallRig', 'RC 450B', 'cob', 450, 18000, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Elgato', 'Key Light', 'panel', 45, 1200, 80, [2900, 7000], 'bicolor', 'none', 'panel', [0.35, 0.25]),
  F('Elgato', 'Key Light Air', 'panel', 25, 700, 80, [2900, 7000], 'bicolor', 'none', 'panel', [0.25, 0.2]),
  F('Elgato', 'Ring Light', 'ring', 45, 1400, 90, [2900, 7000], 'bicolor', 'none', 'ring', [0.43, 0.43]),
  F('Neewer', '660 LED Panel', 'panel', 50, 1700, 50, [3200, 5600], 'bicolor', 'none', 'panel', [0.3, 0.25]),
  F('Neewer', '18" Ring Light', 'ring', 55, 1500, 90, [3200, 5600], 'bicolor', 'none', 'ring', [0.46, 0.46]),
  F('Neewer', 'CB60', 'cob', 70, 3300, 55, D56, 'daylight', 'bowens', 'point', COB),
  F('Neewer', 'CB200B', 'cob', 200, 8200, 55, [2700, 6500], 'bicolor', 'bowens', 'point', COB),
  F('Profoto', 'B10X Plus', 'strobe', 500, 0, 65, D56, 'daylight', 'proprietary', 'point', [0.06, 0.06], { gn: 76, ws: 500, battery: true }),
  F('Profoto', 'D2 500', 'strobe', 500, 0, 65, D56, 'daylight', 'proprietary', 'point', [0.06, 0.06], { gn: 70, ws: 500 }),
  F('Flashpoint', 'XPLOR 600 Pro', 'strobe', 600, 0, 78, D56, 'daylight', 'bowens', 'point', [0.06, 0.06], { gn: 87, ws: 600, battery: true, notes: 'Godox AD600Pro rebrand' }),

  // ───────────── PRACTICALS ─────────────
  F('Practical', 'A19 LED 60W-eq (2700K)', 'practical', 9, 0, 300, [2700, 2700], 'fixed', 'e26', 'bulb', [0.06, 0.06], { lumens: 800, cri: 82 }),
  F('Practical', 'A19 LED 100W-eq (3000K)', 'practical', 15, 0, 300, [3000, 3000], 'fixed', 'e26', 'bulb', [0.06, 0.06], { lumens: 1600, cri: 82 }),
  F('Practical', 'A19 LED 60W-eq Daylight (5000K)', 'practical', 9, 0, 300, [5000, 5000], 'fixed', 'e26', 'bulb', [0.06, 0.06], { lumens: 800, cri: 82 }),
  F('Practical', 'Incandescent 60W', 'practical', 60, 0, 300, [2800, 2800], 'fixed', 'e26', 'bulb', [0.06, 0.06], { lumens: 800, cri: 100 }),
  F('Practical', 'Edison Filament ST64 (2200K)', 'practical', 7, 0, 300, [2200, 2200], 'fixed', 'e26', 'bulb', [0.064, 0.14], { lumens: 600, cri: 90 }),
  F('Practical', 'Dimmable Filament G25 (2400K)', 'practical', 5, 0, 300, [2400, 2400], 'fixed', 'e26', 'bulb', [0.08, 0.08], { lumens: 450, cri: 90 }),
  F('Philips Hue', 'White & Color A19', 'practical', 9, 0, 300, [2000, 6500], 'rgbww', 'e26', 'bulb', [0.06, 0.06], { lumens: 1100, cri: 80 }),
  F('Philips Hue', 'Play Light Bar', 'practical', 6, 0, 120, [2000, 6500], 'rgbww', 'none', 'strip', [0.25, 0.04], { lumens: 530, cri: 80 }),
  F('Philips Hue', 'Lightstrip Plus (2m)', 'practical', 20, 0, 160, [2000, 6500], 'rgbww', 'none', 'strip', [2, 0.01], { lumens: 1600, cri: 80 }),
  F('Nanoleaf', 'Shapes Hexagons (9)', 'practical', 18, 0, 160, [1200, 6500], 'rgb', 'none', 'panel', [0.6, 0.5], { lumens: 900, cri: 80 }),
  F('Govee', 'RGBIC Floor Lamp', 'practical', 20, 0, 160, [2700, 6500], 'rgbww', 'none', 'strip', [0.04, 1.4], { lumens: 1000, cri: 80 }),
  F('Practical', 'Desk Lamp (LED, 3000K)', 'practical', 8, 0, 90, [3000, 3000], 'fixed', 'none', 'bulb', [0.1, 0.1], { lumens: 500, cri: 85 }),
  F('Practical', 'Floor Lamp with Shade (2700K)', 'practical', 15, 0, 300, [2700, 2700], 'fixed', 'none', 'bulb', [0.4, 0.3], { lumens: 1600, cri: 85 }),
  F('Practical', 'Paper Lantern 24" (Chinese ball)', 'practical', 100, 0, 300, [3200, 3200], 'fixed', 'none', 'bulb', [0.6, 0.6], { lumens: 1600, cri: 95 }),
  F('Practical', 'Fluorescent Tube T8 4ft (4100K)', 'practical', 32, 0, 300, [4100, 4100], 'fixed', 'none', 'tube', TUBE(1.2), { lumens: 2800, cri: 75, gmBias: 0.35 }),
  F('Practical', 'Neon Sign (LED flex)', 'practical', 12, 0, 160, [2000, 6500], 'rgb', 'none', 'strip', [0.6, 0.02], { lumens: 300, cri: 70 }),
  F('Practical', 'Candle', 'practical', 0, 0, 300, [1850, 1850], 'fixed', 'none', 'bulb', [0.02, 0.03], { lumens: 12, cri: 100 }),
  F('Practical', 'String Lights (10m warm)', 'practical', 6, 0, 300, [2200, 2200], 'fixed', 'none', 'strip', [3, 0.01], { lumens: 400, cri: 80 }),
  F('Practical', 'TV / Monitor 55" (glow)', 'practical', 100, 0, 120, [6500, 6500], 'rgb', 'none', 'panel', [1.22, 0.69], { lumens: 1200, cri: 70 }),
  F('Practical', 'Computer Monitor 27"', 'practical', 30, 0, 120, [6500, 6500], 'rgb', 'none', 'panel', [0.6, 0.34], { lumens: 300, cri: 70 }),
  F('Practical', 'Recessed Downlight 6"', 'practical', 12, 0, 90, [3000, 3000], 'fixed', 'none', 'bulb', [0.15, 0.15], { lumens: 900, cri: 90 }),
  F('Practical', 'Pendant (Edison, 2200K)', 'practical', 7, 0, 300, [2200, 2200], 'fixed', 'none', 'bulb', [0.15, 0.2], { lumens: 600, cri: 90 }),
  // ───────── HOUSE LIGHTING (what's already installed in a typical rental) ─────────
  F('House', 'Recessed Can 6" LED · 2700K', 'house', 12, 0, 90, [2700, 2700], 'fixed', 'none', 'bulb', [0.15, 0.15], { lumens: 900, cri: 82, houseMount: 'recessed' }),
  F('House', 'Recessed Can 6" LED · 3000K', 'house', 12, 0, 90, [3000, 3000], 'fixed', 'none', 'bulb', [0.15, 0.15], { lumens: 900, cri: 82, houseMount: 'recessed' }),
  F('House', 'Recessed Can 6" LED · 4000K', 'house', 12, 0, 90, [4000, 4000], 'fixed', 'none', 'bulb', [0.15, 0.15], { lumens: 950, cri: 80, gmBias: 0.06, houseMount: 'recessed' }),
  F('House', 'Recessed Can 6" LED · 5000K "daylight"', 'house', 12, 0, 90, [5000, 5000], 'fixed', 'none', 'bulb', [0.15, 0.15], { lumens: 950, cri: 80, gmBias: 0.12, houseMount: 'recessed' }),
  F('House', 'Recessed Wafer 4" · 3000K', 'house', 9, 0, 110, [3000, 3000], 'fixed', 'none', 'bulb', [0.1, 0.1], { lumens: 650, cri: 80, houseMount: 'recessed' }),
  F('House', 'Recessed Halogen MR16 · 2900K', 'house', 50, 0, 36, [2900, 2900], 'fixed', 'none', 'bulb', [0.05, 0.05], { lumens: 900, cri: 100, houseMount: 'recessed' }),
  F('House', 'Track Head PAR30 LED · 3000K', 'house', 15, 0, 36, [3000, 3000], 'fixed', 'none', 'bulb', [0.1, 0.1], { lumens: 1100, cri: 90, houseMount: 'track' }),
  F('House', 'Track Head Gallery Spot · 4000K', 'house', 20, 0, 24, [4000, 4000], 'fixed', 'none', 'bulb', [0.08, 0.08], { lumens: 1500, cri: 92, houseMount: 'track' }),
  F('House', 'Track Head Halogen PAR20 · 2900K', 'house', 50, 0, 30, [2900, 2900], 'fixed', 'none', 'bulb', [0.07, 0.07], { lumens: 550, cri: 100, houseMount: 'track' }),
  F('House', '2×4 LED Troffer Panel · 4000K', 'house', 40, 0, 120, [4000, 4000], 'fixed', 'none', 'panel', [0.6, 1.2], { lumens: 4400, cri: 80, gmBias: 0.08, houseMount: 'troffer' }),
  F('House', '2×2 LED Troffer Panel · 3500K', 'house', 30, 0, 120, [3500, 3500], 'fixed', 'none', 'panel', [0.6, 0.6], { lumens: 3300, cri: 80, gmBias: 0.06, houseMount: 'troffer' }),
  F('House', '2×4 Fluorescent Troffer T8 · 4100K', 'house', 96, 0, 120, [4100, 4100], 'fixed', 'none', 'panel', [0.6, 1.2], { lumens: 6400, cri: 72, gmBias: 0.4, houseMount: 'troffer', notes: 'Strong green spike — gel minus-green or match' }),
  F('House', 'Fluorescent Shop Light 4ft · 5000K', 'house', 64, 0, 150, [5000, 5000], 'fixed', 'none', 'tube', TUBE(1.2), { lumens: 5200, cri: 70, gmBias: 0.35, houseMount: 'flush' }),
  F('House', 'LED Shop Light 4ft · 5000K', 'house', 42, 0, 150, [5000, 5000], 'fixed', 'none', 'tube', TUBE(1.2), { lumens: 4500, cri: 80, gmBias: 0.12, houseMount: 'flush' }),
  F('House', 'Flush-mount Dome · 3000K', 'house', 22, 0, 300, [3000, 3000], 'fixed', 'none', 'bulb', [0.35, 0.35], { lumens: 1600, cri: 82, houseMount: 'flush' }),
  F('House', 'Ceiling Fan Light Kit · 2700K', 'house', 18, 0, 300, [2700, 2700], 'fixed', 'none', 'bulb', [0.3, 0.3], { lumens: 1200, cri: 82, houseMount: 'flush' }),
  F('House', 'Globe Pendant (opal) · 2700K', 'house', 10, 0, 300, [2700, 2700], 'fixed', 'none', 'bulb', [0.3, 0.3], { lumens: 800, cri: 85, houseMount: 'pendant' }),
  F('House', 'Metal Dome Pendant · 2700K', 'house', 10, 0, 100, [2700, 2700], 'fixed', 'none', 'bulb', [0.35, 0.35], { lumens: 800, cri: 85, houseMount: 'pendant' }),
  F('House', 'Edison Pendant Cluster (5) · 2200K', 'house', 35, 0, 300, [2200, 2200], 'fixed', 'none', 'bulb', [0.5, 0.3], { lumens: 2000, cri: 90, houseMount: 'pendant' }),
  F('House', 'Chandelier (8 candelabra) · 2700K', 'house', 40, 0, 300, [2700, 2700], 'fixed', 'none', 'bulb', [0.7, 0.6], { lumens: 2800, cri: 90, houseMount: 'pendant' }),
  F('House', 'Wall Sconce (up/down) · 2700K', 'house', 8, 0, 300, [2700, 2700], 'fixed', 'none', 'bulb', [0.15, 0.25], { lumens: 450, cri: 85, houseMount: 'wall' }),
  F('House', 'Under-cabinet LED Bar · 3000K', 'house', 8, 0, 120, [3000, 3000], 'fixed', 'none', 'strip', [0.6, 0.03], { lumens: 400, cri: 85, houseMount: 'cabinet' }),
  F('House', 'Industrial LED High-bay · 5000K', 'house', 150, 0, 100, [5000, 5000], 'fixed', 'none', 'bulb', [0.4, 0.4], { lumens: 21000, cri: 70, gmBias: 0.15, houseMount: 'pendant', notes: 'Warehouse / event space' }),
  F('House', 'Metal-halide High-bay · 4200K', 'house', 400, 0, 100, [4200, 4200], 'fixed', 'none', 'bulb', [0.45, 0.45], { lumens: 32000, cri: 65, gmBias: 0.3, houseMount: 'pendant', notes: 'Older warehouses — green/magenta shifts unit to unit' }),
  F('House', 'Smart Bulb RGB (Wiz/Hue) in fixture', 'house', 9, 0, 300, [2200, 6500], 'rgbww', 'e26', 'bulb', [0.1, 0.1], { lumens: 800, cri: 80, houseMount: 'flush' }),
];


export const FIXTURE_MAP = new Map(FIXTURES.map((f) => [f.id, f]));

export const CATEGORY_LABEL: Record<FixtureCategory, string> = {
  cob: 'COB / Point source',
  panel: 'Panels',
  tube: 'Tubes & bars',
  fresnel: 'Fresnels',
  flexible: 'Flexible mats',
  mini: 'Mini / pocket',
  strobe: 'Strobes & flashes',
  ring: 'Ring lights',
  practical: 'Practicals',
  house: 'House / installed',
  spot: 'Spot / projection',
};

/** Steradians of a cone of full angle `beam` (degrees). */
export function coneSolidAngle(beam: number) {
  return 2 * Math.PI * (1 - Math.cos(((Math.min(beam, 359) / 2) * Math.PI) / 180));
}

/** Estimate luminous flux leaving the fixture (lm). */
export function fixtureFlux(f: Fixture): number {
  if (f.lumens) return f.lumens;
  if (f.category === 'strobe') return 0;
  // flux ≈ E(1m)·Ω for a flat-top beam; standard reflectors are ~70% efficient relative to bare
  return f.lux1m * coneSolidAngle(f.beam);
}

/** Practicals and installed house fixtures behave alike: no stands, no modifiers. */
export function isPracticalLike(f: Fixture) {
  return f.category === 'practical' || f.category === 'house';
}
