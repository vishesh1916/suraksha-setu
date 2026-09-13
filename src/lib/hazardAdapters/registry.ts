// ============================================================
// Suraksha Setu — Multi-Hazard Provider Registry & Aggregator
// Caches, deduplicates, and standardizes multi-agency feeds
// ============================================================

import type { UnifiedHazardEvent, ProviderHealth } from './types';
import { fetchUsgsEarthquakes } from './usgsEarthquakeAdapter';
import { fetchGdacsDisasters } from './gdacsAdapter';
import { fetchNdmaSachetAlerts } from './ndmaSachetAdapter';
import { fetchImdWeatherAndFloods } from './imdWeatherFloodAdapter';
import { fetchNasaFirmsHotspots } from './nasaFirmsAdapter';
import { fetchAirQualityAlerts } from './cpcbAirQualityAdapter';
import { fetchIsroBhuvanAlerts } from './isroBhuvanAdapter';
import { fetchNepalDisasterAlerts } from './nepalDisasterAdapter';
import { dataStore } from '@/lib/store';
import type { Report } from '@/types';

interface CacheEntry {
  events: UnifiedHazardEvent[];
  sourcesHealth: ProviderHealth[];
  timestamp: number;
}

let cachedData: CacheEntry | null = null;
const CACHE_TTL_MS = 90 * 1000; // 90 seconds cache

export async function getUnifiedHazardData(options: {
  includeCommunity?: boolean;
  timeRange?: '24h' | '7d' | '30d';
  country?: string;
  hazardType?: string;
  severity?: string;
} = {}): Promise<{
  events: UnifiedHazardEvent[];
  sourcesHealth: ProviderHealth[];
  timestamp: string;
}> {
  const now = Date.now();

  // Return fresh or cached data
  let allOfficialEvents: UnifiedHazardEvent[] = [];
  let sourcesHealth: ProviderHealth[] = [];

  if (cachedData && now - cachedData.timestamp < CACHE_TTL_MS) {
    allOfficialEvents = [...cachedData.events];
    sourcesHealth = [...cachedData.sourcesHealth];
  } else {
    // Run all official agency adapters concurrently
    const [usgsRes, gdacsRes, ndmaRes, imdRes, firmsRes, aqRes, isroRes, nepalRes] = await Promise.allSettled([
      fetchUsgsEarthquakes(),
      fetchGdacsDisasters(),
      fetchNdmaSachetAlerts(),
      fetchImdWeatherAndFloods(),
      fetchNasaFirmsHotspots(),
      fetchAirQualityAlerts(),
      fetchIsroBhuvanAlerts(),
      fetchNepalDisasterAlerts(),
    ]);

    const collectedEvents: UnifiedHazardEvent[] = [];
    const collectedHealth: ProviderHealth[] = [];

    if (usgsRes.status === 'fulfilled') {
      collectedEvents.push(...usgsRes.value.events);
      collectedHealth.push(usgsRes.value.health);
    }
    if (gdacsRes.status === 'fulfilled') {
      collectedEvents.push(...gdacsRes.value.events);
      collectedHealth.push(gdacsRes.value.health);
    }
    if (ndmaRes.status === 'fulfilled') {
      collectedEvents.push(...ndmaRes.value.events);
      collectedHealth.push(ndmaRes.value.health);
    }
    if (imdRes.status === 'fulfilled') {
      collectedEvents.push(...imdRes.value.events);
      collectedHealth.push(imdRes.value.health);
    }
    if (firmsRes.status === 'fulfilled') {
      collectedEvents.push(...firmsRes.value.events);
      collectedHealth.push(firmsRes.value.health);
    }
    if (aqRes.status === 'fulfilled') {
      collectedEvents.push(...aqRes.value.events);
      collectedHealth.push(aqRes.value.health);
    }
    if (isroRes.status === 'fulfilled') {
      collectedEvents.push(...isroRes.value.events);
      collectedHealth.push(isroRes.value.health);
    }
    if (nepalRes.status === 'fulfilled') {
      collectedEvents.push(...nepalRes.value.events);
      collectedHealth.push(nepalRes.value.health);
    }

    collectedHealth.push({
      id: 'gsi_landslide',
      name: 'GSI National Landslide Early Warning',
      agency: 'Geological Survey of India / Ministry of Mines',
      coverage: 'Himalayan & Western Ghats Slope Vulnerability',
      status: 'NO_VERIFIED_FEED',
      statusMessage: 'No verified live feed available — Automated API bridge pending MoM clearance',
      lastSuccessAt: '',
      freshness: 'No verified live feed available',
      eventCount: 0,
      officialFeedUrl: 'https://www.gsi.gov.in',
    });

    // Deduplicate near-duplicate official events (e.g. earthquake reported by both USGS and GDACS)
    const dedupedOfficial = deduplicateEvents(collectedEvents);

    cachedData = {
      events: dedupedOfficial,
      sourcesHealth: collectedHealth,
      timestamp: now,
    };

    allOfficialEvents = [...dedupedOfficial];
    sourcesHealth = [...collectedHealth];
  }

  // If community reports are requested, map them separately
  let combinedEvents = [...allOfficialEvents];

  if (options.includeCommunity) {
    const rawReports: Report[] = dataStore.getReports();
    // Exclude dismissed reports or fake demo reports
    const activeCommunityReports = rawReports.filter(
      (r: Report) => r.status !== 'DISMISSED'
    );

    const communityEvents: UnifiedHazardEvent[] = activeCommunityReports.map((r: Report) => {
      let acronym: UnifiedHazardEvent['acronym'] = 'FL';
      if (r.category === 'WATERLOGGING' || r.category === 'FLOODING') acronym = 'FL';
      else if (r.category === 'SEVERE_RAIN' || r.category === 'CLOUDBURST') acronym = 'RF';
      else if (r.category === 'STRONG_WIND') acronym = 'ST';
      else if (r.category === 'HAIL') acronym = 'RF';

      let sev: UnifiedHazardEvent['severity'] = 'ADVISORY';
      if (r.severity >= 5) sev = 'SEVERE';
      else if (r.severity >= 4) sev = 'WARNING';
      else if (r.severity >= 3) sev = 'WATCH';

      let modStatus: 'Received' | 'Under review' | 'Verified' | 'Dismissed' | 'Resolved' = 'Received';
      if (r.status === 'RESOLVED') modStatus = 'Resolved';
      else if (r.verificationStatus === 'VERIFIED_GENUINE') modStatus = 'Verified';
      else if (r.status === 'REVIEWED' || r.status === 'ATTACHED') modStatus = 'Under review';

      return {
        id: `community_${r.id}`,
        source: 'Public Citizen Report',
        source_url: `/track?id=${r.id}`,
        hazard_type: r.category,
        acronym,
        title: `Unverified community report: ${r.landmark || r.category}`,
        severity: sev,
        status: r.status === 'RESOLVED' ? 'RESOLVED' : 'ACTIVE',
        geometry: {
          type: 'Point',
          coordinates: [r.location.longitude, r.location.latitude],
        },
        country: 'India',
        district: r.landmark || 'Ground Report Area',
        issued_at: r.createdAt,
        updated_at: r.updatedAt,
        freshness: 'Ground Submission',
        confidence: r.verificationStatus === 'VERIFIED_GENUINE' ? 'VERIFIED' : 'LOW',
        is_official: false,
        is_community_report: true,
        details: {
          nearestLocality: r.landmark,
          waterDepthFeet: r.waterDepthFeet,
          moderationStatus: modStatus,
          mediaUrl: r.mediaUrl,
          reportCount: 1,
          safetyGuidance: 'Citizen-submitted ground observation. Triage in progress by district emergency control room.',
        },
      };
    });

    combinedEvents = [...combinedEvents, ...communityEvents];
  }

  // Apply optional filters
  let filtered = combinedEvents;

  if (options.country && options.country !== 'ALL') {
    filtered = filtered.filter(
      (e) => e.country.toLowerCase() === options.country!.toLowerCase()
    );
  }

  if (options.hazardType && options.hazardType !== 'ALL') {
    filtered = filtered.filter(
      (e) => e.acronym.toLowerCase() === options.hazardType!.toLowerCase()
    );
  }

  if (options.severity && options.severity !== 'ALL') {
    filtered = filtered.filter(
      (e) => e.severity.toLowerCase() === options.severity!.toLowerCase()
    );
  }

  if (options.timeRange) {
    const maxAgeMs =
      options.timeRange === '24h'
        ? 24 * 3600 * 1000
        : options.timeRange === '7d'
        ? 7 * 24 * 3600 * 1000
        : 30 * 24 * 3600 * 1000;

    const cutoff = now - maxAgeMs;
    filtered = filtered.filter((e) => new Date(e.issued_at).getTime() >= cutoff);
  }

  return {
    events: filtered,
    sourcesHealth,
    timestamp: new Date(now).toISOString(),
  };
}

/**
 * Deduplicate events occurring in the same spatial radius and time window.
 */
function deduplicateEvents(events: UnifiedHazardEvent[]): UnifiedHazardEvent[] {
  const result: UnifiedHazardEvent[] = [];

  for (const ev of events) {
    if (ev.geometry.type !== 'Point') {
      result.push(ev);
      continue;
    }

    const [lng, lat] = ev.geometry.coordinates;
    const evTime = new Date(ev.issued_at).getTime();

    const existing = result.find((item) => {
      if (item.geometry.type !== 'Point') return false;
      if (item.acronym !== ev.acronym) return false;
      const [oLng, oLat] = item.geometry.coordinates;
      const oTime = new Date(item.issued_at).getTime();

      // Spatial distance < 0.35 deg (~35 km) and time window < 3 hours
      const dist = Math.hypot(lng - oLng, lat - oLat);
      const timeDiff = Math.abs(evTime - oTime);
      return dist < 0.35 && timeDiff < 3 * 3600000;
    });

    if (existing) {
      // Append secondary source reference if not already present
      if (!existing.source.includes(ev.source)) {
        existing.source = `${existing.source} · ${ev.source}`;
      }
    } else {
      result.push({ ...ev });
    }
  }

  return result;
}
