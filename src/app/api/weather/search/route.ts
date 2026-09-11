// ============================================================
// Suraksha Setu — Pan-India Location Search & Weather Intelligence API
// Open-Meteo Geocoding + Deep Forecast for Any Part of India (0 API Keys)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  admin1?: string; // State
  admin2?: string; // District
  country: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    let targetLat: number;
    let targetLng: number;
    let targetName = 'Selected Location';
    let targetState = 'India';

    if (latParam && lngParam) {
      targetLat = parseFloat(latParam);
      targetLng = parseFloat(lngParam);
      targetName = searchParams.get('name') || `${targetLat.toFixed(2)}°N, ${targetLng.toFixed(2)}°E`;
      targetState = searchParams.get('state') || 'India';
    } else if (query) {
      // 1. Geocode location inside India
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=5&language=en&format=json&country_code=IN`;

      const geoRes = await fetch(geoUrl, { next: { revalidate: 3600 } });
      if (!geoRes.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const geoData = await geoRes.json();
      const results: GeocodingResult[] = geoData.results || [];

      if (results.length === 0) {
        return NextResponse.json({
          success: false,
          error: `No Indian locations found matching "${query}". Try searching a district or major town.`,
        });
      }

      const best = results[0];
      targetLat = best.latitude;
      targetLng = best.longitude;
      targetName = best.name;
      targetState = best.admin1 || 'India';
    } else {
      // Default: National Capital (Delhi NCR)
      targetLat = 28.6139;
      targetLng = 77.2090;
      targetName = 'Delhi NCR';
      targetState = 'Delhi';
    }

    // 2. Query Deep Meteorological Telemetry for Coordinates
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_gusts_10m,uv_index&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=7`;

    const weatherRes = await fetch(weatherUrl, { next: { revalidate: 300 } });
    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo returned status ${weatherRes.status}`);
    }

    const weatherData = await weatherRes.json();
    const current = weatherData.current || {};
    const hourly = weatherData.hourly || {};
    const daily = weatherData.daily || {};

    // Interpret WMO condition and compute severe threat
    const wmoCode = current.weather_code ?? 0;
    const precip = current.precipitation ?? 0;
    const windSpeed = current.wind_speed_10m ?? 0;
    const windGusts = current.wind_gusts_10m ?? 0;

    let threatLevel: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL' = 'NORMAL';
    let threatDescription = 'Atmospheric conditions stable. Normal municipal activity permitted.';

    if (wmoCode >= 95 || precip > 25 || windGusts > 55) {
      threatLevel = 'CRITICAL';
      threatDescription = 'Severe convective cell / torrential downpour active. Life safety risk.';
    } else if (wmoCode >= 80 || precip > 12 || windSpeed > 35) {
      threatLevel = 'WARNING';
      threatDescription = 'Heavy continuous rainfall & squall conditions. Waterlogging likely.';
    } else if (wmoCode >= 61 || precip > 4 || windSpeed > 22) {
      threatLevel = 'WATCH';
      threatDescription = 'Moderate precipitation watch active. Monitor underpasses and low ground.';
    }

    // Build 24-hour hourly trend slice
    const next24Hours = (hourly.time || []).slice(0, 24).map((t: string, idx: number) => ({
      time: t,
      hour: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp: hourly.temperature_2m?.[idx] ?? 28,
      precip: hourly.precipitation?.[idx] ?? 0,
      precipProb: hourly.precipitation_probability?.[idx] ?? 0,
      windSpeed: hourly.wind_speed_10m?.[idx] ?? 0,
    }));

    // Build 7-day outlook slice
    const next7Days = (daily.time || []).slice(0, 7).map((d: string, idx: number) => ({
      date: d,
      dayName: new Date(d).toLocaleDateString([], { weekday: 'short' }),
      tempMax: daily.temperature_2m_max?.[idx] ?? 32,
      tempMin: daily.temperature_2m_min?.[idx] ?? 24,
      precipSum: daily.precipitation_sum?.[idx] ?? 0,
      precipProbMax: daily.precipitation_probability_max?.[idx] ?? 0,
      weatherCode: daily.weather_code?.[idx] ?? 0,
    }));

    return NextResponse.json({
      success: true,
      location: {
        name: targetName,
        state: targetState,
        latitude: targetLat,
        longitude: targetLng,
      },
      telemetry: {
        temperature: current.temperature_2m ?? 28.5,
        apparentTemperature: current.apparent_temperature ?? 30.2,
        relativeHumidity: current.relative_humidity_2m ?? 76,
        precipitationRate: precip,
        rain: current.rain ?? 0,
        surfacePressure: current.surface_pressure ?? 1008,
        windSpeed,
        windGusts,
        cloudCover: current.cloud_cover ?? 60,
        uvIndex: current.uv_index ?? 5,
        weatherCode: wmoCode,
        threatLevel,
        threatDescription,
        updatedAt: current.time || new Date().toISOString(),
      },
      hourly: next24Hours,
      daily: next7Days,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Weather search error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
