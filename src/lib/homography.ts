// Perspective rectification: map a 4-point quad in a photo onto a flat rectangle (a wall).
import type { Vec2 } from '../types';

export type Mat3 = number[]; // row-major 9

/** Solve homography H mapping src[i] → dst[i] (4 correspondences). */
export function homography(src: Vec2[], dst: Vec2[]): Mat3 {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(A, b);
  return [...h, 1];
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r) => r[n]);
}

export function applyH(H: Mat3, x: number, y: number): Vec2 {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/**
 * Rectify the quad (normalized photo coords BL, BR, TR, TL) into an image of outW×outH.
 * Output pixel (0,0) is top-left of the wall span.
 */
export async function rectify(photoUrl: string, quad: Vec2[], outW: number, outH: number): Promise<string> {
  const img = await loadImage(photoUrl);
  const sw = img.naturalWidth, sh = img.naturalHeight;
  const scale = Math.min(1, 2400 / Math.max(sw, sh));
  const cw = Math.round(sw * scale), ch = Math.round(sh * scale);
  const sc = document.createElement('canvas');
  sc.width = cw;
  sc.height = ch;
  const sctx = sc.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0, cw, ch);
  const src = sctx.getImageData(0, 0, cw, ch).data;

  // dest rect corners (BL, BR, TR, TL) → src quad in pixel coords
  const dstRect: Vec2[] = [
    [0, outH],
    [outW, outH],
    [outW, 0],
    [0, 0],
  ];
  const srcPx = quad.map(([x, y]) => [x * cw, y * ch] as Vec2);
  const H = homography(dstRect, srcPx);

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d')!;
  const od = octx.createImageData(outW, outH);
  const o = od.data;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const [sx, sy] = applyH(H, x + 0.5, y + 0.5);
      const i = (y * outW + x) * 4;
      if (sx < 0 || sy < 0 || sx >= cw - 1 || sy >= ch - 1) {
        o[i + 3] = 0;
        continue;
      }
      const x0 = sx | 0, y0 = sy | 0;
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * cw + x0) * 4, i10 = i00 + 4, i01 = i00 + cw * 4, i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        o[i + c] =
          src[i00 + c] * (1 - fx) * (1 - fy) + src[i10 + c] * fx * (1 - fy) + src[i01 + c] * (1 - fx) * fy + src[i11 + c] * fx * fy;
      }
      o[i + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  return out.toDataURL('image/jpeg', 0.9);
}

/** Map a point in the photo (normalized) into wall-span coordinates (0..1 across, 0..1 up) using the quad. */
export function photoToSpan(quad: Vec2[], p: Vec2): Vec2 {
  const unit: Vec2[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const H = homography(quad, unit);
  return applyH(H, p[0], p[1]);
}

/** Average colour of a region of a photo (normalized rect), returned as sRGB hex. */
export async function sampleColor(photoUrl: string, x: number, y: number, r = 0.01): Promise<string> {
  const img = await loadImage(photoUrl);
  const c = document.createElement('canvas');
  const w = 256, h = Math.round((256 * img.naturalHeight) / img.naturalWidth);
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const rx = Math.max(1, Math.round(r * w));
  const d = ctx.getImageData(Math.max(0, Math.round(x * w) - rx), Math.max(0, Math.round(y * h) - rx), rx * 2, rx * 2).data;
  let R = 0, G = 0, B = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    R += d[i];
    G += d[i + 1];
    B += d[i + 2];
    n++;
  }
  const hx = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return '#' + hx(R) + hx(G) + hx(B);
}

export async function cropImage(photoUrl: string, crop: { x: number; y: number; w: number; h: number }, maxSize = 1024): Promise<string> {
  const img = await loadImage(photoUrl);
  const sw = crop.w * img.naturalWidth, sh = crop.h * img.naturalHeight;
  const s = Math.min(1, maxSize / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * s));
  c.height = Math.max(1, Math.round(sh * s));
  c.getContext('2d')!.drawImage(img, crop.x * img.naturalWidth, crop.y * img.naturalHeight, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

/** Downscale an uploaded file to a data URL (keeps colour, strips nothing else). */
export async function fileToDataUrl(file: File, maxSize = 3000): Promise<{ dataUrl: string; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL('image/jpeg', 0.92), width: c.width, height: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Read EXIF DateTimeOriginal from a JPEG (minimal parser). */
export async function readExifDate(file: File): Promise<string | undefined> {
  try {
    const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (buf.getUint16(0) !== 0xffd8) return;
    let off = 2;
    while (off < buf.byteLength) {
      const marker = buf.getUint16(off);
      const size = buf.getUint16(off + 2);
      if (marker === 0xffe1 && buf.getUint32(off + 4) === 0x45786966) {
        const tiff = off + 10;
        const le = buf.getUint16(tiff) === 0x4949;
        const u16 = (o: number) => buf.getUint16(o, le);
        const u32 = (o: number) => buf.getUint32(o, le);
        const readIFD = (ifd: number, want: number): number | undefined => {
          const n = u16(ifd);
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            if (u16(e) === want) return u32(e + 8);
          }
        };
        const ifd0 = tiff + u32(tiff + 4);
        const exifPtr = readIFD(ifd0, 0x8769);
        if (exifPtr === undefined) return;
        const dto = readIFD(tiff + exifPtr, 0x9003);
        if (dto === undefined) return;
        let s = '';
        for (let i = 0; i < 19; i++) s += String.fromCharCode(buf.getUint8(tiff + dto + i));
        // "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DDTHH:MM"
        return s.slice(0, 10).replace(/:/g, '-') + 'T' + s.slice(11, 16);
      }
      off += 2 + size;
    }
  } catch {
    return;
  }
}
