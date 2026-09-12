// ============================================================
// Suraksha Setu — Editorial Weather Atmosphere Engine
// Classifies meteorological data into purposeful visual atmospheres
// ============================================================

export type WeatherAtmosphereType =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'thunderstorm'
  | 'fog'
  | 'heatwave';

export interface WeatherAtmosphereConfig {
  type: WeatherAtmosphereType;
  label: string;
  sublabel: string;
  badge: string;
  skyGradient: string;
  ambientLight: string;
  hazeColor: string;
  hazeOpacity: number;
  textColor: string;
  subtextColor: string;
  accentColor: string;
  radarBeamColor: string;
  radarRingColor: string;
  cloudOpacity: number;
  rainDensity: number;
  windDrift: number;
  shimmerIntensity: number;
  lightningFrequency: number;
}

export const LUCKNOW_COORDINATES = {
  lat: 26.8467,
  lng: 80.9462,
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  region: 'Awadh Plain Basin',
};

export const ATMOSPHERE_CONFIGS: Record<WeatherAtmosphereType, WeatherAtmosphereConfig> = {
  clear: {
    type: 'clear',
    label: 'Warm Soft Daylight',
    sublabel: 'Gentle sunlight reflections · subtle moving haze · pale sky tones',
    badge: '☀️ Clear Sky',
    skyGradient: 'linear-gradient(180deg, #0d2238 0%, #0e2942 35%, #133352 70%, #091726 100%)',
    ambientLight: 'rgba(254, 243, 199, 0.08)',
    hazeColor: 'rgba(251, 191, 36, 0.05)',
    hazeOpacity: 0.15,
    textColor: '#F8FAFC',
    subtextColor: '#94A3B8',
    accentColor: '#F59E0B',
    radarBeamColor: 'rgba(245, 158, 11, 0.75)',
    radarRingColor: 'rgba(245, 158, 11, 0.15)',
    cloudOpacity: 0.12,
    rainDensity: 0,
    windDrift: 0.3,
    shimmerIntensity: 0.1,
    lightningFrequency: 0,
  },
  cloudy: {
    type: 'cloudy',
    label: 'Layered Drifting Clouds',
    sublabel: 'Soft gray-green light · slow atmospheric movement · veiled horizon',
    badge: '☁️ Overcast',
    skyGradient: 'linear-gradient(180deg, #091a2b 0%, #0d2236 40%, #122c42 75%, #081522 100%)',
    ambientLight: 'rgba(148, 163, 184, 0.07)',
    hazeColor: 'rgba(148, 163, 184, 0.08)',
    hazeOpacity: 0.3,
    textColor: '#F1F5F9',
    subtextColor: '#94A3B8',
    accentColor: '#38BDF8',
    radarBeamColor: 'rgba(56, 189, 248, 0.7)',
    radarRingColor: 'rgba(56, 189, 248, 0.14)',
    cloudOpacity: 0.45,
    rainDensity: 0,
    windDrift: 0.5,
    shimmerIntensity: 0,
    lightningFrequency: 0,
  },
  rain: {
    type: 'rain',
    label: 'Refined Monsoon Rain',
    sublabel: 'Animated rain streaks · wet-glass reflections · water ripple echoes',
    badge: '🌧️ Monsoon Rain',
    skyGradient: 'linear-gradient(180deg, #061524 0%, #0a1e33 45%, #0f2740 80%, #050f1a 100%)',
    ambientLight: 'rgba(56, 189, 248, 0.09)',
    hazeColor: 'rgba(56, 189, 248, 0.12)',
    hazeOpacity: 0.4,
    textColor: '#F8FAFC',
    subtextColor: '#8A99A8',
    accentColor: '#38BDF8',
    radarBeamColor: 'rgba(56, 189, 248, 0.85)',
    radarRingColor: 'rgba(56, 189, 248, 0.22)',
    cloudOpacity: 0.55,
    rainDensity: 75,
    windDrift: 1.2,
    shimmerIntensity: 0,
    lightningFrequency: 0,
  },
  thunderstorm: {
    type: 'thunderstorm',
    label: 'Distant Thunderstorm',
    sublabel: 'Muted distant flashes · deep contrast · slow-moving storm clouds',
    badge: '⛈️ Thunderstorm Alert',
    skyGradient: 'linear-gradient(180deg, #040d17 0%, #071524 45%, #0b1e33 80%, #03080f 100%)',
    ambientLight: 'rgba(125, 211, 252, 0.14)',
    hazeColor: 'rgba(239, 68, 68, 0.08)',
    hazeOpacity: 0.5,
    textColor: '#F8FAFC',
    subtextColor: '#94A3B8',
    accentColor: '#EF4444',
    radarBeamColor: 'rgba(239, 68, 68, 0.85)',
    radarRingColor: 'rgba(239, 68, 68, 0.22)',
    cloudOpacity: 0.7,
    rainDensity: 95,
    windDrift: 1.8,
    shimmerIntensity: 0,
    lightningFrequency: 0.007,
  },
  fog: {
    type: 'fog',
    label: 'Winter Morning Mist',
    sublabel: 'Low-opacity drifting mist · softened city silhouettes · quiet muted tones',
    badge: '🌫️ Dense Mist / Fog',
    skyGradient: 'linear-gradient(180deg, #0b1a26 0%, #102434 45%, #152d3f 80%, #0a1721 100%)',
    ambientLight: 'rgba(226, 232, 240, 0.08)',
    hazeColor: 'rgba(203, 213, 225, 0.22)',
    hazeOpacity: 0.65,
    textColor: '#E2E8F0',
    subtextColor: '#94A3B8',
    accentColor: '#A5B4FC',
    radarBeamColor: 'rgba(165, 180, 252, 0.65)',
    radarRingColor: 'rgba(165, 180, 252, 0.14)',
    cloudOpacity: 0.6,
    rainDensity: 0,
    windDrift: 0.25,
    shimmerIntensity: 0,
    lightningFrequency: 0,
  },
  heatwave: {
    type: 'heatwave',
    label: 'Warm Atmospheric Shimmer',
    sublabel: 'Dry atmospheric haze · restrained sun warmth · delicate mirage shimmer',
    badge: '🔥 Heatwave Watch',
    skyGradient: 'linear-gradient(180deg, #18191c 0%, #211e1f 40%, #29221e 75%, #111214 100%)',
    ambientLight: 'rgba(245, 158, 11, 0.09)',
    hazeColor: 'rgba(217, 119, 6, 0.12)',
    hazeOpacity: 0.35,
    textColor: '#FDF8F0',
    subtextColor: '#A8998A',
    accentColor: '#F59E0B',
    radarBeamColor: 'rgba(245, 158, 11, 0.85)',
    radarRingColor: 'rgba(245, 158, 11, 0.2)',
    cloudOpacity: 0.08,
    rainDensity: 0,
    windDrift: 0.4,
    shimmerIntensity: 0.35,
    lightningFrequency: 0,
  },
};

export function classifyWeatherAtmosphere(weather: {
  temperature?: number;
  precipitation?: number;
  rain?: number;
  weatherCode?: number;
  cloudCover?: number;
  windSpeed?: number;
  relativeHumidity?: number;
}): WeatherAtmosphereType {
  const code = weather.weatherCode ?? 0;
  const temp = weather.temperature ?? 26;
  const rain = (weather.precipitation ?? 0) + (weather.rain ?? 0);
  const cloud = weather.cloudCover ?? 20;
  const humidity = weather.relativeHumidity ?? 60;

  // 1. Thunderstorm: WMO 95-99, or heavy rain with high winds
  if (code >= 95 || (code >= 90 && code < 95) || (rain > 12 && (weather.windSpeed ?? 0) > 35)) {
    return 'thunderstorm';
  }

  // 2. Rain / Inundation: WMO 51-86, or measurable precipitation
  if ((code >= 51 && code <= 86) || rain > 0.4) {
    return 'rain';
  }

  // 3. Fog / Winter Mist: WMO 45-48, or very high humidity with low cloud ceiling
  if (code === 45 || code === 48 || (humidity > 90 && temp < 22)) {
    return 'fog';
  }

  // 4. Heatwave: temperature >= 38°C, or dry hot afternoon >= 34°C with low humidity
  if (temp >= 38 || (temp >= 34 && humidity < 35 && rain === 0)) {
    return 'heatwave';
  }

  // 5. Cloudy: WMO 2-3, or significant cloud cover
  if (code === 2 || code === 3 || cloud >= 45) {
    return 'cloudy';
  }

  // 6. Clear: Default daytime sun & light sky
  return 'clear';
}

export function formatWeatherConditionLabel(weather: {
  temperature?: number;
  weatherCondition?: string;
  precipitation?: number;
  updatedAt?: string;
}): string {
  const temp = weather.temperature !== undefined ? `${Math.round(weather.temperature)}°C` : '28°C';
  const cond = weather.weatherCondition || 'Partly Cloudy';
  return `Lucknow · ${cond} (${temp}) · Doppler Radar Active`;
}
