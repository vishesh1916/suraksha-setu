// ============================================================
// Suraksha Setu — Common Normalized Hazard Event Schema
// Unified cross-agency data standard for India & South Asia
// ============================================================

export type HazardAcronym =
  | 'EQ' // Earthquake
  | 'FL' // Flood
  | 'RF' // Heavy Rainfall
  | 'CW' // Cyclone Warning
  | 'FR' // Fire Hotspot
  | 'LS' // Landslide
  | 'TC' // Tropical Cyclone
  | 'ST' // Severe Thunderstorm
  | 'HW' // Heatwave
  | 'CV' // Cold Wave
  | 'DR' // Drought
  | 'TS' // Tsunami
  | 'AV' // Avalanche
  | 'AQ' // Air Quality alert
  | 'SH' // Relief Shelter Camp
  | 'CR'; // Citizen Ground Report

export type HazardSeverity = 'ADVISORY' | 'WATCH' | 'WARNING' | 'SEVERE';

export interface HazardAcronymMeta {
  acronym: HazardAcronym;
  name: string;
  categoryGroup: 'EARTH' | 'WEATHER_FLOOD' | 'FIRE_HEAT' | 'ATMOSPHERE' | 'SPECIAL';
  primarySource: string;
  description: string;
}

export const HAZARD_ACRONYM_META: Record<HazardAcronym, HazardAcronymMeta> = {
  EQ: {
    acronym: 'EQ',
    name: 'Earthquake',
    categoryGroup: 'EARTH',
    primarySource: 'USGS / NCS (National Center for Seismology)',
    description: 'Tectonic rupture, focal depth, ground motion, and felt reports',
  },
  FL: {
    acronym: 'FL',
    name: 'Riverine & Urban Flood',
    categoryGroup: 'WEATHER_FLOOD',
    primarySource: 'CWC / NDMA / State SDMA',
    description: 'River stage exceedance, embankment breaches, and urban basin inundation',
  },
  RF: {
    acronym: 'RF',
    name: 'Heavy Rainfall Warning',
    categoryGroup: 'WEATHER_FLOOD',
    primarySource: 'IMD Nowcast & District Bulletins',
    description: 'Localized precipitation rates exceeding 65 mm/hr or red alert thresholds',
  },
  CW: {
    acronym: 'CW',
    name: 'Cyclone Warning',
    categoryGroup: 'WEATHER_FLOOD',
    primarySource: 'IMD RSMC / INCOIS',
    description: 'Depression/deep depression tracking and gale force wind forecasts',
  },
  FR: {
    acronym: 'FR',
    name: 'Thermal Fire Hotspot',
    categoryGroup: 'FIRE_HEAT',
    primarySource: 'NASA FIRMS (VIIRS / MODIS)',
    description: 'Active satellite thermal anomalies and forest/agricultural fire detections',
  },
  LS: {
    acronym: 'LS',
    name: 'Landslide & Debris Flow',
    categoryGroup: 'EARTH',
    primarySource: 'GSI (Geological Survey of India) / NDMA',
    description: 'Slope failures, mudslides, and highway blockage along mountain corridors',
  },
  TC: {
    acronym: 'TC',
    name: 'Tropical Cyclone',
    categoryGroup: 'WEATHER_FLOOD',
    primarySource: 'IMD / GDACS / JTWC',
    description: 'Named tropical cyclone systems with storm surge and landfall vectors',
  },
  ST: {
    acronym: 'ST',
    name: 'Severe Thunderstorm',
    categoryGroup: 'WEATHER_FLOOD',
    primarySource: 'IMD Doppler Radar Network',
    description: 'Squall lines, severe lightning discharge, and damaging wind gusts',
  },
  HW: {
    acronym: 'HW',
    name: 'Severe Heatwave',
    categoryGroup: 'FIRE_HEAT',
    primarySource: 'IMD Heat Health Sentinel',
    description: 'Temperatures 4.5°C+ above normal with severe physiological heat stress',
  },
  CV: {
    acronym: 'CV',
    name: 'Severe Cold Wave',
    categoryGroup: 'WEATHER_FLOOD',
    primarySource: 'IMD Northern Plains Grid',
    description: 'Dense fog and sub-normal temperatures across northern river plains',
  },
  DR: {
    acronym: 'DR',
    name: 'Agricultural Drought',
    categoryGroup: 'WEATHER_FLOOD',
    primarySource: 'MNDFC / GDACS',
    description: 'Persistent soil moisture deficit and dry spell declarations',
  },
  TS: {
    acronym: 'TS',
    name: 'Tsunami Watch',
    categoryGroup: 'EARTH',
    primarySource: 'INCOIS (Indian National Centre for Ocean Information Services)',
    description: 'Undersea megathrust seismic disturbances and ocean buoy anomalies',
  },
  AV: {
    acronym: 'AV',
    name: 'Snow Avalanche Alert',
    categoryGroup: 'EARTH',
    primarySource: 'DGRE (Defence Geoinformatics Research Establishment)',
    description: 'High-altitude snowpack slippage along Himalayan passes and transit corridors',
  },
  AQ: {
    acronym: 'AQ',
    name: 'Air Quality Emergency',
    categoryGroup: 'ATMOSPHERE',
    primarySource: 'CPCB / SAFAR / OpenAQ',
    description: 'Severe PM2.5 / PM10 particulate exceedances and health advisories',
  },
  SH: {
    acronym: 'SH',
    name: 'Relief Shelter Camp',
    categoryGroup: 'SPECIAL',
    primarySource: 'NDRF / District Administration / SDMA',
    description: 'Evacuation centers, humanitarian transit shelters, and camp logistics',
  },
  CR: {
    acronym: 'CR',
    name: 'Citizen Ground Report',
    categoryGroup: 'SPECIAL',
    primarySource: 'Suraksha Setu Public Citizen Ground Observations',
    description: 'Crowdsourced citizen field observations and hyper-local flood observations',
  },
};

/**
 * Common normalized schema for every hazard event across all official and community feeds.
 */
export interface UnifiedHazardEvent {
  id: string;
  source: string; // e.g. 'USGS', 'NDMA SACHET', 'IMD', 'NASA FIRMS', 'GDACS', 'CPCB', 'COMMUNITY'
  source_url: string;
  hazard_type: string;
  acronym: HazardAcronym;
  title: string;
  severity: HazardSeverity;
  status: 'ACTIVE' | 'RESOLVED' | 'EXPIRED';
  geometry: {
    type: 'Point' | 'Polygon' | 'MultiPolygon';
    // [lng, lat] for Point, or [[[lng, lat], ...]] for Polygon
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coordinates: any;
  };
  country: string; // 'India', 'Nepal', 'Bhutan', 'Bangladesh', 'Sri Lanka', 'South Asia'
  state?: string;
  district?: string;
  issued_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  expires_at?: string; // ISO 8601
  freshness: string; // e.g. "Live (2m ago)", "Calibrated (12m ago)"
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERIFIED';
  is_official: boolean;
  is_community_report: boolean;
  details?: {
    magnitude?: number;
    depthKm?: number;
    nearestLocality?: string;
    feltReportsCount?: number;
    feltUrl?: string;
    satellite?: string;
    confidencePct?: number;
    brightnessTempK?: number;
    affectedDistricts?: string[];
    safetyGuidance?: string;
    riverBasin?: string;
    waterDepthFeet?: number;
    rainfallRateMmH?: number;
    windSpeedKmh?: number;
    pm25?: number;
    aqi?: number;
    moderationStatus?: 'Received' | 'Under review' | 'Verified' | 'Dismissed' | 'Resolved';
    actionCategory?: string;
    tacticalAction?: string;
    mediaUrl?: string;
    reportCount?: number;
    shelterProvisions?: string;
    contact?: string;
  };
}

export type SourceFeedStatus = 'HEALTHY' | 'DEGRADED' | 'NO_VERIFIED_FEED';

export interface ProviderHealth {
  id: string;
  name: string;
  agency: string;
  coverage: string;
  status: SourceFeedStatus;
  statusMessage: string;
  lastSuccessAt: string;
  freshness: string;
  eventCount: number;
  officialFeedUrl: string;
}
