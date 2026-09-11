// GET /api/prediction — Generate ML future disaster prediction and A-to-Z solutions
// POST /api/prediction — Query with custom telemetry parameters

import { NextRequest, NextResponse } from 'next/server';
import { generateDisasterPrediction } from '@/lib/prediction';
import { dataStore } from '@/lib/store';
import type { HazardCategory } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('incidentId');
    const landmarkParam = searchParams.get('landmark');
    const categoryParam = (searchParams.get('category') as HazardCategory) || 'WATERLOGGING';
    const waterDepthParam = parseFloat(searchParams.get('waterDepth') || '3.5');
    const rainRateParam = parseFloat(searchParams.get('rainRate') || '50.0');
    const latParam = parseFloat(searchParams.get('lat') || '28.6360');
    const lngParam = parseFloat(searchParams.get('lng') || '77.2250');

    let landmark = landmarkParam || 'Minto Bridge Underpass, Connaught Place';
    let waterDepth = waterDepthParam;
    let rainRate = rainRateParam;
    let category = categoryParam;
    let lat = latParam;
    let lng = lngParam;
    let cityName = 'Delhi NCR';
    let stateName = 'Delhi';

    if (incidentId) {
      const inc = dataStore.getIncident(incidentId);
      if (inc) {
        landmark = inc.landmark || landmark;
        category = inc.category;
        if (inc.location) {
          lat = inc.location.latitude;
          lng = inc.location.longitude;
        }
        if (inc.reports[0]?.waterDepthFeet) {
          waterDepth = inc.reports[0].waterDepthFeet;
        }
      }
    }

    // Fetch Real-time Meteorological Telemetry from Open-Meteo for Coordinates
    let liveWeatherTelemetry: any = undefined;
    let hourlyRainForecast: number[] = [];

    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_gusts_10m&hourly=precipitation,weather_code,precipitation_probability&timezone=Asia%2FKolkata&forecast_days=2`;
      const wRes = await fetch(weatherUrl, { next: { revalidate: 300 } });
      if (wRes.ok) {
        const wData = await wRes.json();
        const cur = wData.current || {};
        const hourly = wData.hourly || {};
        hourlyRainForecast = (hourly.precipitation || []).slice(0, 24);
        const forecast24hTotalMm = Number(hourlyRainForecast.reduce((a: number, b: number) => a + b, 0).toFixed(1));

        if (!searchParams.get('rainRate') && cur.precipitation !== undefined && cur.precipitation > 0) {
          rainRate = cur.precipitation;
        }

        liveWeatherTelemetry = {
          source: 'Open-Meteo High-Resolution Numerical Forecast & Radar Echo',
          temperatureC: cur.temperature_2m ?? 29.4,
          relativeHumidity: cur.relative_humidity_2m ?? 82,
          surfacePressureHpa: cur.surface_pressure ?? 1004.2,
          windSpeedKmh: cur.wind_speed_10m ?? 24.5,
          rainRateMmH: cur.precipitation ?? rainRate,
          forecast24hTotalMm,
          syncedAt: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback
    }

    const prediction = generateDisasterPrediction({
      landmark,
      cityName,
      stateName,
      category,
      currentWaterDepthFeet: waterDepth,
      currentRainRateMmH: rainRate,
      lat,
      lng,
      hourlyRainForecast: hourlyRainForecast.length > 0 ? hourlyRainForecast : undefined,
    });

    if (liveWeatherTelemetry) {
      prediction.liveWeatherTelemetry = liveWeatherTelemetry;
    }

    return NextResponse.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to compute future disaster prediction' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prediction = generateDisasterPrediction({
      landmark: body.landmark || 'Target Hazard Sector',
      cityName: body.cityName || 'Local Municipality',
      stateName: body.stateName || 'India',
      category: body.category || 'FLOODING',
      currentWaterDepthFeet: Number(body.currentWaterDepthFeet || 3.0),
      currentRainRateMmH: Number(body.currentRainRateMmH || 55.0),
      radarReflectivityDbz: Number(body.radarReflectivityDbz || 50.0),
      windGustKmh: Number(body.windGustKmh || 45.0),
      lat: Number(body.lat || 28.6360),
      lng: Number(body.lng || 77.2250),
      hourlyRainForecast: body.hourlyRainForecast,
    });

    return NextResponse.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to compute prediction model' },
      { status: 500 }
    );
  }
}
