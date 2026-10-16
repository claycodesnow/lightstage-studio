// Colour science helpers: Kelvin → linear sRGB, HSI → RGB, gels, green/magenta.

export type RGB = [number, number, number];

/** Planckian locus approximation (Tanner Helland, refined) returning sRGB 0..1 (display-referred). */
export function kelvinToRGB(k: number): RGB {
  const t = Math.min(40000, Math.max(1000, k)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [c(r), c(g), c(b)];
}

export function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function linearToSrgb(c: number) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Normalise so that luminance == 1 (keeps photometric intensity independent of colour). */
export function normalizeLuma([r, g, b]: RGB): RGB {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb || 1;
  return [lr / y, lg / y, lb / y];
}

export function hsiToRGB(h: number, s: number): RGB {
  // HSV with V=1 (good proxy of fixture HSI mode)
  const S = s / 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return 1 - S * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

export function hexToRGB(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: RGB) {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

/** Apply green(+)/magenta(-) shift, -1..1 ≈ ±1 full plus-green / minus-green. */
export function applyGM([r, g, b]: RGB, gm: number): RGB {
  const k = gm * 0.25;
  return [r * (1 - Math.max(0, k)) * (1 + Math.max(0, -k) * 0.3), g * (1 + k), b * (1 - Math.max(0, k)) * (1 + Math.max(0, -k) * 0.3)];
}

export interface Gel {
  id: string;
  name: string;
  brand: string;
  /** colour multiplier (sRGB) */
  color: string;
  /** transmission 0..1 */
  transmission: number;
  /** shift in mired for CTO/CTB style gels, used for CCT readouts */
  mired?: number;
}

export const GELS: Gel[] = [
  { id: 'cto-full', name: 'Full CTO (204)', brand: 'Lee', color: '#ffb46b', transmission: 0.55, mired: 159 },
  { id: 'cto-half', name: '1/2 CTO (205)', brand: 'Lee', color: '#ffd09e', transmission: 0.7, mired: 81 },
  { id: 'cto-quarter', name: '1/4 CTO (206)', brand: 'Lee', color: '#ffe4c6', transmission: 0.81, mired: 42 },
  { id: 'ctb-full', name: 'Full CTB (201)', brand: 'Lee', color: '#8fb4ff', transmission: 0.36, mired: -137 },
  { id: 'ctb-half', name: '1/2 CTB (202)', brand: 'Lee', color: '#b8cfff', transmission: 0.55, mired: -78 },
  { id: 'ctb-quarter', name: '1/4 CTB (203)', brand: 'Lee', color: '#d6e3ff', transmission: 0.69, mired: -35 },
  { id: 'plus-green', name: 'Plus Green (244)', brand: 'Lee', color: '#d8ffcf', transmission: 0.8 },
  { id: 'minus-green', name: 'Minus Green (247)', brand: 'Lee', color: '#ffd6f0', transmission: 0.7 },
  { id: 'bastard-amber', name: 'Bastard Amber (R02)', brand: 'Rosco', color: '#ffd9b3', transmission: 0.8 },
  { id: 'straw', name: 'Straw (R10)', brand: 'Rosco', color: '#fff0a0', transmission: 0.83 },
  { id: 'steel-blue', name: 'Steel Blue (117)', brand: 'Lee', color: '#9fd5e6', transmission: 0.55 },
  { id: 'congo-blue', name: 'Congo Blue (R382)', brand: 'Rosco', color: '#2a1a9c', transmission: 0.02 },
  { id: 'primary-red', name: 'Primary Red (106)', brand: 'Lee', color: '#ff1a1a', transmission: 0.1 },
  { id: 'magenta', name: 'Magenta (R343)', brand: 'Rosco', color: '#ff3cc8', transmission: 0.18 },
  { id: 'teal', name: 'Jade / Teal (R4360)', brand: 'Rosco', color: '#22d6b8', transmission: 0.25 },
  { id: 'lavender', name: 'Lavender (R58)', brand: 'Rosco', color: '#c9a8ff', transmission: 0.3 },
];

export const SKIN_TONES = [
  // Monk Skin Tone scale (Google, CC-BY 4.0), 10 tones.
  { id: 'mst1', name: 'Monk 01', hex: '#f6ede4' },
  { id: 'mst2', name: 'Monk 02', hex: '#f3e7db' },
  { id: 'mst3', name: 'Monk 03', hex: '#f7ead0' },
  { id: 'mst4', name: 'Monk 04', hex: '#eadaba' },
  { id: 'mst5', name: 'Monk 05', hex: '#d7bd96' },
  { id: 'mst6', name: 'Monk 06', hex: '#a07e56' },
  { id: 'mst7', name: 'Monk 07', hex: '#825c43' },
  { id: 'mst8', name: 'Monk 08', hex: '#604134' },
  { id: 'mst9', name: 'Monk 09', hex: '#3a312a' },
  { id: 'mst10', name: 'Monk 10', hex: '#292420' },
];
