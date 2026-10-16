// Optional AI assist: Claude looks at the listing photos and proposes the room layout —
// which wall each photo shows, wall corner quads, windows, dimensions, colours and furniture.
// Runs in the browser with the user's own Anthropic API key (stored only in this browser).
import Anthropic from '@anthropic-ai/sdk';
import { PROPS } from '../data/props';
import { FIXTURES, isPracticalLike } from '../data/fixtures';
import type { Photo } from '../types';

export interface AiQuad {
  bl: [number, number];
  br: [number, number];
  tr: [number, number];
  tl: [number, number];
}

export interface AiAnalysis {
  room: {
    width_m: number;
    depth_m: number;
    height_m: number;
    floor_material: 'wood' | 'concrete' | 'carpet' | 'tile' | 'painted';
    floor_color: string;
    ceiling_color: string;
    reasoning: string;
  };
  wall_colors: { A: string; B: string; C: string; D: string };
  photos: {
    photo_index: number;
    walls: { wall: 'A' | 'B' | 'C' | 'D'; quad: AiQuad; u0: number; u1: number }[];
  }[];
  windows: {
    wall: 'A' | 'B' | 'C' | 'D';
    offset_m: number;
    sill_m: number;
    width_m: number;
    height_m: number;
    kind: 'window' | 'door' | 'skylight';
    covering: 'none' | 'sheer' | 'blinds' | 'blackout';
  }[];
  furniture: {
    prop_id: string;
    label: string;
    x_m: number;
    z_m: number;
    rotation_deg: number;
    color: string;
  }[];
  house_lights: {
    fixture_id: string;
    label: string;
    x_m: number;
    z_m: number;
  }[];
  orientation_hint: string;
}

const quad = {
  type: 'object',
  additionalProperties: false,
  required: ['bl', 'br', 'tr', 'tl'],
  properties: Object.fromEntries(
    ['bl', 'br', 'tr', 'tl'].map((k) => [k, { type: 'array', items: { type: 'number' } }]),
  ),
};

const wallEnum = { type: 'string', enum: ['A', 'B', 'C', 'D'] };

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['room', 'wall_colors', 'photos', 'windows', 'furniture', 'house_lights', 'orientation_hint'],
  properties: {
    room: {
      type: 'object',
      additionalProperties: false,
      required: ['width_m', 'depth_m', 'height_m', 'floor_material', 'floor_color', 'ceiling_color', 'reasoning'],
      properties: {
        width_m: { type: 'number' },
        depth_m: { type: 'number' },
        height_m: { type: 'number' },
        floor_material: { type: 'string', enum: ['wood', 'concrete', 'carpet', 'tile', 'painted'] },
        floor_color: { type: 'string' },
        ceiling_color: { type: 'string' },
        reasoning: { type: 'string' },
      },
    },
    wall_colors: {
      type: 'object',
      additionalProperties: false,
      required: ['A', 'B', 'C', 'D'],
      properties: { A: { type: 'string' }, B: { type: 'string' }, C: { type: 'string' }, D: { type: 'string' } },
    },
    photos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['photo_index', 'walls'],
        properties: {
          photo_index: { type: 'integer' },
          walls: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['wall', 'quad', 'u0', 'u1'],
              properties: { wall: wallEnum, quad, u0: { type: 'number' }, u1: { type: 'number' } },
            },
          },
        },
      },
    },
    windows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['wall', 'offset_m', 'sill_m', 'width_m', 'height_m', 'kind', 'covering'],
        properties: {
          wall: wallEnum,
          offset_m: { type: 'number' },
          sill_m: { type: 'number' },
          width_m: { type: 'number' },
          height_m: { type: 'number' },
          kind: { type: 'string', enum: ['window', 'door', 'skylight'] },
          covering: { type: 'string', enum: ['none', 'sheer', 'blinds', 'blackout'] },
        },
      },
    },
    furniture: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['prop_id', 'label', 'x_m', 'z_m', 'rotation_deg', 'color'],
        properties: {
          prop_id: { type: 'string', enum: PROPS.map((p) => p.id) },
          label: { type: 'string' },
          x_m: { type: 'number' },
          z_m: { type: 'number' },
          rotation_deg: { type: 'number' },
          color: { type: 'string' },
        },
      },
    },
    house_lights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fixture_id', 'label', 'x_m', 'z_m'],
        properties: {
          fixture_id: { type: 'string', enum: FIXTURES.filter(isPracticalLike).map((f) => f.id) },
          label: { type: 'string' },
          x_m: { type: 'number' },
          z_m: { type: 'number' },
        },
      },
    },
    orientation_hint: { type: 'string' },
  },
};

const SYSTEM = `You are a location scout and set designer reconstructing a single interior room from listing photos (e.g. a Peerspace/Airbnb listing) for a cinematography lighting previsualization tool.

Coordinate conventions you must follow:
- The room is a rectangle. Floor at y=0. Walls are named A, B, C, D clockwise when seen from above.
- Wall A is the wall containing the most prominent window (the main daylight source). If no window is visible, wall A is the wall most squarely faced in photo 1.
- Standing inside facing wall A, wall B is to your right, wall C behind you, wall D to your left.
- Room width = length of walls A and C (x axis). Room depth = length of walls B and D (z axis).
- Room-space position: x from -width/2 (wall D) to +width/2 (wall B); z from -depth/2 (wall A) to +depth/2 (wall C).
- For every wall visible in a photo, give the four corners of the visible wall area in that photo as normalized image coordinates [x, y] with (0,0) at the image's top-left and (1,1) at bottom-right: bl = where the wall meets the floor on the left, br = floor on the right, tr = ceiling on the right, tl = ceiling on the left. Corners may lie outside 0..1 when the wall extends past the frame. u0/u1 give which fraction of that wall's length (0 = left end when facing the wall from inside, 1 = right end) the visible area covers.
- Window offset_m is the distance from the wall's left end (facing the wall from inside) to the window centre.

Use the window(s) as the shared reference between photos to work out how the photos relate to each other and which wall each one shows. Use standard object sizes (doors ≈ 2.03 m tall, 0.8-0.9 m wide; outlets ≈ 0.3 m above floor; kitchen counters 0.9 m; typical ceilings 2.4-3 m) to estimate scale. Colours must be sRGB hex values sampled as faithfully as possible from the photos, neutralising obvious white-balance casts only for wall paint. Only list furniture you can actually see, mapped to the closest prop_id. In house_lights, list every installed or practical light fixture you can see (recessed cans, track heads, troffers, pendants, sconces, lamps, fluorescent fixtures) with its room-space floor position, choosing the fixture_id whose type and colour temperature best match how it looks in the photo (warm/amber ≈ 2700K, neutral ≈ 3500-4000K, bluish ≈ 5000K, greenish office light = fluorescent). In orientation_hint, mention any evidence of which compass direction the windows face (sun patches, shadows, views).`;

async function toBase64Jpeg(dataUrl: string, max = 1568): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88).split(',')[1];
}

export async function analyzePhotos(
  apiKey: string,
  photos: Photo[],
  known: { width?: number; depth?: number; height?: number; sqft?: number; notes?: string },
): Promise<AiAnalysis> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (let i = 0; i < photos.length; i++) {
    content.push({ type: 'text', text: `Photo ${i}${photos[i].name ? ` (${photos[i].name})` : ''}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toBase64Jpeg(photos[i].dataUrl) } });
  }
  const facts: string[] = [];
  if (known.width) facts.push(`width ${known.width} m`);
  if (known.depth) facts.push(`depth ${known.depth} m`);
  if (known.height) facts.push(`ceiling height ${known.height} m`);
  if (known.sqft) facts.push(`floor area ${known.sqft} sq ft (${(known.sqft * 0.092903).toFixed(1)} m²)`);
  if (known.notes) facts.push(`listing notes: ${known.notes}`);
  content.push({
    type: 'text',
    text: `Reconstruct this room. Known facts from the listing (treat as ground truth when given): ${facts.join('; ') || 'none'}. Return the JSON described by the schema.`,
  });

  const stream = client.beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('The model declined to analyze these photos.');
  if (msg.stop_reason === 'max_tokens') throw new Error('The analysis was cut off; try fewer photos.');
  const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return JSON.parse(text) as AiAnalysis;
}
