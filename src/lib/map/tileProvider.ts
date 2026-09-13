// ============================================================
// Suraksha Setu — Vector Tile Infrastructure & Provider Registry
// Decoupled map engine configuration supporting OpenFreeMap
// and swappable self-hosted / production vector tile providers
// ============================================================

export interface TileStyleConfig {
  id: string;
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style: string | any;
  type: 'vector' | 'raster';
  attribution: string;
  terrainSupport: boolean;
}

// Official CARTO Basemap API Key provided for Suraksha Setu
export const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY || 'cb1_3jgq_1_bb83cb048f426bbfccbdd43b';

export const CARTO_POSITRON_STYLE = {
  version: 8,
  sources: {
    'carto-positron': {
      type: 'raster',
      tiles: [
        `https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
        `https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
        `https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
        `https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
      ],
      tileSize: 256,
      attribution: '© CARTO © OpenStreetMap contributors (Official Editorial Positron)',
    },
  },
  layers: [
    {
      id: 'carto-positron-layer',
      type: 'raster',
      source: 'carto-positron',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

export const CARTO_VOYAGER_STYLE = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
        `https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
        `https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
        `https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
      ],
      tileSize: 256,
      attribution: '© CARTO © OpenStreetMap contributors (Official Voyager)',
    },
  },
  layers: [
    {
      id: 'carto-voyager-layer',
      type: 'raster',
      source: 'carto-voyager',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

export const CARTO_DARK_MATTER_STYLE = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
        `https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
        `https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
        `https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
      ],
      tileSize: 256,
      attribution: '© CARTO © OpenStreetMap contributors (Official Dark Matter)',
    },
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

export const OSM_STANDARD_STYLE = {
  version: 8,
  sources: {
    'osm-standard': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-standard-layer',
      type: 'raster',
      source: 'osm-standard',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export const TILE_STYLES: Record<string, TileStyleConfig> = {
  osm: {
    id: 'osm',
    name: 'OpenStreetMap (Topographic Standard — Default)',
    description: 'Global crowdsourced street & terrain topography (Zero API key required)',
    style: OSM_STANDARD_STYLE,
    type: 'raster',
    attribution: '© OpenStreetMap contributors',
    terrainSupport: false,
  },
  positron: {
    id: 'positron',
    name: 'CARTO Positron (Editorial Light)',
    description: 'Official CARTO Positron with authenticated API key — soft off-white terrain, charcoal labels',
    style: CARTO_POSITRON_STYLE,
    type: 'raster',
    attribution: '© CARTO © OpenStreetMap contributors (Official Editorial Positron)',
    terrainSupport: true,
  },
  voyager: {
    id: 'voyager',
    name: 'CARTO Voyager (Hydrological)',
    description: 'Official CARTO Voyager with authenticated API key — river corridors & contours',
    style: CARTO_VOYAGER_STYLE,
    type: 'raster',
    attribution: '© CARTO © OpenStreetMap contributors (Official Voyager)',
    terrainSupport: true,
  },
  dark: {
    id: 'dark',
    name: 'CARTO Dark Matter (Night Operations)',
    description: 'Official CARTO Dark Matter with authenticated API key — high contrast incident command view',
    style: CARTO_DARK_MATTER_STYLE,
    type: 'raster',
    attribution: '© CARTO © OpenStreetMap contributors (Official Dark Matter)',
    terrainSupport: true,
  },
  carto_vector: {
    id: 'carto_vector',
    name: 'CARTO Positron (Vector GL)',
    description: 'GPU-accelerated vector rendering via official CARTO vector tiles with API key',
    style: `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json?key=${CARTO_API_KEY}&api_key=${CARTO_API_KEY}`,
    type: 'vector',
    attribution: '© CARTO © OpenStreetMap contributors',
    terrainSupport: true,
  },
  openfreemap_vector: {
    id: 'openfreemap_vector',
    name: 'OpenFreeMap (Vector Planet)',
    description: 'Decentralized open vector tiles via OpenFreeMap planet infrastructure',
    style: 'https://tiles.openfreemap.org/styles/positron',
    type: 'vector',
    attribution: '© OpenFreeMap © OpenStreetMap contributors',
    terrainSupport: true,
  },
  bright: {
    id: 'bright',
    name: 'Regional Contrast (Bright Vector)',
    description: 'High-visibility administrative boundaries and national transit corridors',
    style: 'https://tiles.openfreemap.org/styles/bright',
    type: 'vector',
    attribution: '© OpenFreeMap © OpenStreetMap contributors',
    terrainSupport: true,
  },
  production_custom: {
    id: 'production_custom',
    name: 'Self-Hosted Production Cluster',
    description: 'Dedicated national geospatial tile server for Suraksha Setu operations',
    style: process.env.NEXT_PUBLIC_MAP_TILE_STYLE_URL || OSM_STANDARD_STYLE,
    type: 'raster',
    attribution: 'Suraksha Setu Spatial Command © OpenStreetMap',
    terrainSupport: true,
  },
};

/**
 * Resolves the active tile style (URL or Style Object).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getActiveTileStyle(styleId: string = 'osm'): any {
  if (typeof window !== 'undefined' && (window as unknown as { __SURAKSHA_TILE_STYLE__?: string }).__SURAKSHA_TILE_STYLE__) {
    return (window as unknown as { __SURAKSHA_TILE_STYLE__: string }).__SURAKSHA_TILE_STYLE__;
  }
  if (process.env.NEXT_PUBLIC_MAP_TILE_STYLE_URL && styleId === 'production_custom') {
    return process.env.NEXT_PUBLIC_MAP_TILE_STYLE_URL;
  }
  return TILE_STYLES[styleId]?.style || TILE_STYLES.osm.style;
}

/**
 * Center coordinate for South Asia operational view:
 * Centered on India while covering Nepal, Bhutan, Bangladesh, Sri Lanka, and neighboring waters.
 */
export const SOUTH_ASIA_CENTER = {
  lng: 79.2000,
  lat: 21.8000,
  zoom: 4.8,
  minZoom: 3.0,
  maxZoom: 18,
};
