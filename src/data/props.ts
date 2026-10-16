export interface PropDef {
  id: string;
  name: string;
  category: 'Music' | 'Interview & Podcast' | 'Furniture' | 'Decor' | 'Production';
  color: string;
  /** approx footprint for placement (w, d, h) meters */
  size: [number, number, number];
}

export const PROPS: PropDef[] = [
  // Music lessons
  { id: 'acoustic-guitar', name: 'Acoustic Guitar (on stand)', category: 'Music', color: '#b7804a', size: [0.4, 0.3, 1.05] },
  { id: 'electric-guitar', name: 'Electric Guitar (on stand)', category: 'Music', color: '#a3121e', size: [0.35, 0.3, 1.0] },
  { id: 'bass-guitar', name: 'Bass Guitar (on stand)', category: 'Music', color: '#1d1d1f', size: [0.35, 0.3, 1.15] },
  { id: 'ukulele', name: 'Ukulele', category: 'Music', color: '#c99a5b', size: [0.2, 0.1, 0.55] },
  { id: 'violin', name: 'Violin on Stand', category: 'Music', color: '#8a3d14', size: [0.25, 0.2, 0.7] },
  { id: 'cello', name: 'Cello', category: 'Music', color: '#7a3510', size: [0.45, 0.3, 1.25] },
  { id: 'upright-piano', name: 'Upright Piano', category: 'Music', color: '#141414', size: [1.5, 0.6, 1.25] },
  { id: 'grand-piano', name: 'Baby Grand Piano', category: 'Music', color: '#0d0d0d', size: [1.5, 1.6, 1.0] },
  { id: 'keyboard-stand', name: '88-key Keyboard on Stand', category: 'Music', color: '#222222', size: [1.35, 0.35, 0.95] },
  { id: 'drum-kit', name: 'Drum Kit (5-piece)', category: 'Music', color: '#b01e2f', size: [1.8, 1.5, 1.4] },
  { id: 'snare', name: 'Snare on Stand', category: 'Music', color: '#d9d9d9', size: [0.4, 0.4, 0.65] },
  { id: 'cajon', name: 'Cajón', category: 'Music', color: '#c49a63', size: [0.3, 0.3, 0.48] },
  { id: 'guitar-amp', name: 'Guitar Combo Amp', category: 'Music', color: '#262626', size: [0.6, 0.27, 0.5] },
  { id: 'music-stand', name: 'Music Stand', category: 'Music', color: '#111111', size: [0.5, 0.4, 1.3] },
  { id: 'studio-monitors', name: 'Studio Monitors (pair)', category: 'Music', color: '#1a1a1a', size: [1.0, 0.3, 0.35] },
  { id: 'saxophone', name: 'Saxophone on Stand', category: 'Music', color: '#d4a63a', size: [0.3, 0.3, 0.8] },
  { id: 'guitar-wall-hangers', name: 'Wall-hung Guitars (3)', category: 'Music', color: '#9b6a3c', size: [1.4, 0.15, 1.0] },

  // Interview & podcast
  { id: 'podcast-mic-arm', name: 'Broadcast Mic on Desk Arm', category: 'Interview & Podcast', color: '#1b1b1b', size: [0.3, 0.6, 0.5] },
  { id: 'mic-boom-stand', name: 'Mic on Boom Stand', category: 'Interview & Podcast', color: '#151515', size: [0.6, 0.6, 1.6] },
  { id: 'boom-pole-overhead', name: 'Overhead Boom Mic', category: 'Interview & Podcast', color: '#2b2b2b', size: [0.2, 2.0, 2.2] },
  { id: 'laptop', name: 'Laptop', category: 'Interview & Podcast', color: '#bfc2c6', size: [0.32, 0.22, 0.22] },
  { id: 'mug', name: 'Coffee Mug', category: 'Interview & Podcast', color: '#e8e2d6', size: [0.09, 0.09, 0.1] },
  { id: 'books-stack', name: 'Stack of Books', category: 'Interview & Podcast', color: '#45607a', size: [0.25, 0.18, 0.15] },
  { id: 'headphones', name: 'Headphones', category: 'Interview & Podcast', color: '#202020', size: [0.18, 0.08, 0.2] },
  { id: 'acoustic-panel', name: 'Acoustic Panel 2×4', category: 'Interview & Podcast', color: '#3f4752', size: [0.6, 0.05, 1.2] },
  { id: 'neon-sign', name: 'Neon Sign "ON AIR"', category: 'Interview & Podcast', color: '#ff3366', size: [0.6, 0.03, 0.2] },

  // Furniture
  { id: 'armchair', name: 'Armchair', category: 'Furniture', color: '#7b6a58', size: [0.85, 0.85, 0.9] },
  { id: 'sofa', name: 'Sofa (3-seat)', category: 'Furniture', color: '#5d6d7e', size: [2.1, 0.9, 0.85] },
  { id: 'dining-chair', name: 'Chair', category: 'Furniture', color: '#6b4f36', size: [0.45, 0.5, 0.9] },
  { id: 'stool', name: 'Bar / Guitar Stool', category: 'Furniture', color: '#3a2c20', size: [0.38, 0.38, 0.75] },
  { id: 'piano-bench', name: 'Piano Bench', category: 'Furniture', color: '#121212', size: [0.75, 0.35, 0.5] },
  { id: 'desk', name: 'Desk', category: 'Furniture', color: '#8b6b4a', size: [1.4, 0.7, 0.75] },
  { id: 'coffee-table', name: 'Coffee Table', category: 'Furniture', color: '#6e5038', size: [1.1, 0.6, 0.42] },
  { id: 'side-table', name: 'Side Table', category: 'Furniture', color: '#7a5b40', size: [0.45, 0.45, 0.55] },
  { id: 'bookshelf', name: 'Bookshelf', category: 'Furniture', color: '#5b4330', size: [0.9, 0.35, 1.9] },
  { id: 'credenza', name: 'Credenza / Sideboard', category: 'Furniture', color: '#6a4a33', size: [1.6, 0.45, 0.75] },
  { id: 'rug', name: 'Rug 2×3 m', category: 'Furniture', color: '#9a7d63', size: [3, 2, 0.01] },
  { id: 'bed', name: 'Bed (Queen)', category: 'Furniture', color: '#d9d4cc', size: [1.6, 2.1, 0.6] },

  // Decor
  { id: 'plant-tall', name: 'Fiddle-leaf Fig (tall plant)', category: 'Decor', color: '#2f6b33', size: [0.6, 0.6, 1.8] },
  { id: 'plant-small', name: 'Small Potted Plant', category: 'Decor', color: '#3b7a3f', size: [0.25, 0.25, 0.4] },
  { id: 'vase', name: 'Vase with Branches', category: 'Decor', color: '#c7b8a3', size: [0.2, 0.2, 0.8] },
  { id: 'wall-art', name: 'Framed Wall Art', category: 'Decor', color: '#c46a45', size: [0.8, 0.04, 1.0] },
  { id: 'floor-lamp-prop', name: 'Floor Lamp (off)', category: 'Decor', color: '#e9e2d0', size: [0.4, 0.4, 1.6] },
  { id: 'curtain', name: 'Curtain Panel', category: 'Decor', color: '#e6dccb', size: [1.2, 0.05, 2.4] },
  { id: 'mirror', name: 'Floor Mirror', category: 'Decor', color: '#b8c4cc', size: [0.6, 0.05, 1.7] },

  // Production
  { id: 'apple-box-full', name: 'Apple Box (full)', category: 'Production', color: '#c8a26b', size: [0.51, 0.3, 0.2] },
  { id: 'sandbag', name: 'Sandbag', category: 'Production', color: '#4b5a3a', size: [0.4, 0.2, 0.12] },
  { id: 'camera-tripod-prop', name: 'Camera on Tripod (prop)', category: 'Production', color: '#202020', size: [0.6, 0.6, 1.5] },
  { id: 'teleprompter', name: 'Teleprompter', category: 'Production', color: '#1c1c1c', size: [0.5, 0.6, 1.5] },
  { id: 'backdrop-paper', name: 'Seamless Backdrop 2.7 m', category: 'Production', color: '#8d8d8d', size: [2.72, 1.5, 2.6] },
  { id: 'gray-card', name: '18% Gray Card on Stand', category: 'Production', color: '#777777', size: [0.2, 0.02, 1.4] },
  { id: 'color-checker', name: 'Color Checker on Stand', category: 'Production', color: '#333333', size: [0.28, 0.02, 1.4] },
];

export const PROP_MAP = new Map(PROPS.map((p) => [p.id, p]));
