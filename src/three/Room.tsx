import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { RoomSpec, WallId, WallProjection } from '../types';
import { loadImage, rectify } from '../lib/homography';

const WALL_T = 0.12;

export function wallLength(room: RoomSpec, w: WallId) {
  return w === 'A' || w === 'C' ? room.width : room.depth;
}

/** Transform that places a wall's local XY plane (x along wall from inside-left, y up) into room space. */
export function wallTransform(room: RoomSpec, w: WallId): { position: THREE.Vector3; rotationY: number } {
  const hw = room.width / 2, hd = room.depth / 2;
  switch (w) {
    case 'A':
      return { position: new THREE.Vector3(-hw, 0, -hd), rotationY: 0 };
    case 'B':
      return { position: new THREE.Vector3(hw, 0, -hd), rotationY: -Math.PI / 2 };
    case 'C':
      return { position: new THREE.Vector3(hw, 0, hd), rotationY: Math.PI };
    case 'D':
    default:
      return { position: new THREE.Vector3(-hw, 0, hd), rotationY: Math.PI / 2 };
  }
}

function useTexture(url?: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let cancelled = false;
    loadImage(url).then((img) => {
      if (cancelled) return;
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; // true-to-photo colour: decode sRGB → linear for lighting
      t.anisotropy = 8;
      t.needsUpdate = true;
      setTex(t);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return tex;
}

/** Composites all projections for a wall into a single wall texture (rectified on the fly when missing). */
function useWallTexture(room: RoomSpec, wall: WallId) {
  const projections = room.projections.filter((p) => p.wall === wall);
  const key = projections.map((p) => p.id + p.quad.flat().join(',') + JSON.stringify(p.span)).join('|') + room.width + room.depth + room.height;
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    if (!projections.length) {
      setUrl(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      const L = wallLength(room, wall);
      const pxPerM = 360;
      const W = Math.min(4096, Math.round(L * pxPerM));
      const H = Math.min(2048, Math.round(room.height * pxPerM));
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = room.wallColors[wall];
      ctx.fillRect(0, 0, W, H);
      for (const p of projections) {
        const sw = Math.max(8, Math.round((p.span.u1 - p.span.u0) * W));
        const sh = Math.max(8, Math.round((p.span.v1 - p.span.v0) * H));
        const photo = room.photos.find((ph) => ph.id === p.photoId);
        if (!photo) continue;
        const rect = p.rectified ?? (await rectify(photo.dataUrl, p.quad, Math.min(sw, 2048), Math.min(sh, 1536)));
        const img = await loadImage(rect);
        ctx.drawImage(img, p.span.u0 * W, (1 - p.span.v1) * H, sw, sh);
      }
      if (!cancelled) setUrl(canvas.toDataURL('image/jpeg', 0.9));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, room.wallColors[wall]]);
  return useTexture(url);
}

function Wall({ room, wall, projections, exposure }: { room: RoomSpec; wall: WallId; projections: WallProjection[]; exposure: number }) {
  const L = wallLength(room, wall);
  const H = room.height;
  const windows = room.windows.filter((w) => w.wall === wall && w.kind !== 'skylight');
  const geom = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(L, 0);
    shape.lineTo(L, H);
    shape.lineTo(0, H);
    shape.lineTo(0, 0);
    for (const w of windows) {
      const x0 = Math.max(0.02, w.offset - w.width / 2);
      const x1 = Math.min(L - 0.02, w.offset + w.width / 2);
      const y0 = Math.max(0.0, w.sill);
      const y1 = Math.min(H - 0.02, w.sill + w.height);
      if (x1 - x0 < 0.05 || y1 - y0 < 0.05) continue;
      const hole = new THREE.Path();
      hole.moveTo(x0, y0 === 0 ? 0.001 : y0);
      hole.lineTo(x0, y1);
      hole.lineTo(x1, y1);
      hole.lineTo(x1, y0 === 0 ? 0.001 : y0);
      hole.lineTo(x0, y0 === 0 ? 0.001 : y0);
      shape.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: WALL_T, bevelEnabled: false });
    // ExtrudeGeometry generates UVs in shape units → normalise to 0..1 over the wall
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / L, pos.getY(i) / H);
    uv.needsUpdate = true;
    g.translate(0, 0, -WALL_T); // inner face at z=0, wall thickness goes outward
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, H, JSON.stringify(windows)]);
  const tex = useWallTexture(room, wall);
  const t = wallTransform(room, wall);
  const useTex = room.showPhotoTextures && projections.length > 0 && tex;
  return (
    <group position={t.position} rotation={[0, t.rotationY, 0]}>
      <mesh geometry={geom} castShadow receiveShadow userData={{ selectable: false, surface: 'wall', wall }}>
        <meshStandardMaterial
          key={useTex ? tex.uuid + room.photoBake.toFixed(2) : 'plain'}
          color={useTex ? new THREE.Color(1, 1, 1).multiplyScalar(1 - room.photoBake * 0.95) : room.wallColors[wall]}
          map={useTex ? tex : null}
          roughness={room.wallRoughness}
          metalness={0}
          emissive={useTex && room.photoBake > 0 ? '#ffffff' : '#000000'}
          emissiveMap={useTex && room.photoBake > 0 ? tex : null}
          emissiveIntensity={room.photoBake / Math.max(exposure, 1e-6)}
        />
      </mesh>
      {windows.map((w) => (
        <WindowFrame key={w.id} x={w.offset} y={w.sill + w.height / 2} width={w.width} height={w.height} kind={w.kind} transmission={w.transmission} diffuse={w.diffuse} />
      ))}
    </group>
  );
}

function WindowFrame({ x, y, width, height, kind, transmission, diffuse }: { x: number; y: number; width: number; height: number; kind: string; transmission: number; diffuse: boolean }) {
  const f = 0.045;
  const mat = <meshStandardMaterial color="#f1efea" roughness={0.6} />;
  return (
    <group position={[x, y, -WALL_T / 2]}>
      {/* frame */}
      <mesh position={[0, height / 2 - f / 2, 0]} castShadow>
        <boxGeometry args={[width, f, WALL_T * 0.9]} />
        {mat}
      </mesh>
      <mesh position={[0, -height / 2 + f / 2, 0]} castShadow>
        <boxGeometry args={[width, f, WALL_T * 0.9]} />
        {mat}
      </mesh>
      <mesh position={[-width / 2 + f / 2, 0, 0]} castShadow>
        <boxGeometry args={[f, height, WALL_T * 0.9]} />
        {mat}
      </mesh>
      <mesh position={[width / 2 - f / 2, 0, 0]} castShadow>
        <boxGeometry args={[f, height, WALL_T * 0.9]} />
        {mat}
      </mesh>
      {kind === 'window' && width > 0.9 && (
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[f * 0.7, height, WALL_T * 0.5]} />
          {mat}
        </mesh>
      )}
      {kind === 'window' && height > 1.2 && (
        <mesh position={[0, height * 0.12, 0]} castShadow>
          <boxGeometry args={[width, f * 0.7, WALL_T * 0.5]} />
          {mat}
        </mesh>
      )}
      {/* glazing: does not cast shadows unless it is a covering (sheers, blinds) */}
      {(diffuse || transmission < 0.5) && (
        <mesh position={[0, 0, WALL_T * 0.3]} castShadow={transmission < 0.05}>
          <planeGeometry args={[width - f, height - f]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={transmission < 0.05 ? 0.98 : 0.35} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

const FLOOR_ROUGH: Record<string, number> = { wood: 0.45, concrete: 0.75, carpet: 1, tile: 0.25, painted: 0.6 };

function floorTexture(material: string, color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 512);
  const base = new THREE.Color(color);
  if (material === 'wood') {
    for (let i = 0; i < 8; i++) {
      const shade = base.clone().offsetHSL(0, 0, (Math.sin(i * 12.9898) * 43758.5453) % 0.05);
      ctx.fillStyle = '#' + shade.getHexString();
      ctx.fillRect(0, i * 64, 512, 62);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, i * 64 + 62, 512, 2);
      ctx.fillRect(((i * 197) % 512), i * 64, 2, 64);
      for (let g = 0; g < 30; g++) {
        ctx.fillStyle = `rgba(0,0,0,${0.02 + ((g * 7) % 5) * 0.01})`;
        ctx.fillRect(0, i * 64 + ((g * 13) % 60), 512, 1);
      }
    }
  } else if (material === 'tile') {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 128, 0);
      ctx.lineTo(i * 128, 512);
      ctx.moveTo(0, i * 128);
      ctx.lineTo(512, i * 128);
      ctx.stroke();
    }
  } else if (material === 'concrete' || material === 'carpet') {
    const img = ctx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * (material === 'carpet' ? 18 : 12);
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function Room({ room, exposure }: { room: RoomSpec; exposure: number }) {
  const floorTex = useMemo(() => floorTexture(room.floorMaterial, room.floorColor), [room.floorMaterial, room.floorColor]);
  floorTex.repeat.set(room.width / 1.6, room.depth / 1.6);
  const skylights = room.windows.filter((w) => w.kind === 'skylight');
  const ceilingGeom = useMemo(() => {
    const s = new THREE.Shape();
    const hw = room.width / 2, hd = room.depth / 2;
    s.moveTo(-hw, -hd);
    s.lineTo(hw, -hd);
    s.lineTo(hw, hd);
    s.lineTo(-hw, hd);
    s.lineTo(-hw, -hd);
    for (const w of skylights) {
      // skylight: offset = x from left (wall D side), sill = z from wall A
      const x0 = -hw + w.offset - w.width / 2, x1 = x0 + w.width;
      const z0 = -hd + w.sill, z1 = z0 + w.height;
      const h = new THREE.Path();
      h.moveTo(x0, z0);
      h.lineTo(x0, z1);
      h.lineTo(x1, z1);
      h.lineTo(x1, z0);
      h.lineTo(x0, z0);
      s.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: false });
    g.rotateX(Math.PI / 2); // shape XY → XZ, extrude goes +y
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.width, room.depth, JSON.stringify(skylights)]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ surface: 'floor' }}>
        <planeGeometry args={[room.width, room.depth]} />
        <meshStandardMaterial map={floorTex} roughness={FLOOR_ROUGH[room.floorMaterial] ?? 0.6} />
      </mesh>
      {/* floor slab under the walls so no light leaks at the base */}
      <mesh position={[0, -0.08, 0]} receiveShadow castShadow>
        <boxGeometry args={[room.width + 0.3, 0.15, room.depth + 0.3]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh geometry={ceilingGeom} position={[0, room.height + 0.15, 0]} castShadow receiveShadow userData={{ surface: 'ceiling' }}>
        <meshStandardMaterial color={room.ceilingColor} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {(['A', 'B', 'C', 'D'] as WallId[]).map((w) => (
        <Wall key={w} room={room} wall={w} exposure={exposure} projections={room.projections.filter((p) => p.wall === w)} />
      ))}
      {/* corner posts close wall gaps */}
      {[
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} position={[(sx * (room.width + WALL_T)) / 2, room.height / 2, (sz * (room.depth + WALL_T)) / 2]} castShadow>
          <boxGeometry args={[WALL_T, room.height + 0.15, WALL_T]} />
          <meshStandardMaterial color={room.wallColors.A} />
        </mesh>
      ))}
    </group>
  );
}
