// ============================================================
// Suraksha Setu — USGS Earthquake Real-Time Adapter
// Pulls live seismic observations for India, Nepal, and South Asia
// ============================================================

import type { UnifiedHazardEvent, HazardSeverity, ProviderHealth } from './types';

// Bounding box for South Asia (Lat 0°N - 39°N, Lng 58°E - 102°E)
const SOUTH_ASIA_BOUNDS = {
  minLng: 58.0,
  maxLng: 102.0,
  minLat: 0.0,
  maxLat: 39.0,
};

export async function fetchUsgsEarthquakes(): Promise<{
  events: UnifiedHazardEvent[];
  health: ProviderHealth;
}> {
  const sourceUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson';
  const nowIso = new Date().toISOString();

  try {
    const res = await fetch(sourceUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`USGS HTTP ${res.status}`);
    }

    const data = await res.json();
    const features = data.features || [];

    const southAsiaEvents: UnifiedHazardEvent[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    features.forEach((feat: any) => {
      const coords = feat.geometry?.coordinates;
      if (!coords || coords.length < 2) return;

      const lng = coords[0];
      const lat = coords[1];
      const depthKm = coords[2] ?? 10;

      // Filter to South Asia
      if (
        lng < SOUTH_ASIA_BOUNDS.minLng ||
        lng > SOUTH_ASIA_BOUNDS.maxLng ||
        lat < SOUTH_ASIA_BOUNDS.minLat ||
        lat > SOUTH_ASIA_BOUNDS.maxLat
      ) {
        return;
      }

      const mag = feat.properties?.mag ?? 3.0;
      const place = feat.properties?.place || 'South Asia Seismic Corridor';
      const eventTime = feat.properties?.time ? new Date(feat.properties.time).toISOString() : nowIso;
      const updatedTime = feat.properties?.updated ? new Date(feat.properties.updated).toISOString() : nowIso;
      const feltCount = feat.properties?.felt ?? 0;
      const usgsUrl = feat.properties?.url || 'https://earthquake.usgs.gov';

      // Detect country from place text or location
      let country = 'South Asia';
      const lowerPlace = place.toLowerCase();
      if (lowerPlace.includes('india') || (lat >= 8 && lat <= 35 && lng >= 68 && lng <= 88)) {
        country = 'India';
      } else if (lowerPlace.includes('nepal') || (lat >= 26.3 && lat <= 30.5 && lng >= 80 && lng <= 88.2)) {
        country = 'Nepal';
      } else if (lowerPlace.includes('bhutan') || (lat >= 26.7 && lat <= 28.3 && lng >= 88.7 && lng <= 92.1)) {
        country = 'Bhutan';
      } else if (lowerPlace.includes('bangladesh') || (lat >= 20.5 && lat <= 26.6 && lng >= 88.0 && lng <= 92.7)) {
        country = 'Bangladesh';
      } else if (lowerPlace.includes('sri lanka') || (lat >= 5.9 && lat <= 9.9 && lng >= 79.5 && lng <= 81.9)) {
        country = 'Sri Lanka';
      }

      let severity: HazardSeverity = 'ADVISORY';
      if (mag >= 6.5) {
        severity = 'SEVERE';
      } else if (mag >= 5.2) {
        severity = 'WARNING';
      } else if (mag >= 4.0) {
        severity = 'WATCH';
      }

      const diffMin = Math.round((Date.now() - new Date(eventTime).getTime()) / 60000);
      const freshnessLabel = diffMin < 60 ? `Live (${diffMin}m ago)` : `USGS Verified (${Math.round(diffMin / 60)}h ago)`;

      southAsiaEvents.push({
        id: `eq_usgs_${feat.id || Math.random().toString(36).substring(2, 9)}`,
        source: 'USGS',
        source_url: usgsUrl,
        hazard_type: 'EARTHQUAKE',
        acronym: 'EQ',
        title: `M ${mag.toFixed(1)} Earthquake — ${place}`,
        severity,
        status: 'ACTIVE',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        country,
        state: country === 'India' ? extractIndianState(place) : undefined,
        district: undefined,
        issued_at: eventTime,
        updated_at: updatedTime,
        expires_at: new Date(new Date(eventTime).getTime() + 7 * 24 * 3600000).toISOString(),
        freshness: freshnessLabel,
        confidence: 'HIGH',
        is_official: true,
        is_community_report: false,
        details: {
          magnitude: mag,
          depthKm: Math.round(depthKm * 10) / 10,
          nearestLocality: place,
          feltReportsCount: feltCount,
          feltUrl: `${usgsUrl}#tellus`,
          safetyGuidance: mag >= 5.0
            ? 'DROP, COVER, and HOLD ON. Protect your head. If indoors, stay away from glass and unreinforced walls. Watch for structural aftershocks.'
            : 'Minor tectonic movement recorded. No immediate structural damage anticipated. Monitor seismic bulletin.',
        },
      });
    });

    return {
      events: southAsiaEvents,
      health: {
        id: 'usgs',
        name: 'USGS Earthquake Hazards Feed',
        agency: 'United States Geological Survey',
        coverage: 'South Asia & Global Seismic Network',
        status: 'HEALTHY',
        statusMessage: `Active · Synchronized (${southAsiaEvents.length} events in South Asia)`,
        lastSuccessAt: nowIso,
        freshness: 'Live (Synchronized)',
        eventCount: southAsiaEvents.length,
        officialFeedUrl: sourceUrl,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      events: [],
      health: {
        id: 'usgs',
        name: 'USGS Earthquake Hazards Feed',
        agency: 'United States Geological Survey',
        coverage: 'South Asia & Global Seismic Network',
        status: 'DEGRADED',
        statusMessage: `Feed connection interrupted: ${errorMsg}`,
        lastSuccessAt: nowIso,
        freshness: 'Unavailable',
        eventCount: 0,
        officialFeedUrl: sourceUrl,
      },
    };
  }
}

function extractIndianState(place: string): string | undefined {
  const states = [
    'Jammu and Kashmir', 'Himachal Pradesh', 'Uttarakhand', 'Punjab', 'Haryana',
    'Delhi', 'Uttar Pradesh', 'Bihar', 'Assam', 'Meghalaya', 'Arunachal Pradesh',
    'Manipur', 'Nagaland', 'Mizoram', 'Tripura', 'Sikkim', 'West Bengal',
    'Odisha', 'Gujarat', 'Maharashtra', 'Karnataka', 'Kerala', 'Tamil Nadu',
    'Andhra Pradesh', 'Telangana', 'Madhya Pradesh', 'Rajasthan'
  ];
  for (const s of states) {
    if (new RegExp(`\\b${s}\\b`, 'i').test(place)) return s;
  }
  return undefined;
}
