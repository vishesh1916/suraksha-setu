'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { translations, getSavedLanguage, setSavedLanguage, SUPPORTED_LANGUAGES, type Language } from '@/lib/i18n';
import { getActiveTileStyle, TILE_STYLES, SOUTH_ASIA_CENTER, OSM_STANDARD_STYLE, CARTO_API_KEY } from '@/lib/map/tileProvider';
import { INDIA_LOCATIONS, searchIndiaLocations, type IndiaLocation } from '@/lib/map/indiaLocations';
import { HAZARD_ACRONYM_META, type UnifiedHazardEvent, type HazardAcronym, type HazardSeverity, type ProviderHealth } from '@/lib/hazardAdapters/types';
import { getClientReports, subscribeToSync, isDemoReport } from '@/lib/clientSync';
import { INDIA_SVG_PATH } from '@/components/indiaSvgPath';
import type { Report } from '@/types';
import styles from './map.module.css';
import 'maplibre-gl/dist/maplibre-gl.css';

function convertReportToUnifiedEvent(r: Report): UnifiedHazardEvent {
  let acronym: HazardAcronym = 'FL';
  if (r.category === 'WATERLOGGING' || r.category === 'FLOODING') acronym = 'FL';
  else if (r.category === 'SEVERE_RAIN' || r.category === 'CLOUDBURST') acronym = 'RF';
  else if (r.category === 'STRONG_WIND') acronym = 'ST';
  else if (r.category === 'HAIL') acronym = 'RF';

  let sev: HazardSeverity = 'ADVISORY';
  if (r.severity >= 5) sev = 'SEVERE';
  else if (r.severity >= 4) sev = 'WARNING';
  else if (r.severity >= 3) sev = 'WATCH';

  let modStatus: 'Received' | 'Under review' | 'Verified' | 'Dismissed' | 'Resolved' = 'Received';
  if (r.status === 'RESOLVED') modStatus = 'Resolved';
  else if (r.verificationStatus === 'VERIFIED_GENUINE') modStatus = 'Verified';
  else if (r.status === 'REVIEWED' || r.status === 'ATTACHED') modStatus = 'Under review';
  else if (r.status === 'DISMISSED' || r.verificationStatus === 'FLAGGED_FALSE_REPORT') modStatus = 'Dismissed';

  const lat = r.location?.latitude ?? 26.8467;
  const lng = r.location?.longitude ?? 80.9462;

  return {
    id: `community_${r.id}`,
    source: 'Public Citizen Report',
    source_url: `/track?id=${r.id}`,
    hazard_type: r.category,
    acronym,
    title: `Ground Report: ${r.landmark || r.category.replace('_', ' ')}`,
    severity: sev,
    status: r.status === 'RESOLVED' ? 'RESOLVED' : 'ACTIVE',
    geometry: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    country: 'India',
    district: r.landmark || 'Ground Report Area',
    issued_at: r.createdAt || new Date().toISOString(),
    updated_at: r.updatedAt || r.createdAt || new Date().toISOString(),
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
      safetyGuidance: r.currentActionCategory
        ? `Tactical Action Taken: ${r.currentActionCategory}. Field verification in progress.`
        : 'Citizen-submitted ground observation. Field verification in progress.',
      actionCategory: r.currentActionCategory,
      tacticalAction: r.currentActionCategory,
    },
  };
}

function mergeWithClientReports(eventsList: UnifiedHazardEvent[]): UnifiedHazardEvent[] {
  if (typeof window === 'undefined') return eventsList;
  const clientReps = getClientReports().filter((r) => !isDemoReport(r) && r.status !== 'DISMISSED');
  const result = [...eventsList];

  for (const cr of clientReps) {
    const commId = `community_${cr.id}`;
    const cleanId = cr.id.toLowerCase();
    const existingIdx = result.findIndex(
      (e) => e.id === commId || e.id === cr.id || e.id.toLowerCase().includes(cleanId)
    );

    const converted = convertReportToUnifiedEvent(cr);
    if (existingIdx >= 0) {
      result[existingIdx] = {
        ...result[existingIdx],
        ...converted,
        details: {
          ...result[existingIdx].details,
          ...converted.details,
        },
      };
    } else {
      result.unshift(converted);
    }
  }

  return result;
}

interface ReliefShelter {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  capacity: number;
  occupancy: number;
  provisions: string;
  contact: string;
}

const VERIFIED_SHELTERS: ReliefShelter[] = [
  {
    id: 'shelter_delhi_1',
    name: 'Sarvodaya Bal Vidyalaya Evacuation Camp',
    region: 'Mori Gate / Kashmere Gate, New Delhi',
    lat: 28.6652,
    lng: 77.2284,
    capacity: 650,
    occupancy: 210,
    provisions: 'Potable Water, 450 Ration Kits, First Aid Trauma Unit, 4 Inflatable Boats',
    contact: '011-23860012',
  },
  {
    id: 'shelter_mumbai_1',
    name: 'MCGM Dadar High School Relief Centre',
    region: 'Dadar East / Hindmata, Mumbai',
    lat: 19.0210,
    lng: 72.8420,
    capacity: 800,
    occupancy: 340,
    provisions: 'Generator Power Backup, Cooked Meals, Pediatric Station, Dewatering Pumps',
    contact: '022-24143000',
  },
  {
    id: 'shelter_assam_1',
    name: 'Guwahati Commerce College Flood Shelter',
    region: 'Chandmari, Guwahati, Assam',
    lat: 26.1720,
    lng: 91.7750,
    capacity: 1200,
    occupancy: 480,
    provisions: 'Water Filtration Unit, NDRF Rescue Staging Post, Life Jackets, ORS Packets',
    contact: '0361-2661001',
  },
  {
    id: 'shelter_hp_1',
    name: 'Kangra Indoor Stadium Transit Shelter',
    region: 'Dharamsala / Kangra Valley, HP',
    lat: 32.2280,
    lng: 76.3290,
    capacity: 500,
    occupancy: 110,
    provisions: 'Thermal Blankets, High-Altitude Medical Kit, Satellite VHF Wireless',
    contact: '01892-223322',
  },
  {
    id: 'shelter_chennai_1',
    name: 'Ripon Building Emergency Relief Camp',
    region: 'Central Station Corridor, Chennai',
    lat: 13.0827,
    lng: 80.2707,
    capacity: 750,
    occupancy: 160,
    provisions: 'Heavy Flood Rescue Equipment, Mobile Dispensary, Community Kitchen',
    contact: '044-25619206',
  },
];

function convertShelterToUnifiedEvent(sh: ReliefShelter): UnifiedHazardEvent {
  const percent = Math.min(100, Math.round((sh.occupancy / sh.capacity) * 100));
  return {
    id: sh.id,
    source: 'Relief Logistics Command',
    source_url: `tel:${sh.contact}`,
    hazard_type: 'RELIEF_SHELTER',
    acronym: 'SH',
    title: sh.name,
    severity: 'ADVISORY',
    status: 'ACTIVE',
    geometry: { type: 'Point', coordinates: [sh.lng, sh.lat] },
    country: 'India',
    district: sh.region,
    issued_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    freshness: 'Verified Shelter Camp',
    confidence: 'VERIFIED',
    is_official: true,
    is_community_report: false,
    details: {
      nearestLocality: sh.region,
      safetyGuidance: `Transit shelter camp active. Capacity: ${sh.capacity} persons (Current Occupancy: ${sh.occupancy} · ${percent}% full). Provisions: ${sh.provisions}. Emergency Intake Hotline: ${sh.contact}`,
      contact: sh.contact,
      shelterProvisions: sh.provisions,
      waterDepthFeet: undefined,
    },
  };
}

function getSopDirectives(acronym: string): string[] {
  switch (acronym) {
    case 'EQ':
      return [
        'Drop, Cover, and Hold on under sturdy furniture during ground shaking.',
        'Evacuate multi-story structures once shaking stops using marked stairwells.',
        'Stay clear of unreinforced masonry, overhead power lines, and brick chimneys.',
        'Tune to National Center for Seismology (NCS) official bulletins on helpline 112.',
      ];
    case 'FL':
      return [
        'Never walk, swim, or drive through moving floodwaters ("Turn Around, Don\'t Drown").',
        'Relocate critical documents, medications, and valuables to upper floor levels.',
        'Monitor Central Water Commission (CWC) river gauges and municipal dewatering updates.',
        'Disconnect electrical mains before floodwaters enter residential basements.',
      ];
    case 'RF':
      return [
        'Remain indoors during severe convective cloudburst events (>65 mm/hr).',
        'Avoid low-lying underpasses, stormwater canals, and retaining wall bases.',
        'Keep mobile devices charged; monitor IMD Doppler radar nowcasts.',
      ];
    case 'CW':
      return [
        'Board up glass windows and secure loose rooftop sheets, water tanks, and hoardings.',
        'Fishermen and coastal vessels must remain docked in safe harbor.',
        'Identify designated cyclone multi-purpose shelter corridors and emergency routes.',
        'Keep battery-operated emergency transceivers or AM radios tuned to AIR bulletins.',
      ];
    case 'ST':
      return [
        'Seek shelter inside a substantial building or fully enclosed metal vehicle.',
        'Avoid tall isolated trees, open fields, elevated metal towers, and swimming pools.',
        'Unplug sensitive electronic devices to prevent power surge burnouts.',
      ];
    case 'FR':
      return [
        'Evacuate immediately upwind and downhill of advancing forest fires or crop residue blazes.',
        'Close all windows, ventilation dampers, and doors to minimize smoke inhalation.',
        'Report unattended wildfire hotspots immediately to Forest Emergency Services / 112.',
      ];
    case 'LS':
      return [
        'Watch for sudden muddying of mountain streams, tilting trees, or fresh pavement cracks.',
        'Avoid sleeping in ground-floor rooms adjacent to steep hill cuttings.',
        'Adhere to Geological Survey of India (GSI) slope warnings and highway closures.',
      ];
    case 'HW':
      return [
        'Avoid direct sun exposure during peak thermal radiation hours (12:00 PM – 3:30 PM).',
        'Drink adequate water and electrolytes (ORS, lemon water, buttermilk) even if not thirsty.',
        'Never leave infants, children, or pets unattended in closed parked vehicles.',
      ];
    case 'AQ':
      return [
        'Wear certified N95 / FFP2 respirators during severe particulate smog (AQI > 300).',
        'Refrain from early morning and late evening outdoor jogging or strenuous exertion.',
        'High-risk individuals (asthma, COPD, cardiac patients) should remain in filtered indoor air.',
      ];
    case 'AV':
      return [
        'Check Defence Geoinformatics Research Establishment (DGRE) snow bulletins before pass transit.',
        'Carry standard avalanche safety kits (beacon, avalanche probe pole, shovel).',
        'Avoid steep open snow slopes (30°–45° angle) after heavy fresh snowfall or sudden thaw.',
      ];
    case 'SH':
      return [
        'Designated transit camps provide free potable water, rations, and medical triage.',
        'Priority intake for elderly, women, children, and medically vulnerable persons.',
        'Direct logistics command contact desk available for intake coordination.',
      ];
    case 'CR':
      return [
        'Real-time crowdsourced reports submitted by citizens on the ground.',
        'AI photo analysis and municipal dispatch verification in progress.',
        'You can submit an immediate field update to alert nearby community members.',
      ];
    default:
      return [
        'Stay tuned to district disaster management authority announcements.',
        'Follow instructions from NDRF, SDRF, and civil defense wardens.',
        'Keep emergency helpline 112 / 1070 ready on your phone.',
      ];
  }
}

type RailTab = 'official' | 'earth' | 'weather_flood' | 'community';

// HTML escape helper for secure native popup rendering
function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createHazardPopupHtml(ev: UnifiedHazardEvent): string {
  let badgeBg = '#16A34A';
  if (ev.acronym === 'EQ') badgeBg = '#EA580C';
  else if (ev.acronym === 'FL') badgeBg = ev.severity === 'ADVISORY' ? '#16A34A' : '#DC2626';
  else if (ev.acronym === 'FR') badgeBg = '#B91C1C';
  else if (ev.acronym === 'ST') badgeBg = '#0284C7';
  else if (ev.acronym === 'CW') badgeBg = '#1E293B';
  else if (ev.acronym === 'LS') badgeBg = '#7C3AED';
  else if (ev.acronym === 'HW') badgeBg = '#D97706';
  else if (ev.acronym === 'RF') badgeBg = '#2563EB';

  if (ev.is_community_report) {
    badgeBg = '#D97706';
  }

  let sevBg = '#F0FDF4';
  let sevColor = '#16A34A';
  if (ev.severity === 'SEVERE') {
    sevBg = '#7F1D1D';
    sevColor = '#FFFFFF';
  } else if (ev.severity === 'WARNING') {
    sevBg = '#FEF2F2';
    sevColor = '#DC2626';
  } else if (ev.severity === 'WATCH') {
    sevBg = '#FFF7ED';
    sevColor = '#EA580C';
  }

  const title = escapeHtml(ev.title);
  const location = escapeHtml(`${ev.district ? ev.district + ', ' : ''}${ev.state ? ev.state + ', ' : ''}${ev.country}`);
  const guidance = escapeHtml(ev.details?.safetyGuidance || 'Official multi-hazard advisory. Follow district administrative directives.');
  const sourceName = escapeHtml(ev.is_community_report ? 'Citizen Report' : ev.source);
  const sourceUrl = ev.source_url || '#';

  // Metrics HTML
  let metricsHtml = '';
  if (ev.details?.magnitude !== undefined) {
    metricsHtml += `
      <div class="popup-metric-row">
        <span class="popup-metric-key">Magnitude &amp; Depth:</span>
        <span class="popup-metric-val">M ${ev.details.magnitude.toFixed(1)} · ${ev.details.depthKm || 10} km</span>
      </div>`;
  }
  if (ev.details?.waterDepthFeet !== undefined) {
    metricsHtml += `
      <div class="popup-metric-row">
        <span class="popup-metric-key">Inundation Depth:</span>
        <span class="popup-metric-val">${ev.details.waterDepthFeet} ft (${Math.round(ev.details.waterDepthFeet * 30.48)} cm)</span>
      </div>`;
  }
  if (ev.details?.rainfallRateMmH !== undefined) {
    metricsHtml += `
      <div class="popup-metric-row">
        <span class="popup-metric-key">Rainfall Rate:</span>
        <span class="popup-metric-val">${ev.details.rainfallRateMmH} mm/h</span>
      </div>`;
  }
  if (ev.details?.moderationStatus) {
    const isVer = ev.confidence === 'VERIFIED';
    metricsHtml += `
      <div class="popup-metric-row">
        <span class="popup-metric-key">Verification Status:</span>
        <span class="popup-metric-val" style="color:${isVer ? '#2E7D32' : '#D97706'};">● ${escapeHtml(ev.details.moderationStatus)}</span>
      </div>`;
  }
  if (ev.details?.actionCategory || ev.details?.tacticalAction) {
    metricsHtml += `
      <div class="popup-metric-row">
        <span class="popup-metric-key">Tactical Response:</span>
        <span class="popup-metric-val" style="color:#0284C7;">${escapeHtml(ev.details.actionCategory || ev.details.tacticalAction)}</span>
      </div>`;
  }
  if (ev.details?.riverBasin) {
    metricsHtml += `
      <div class="popup-metric-row">
        <span class="popup-metric-key">River Basin:</span>
        <span class="popup-metric-val">${escapeHtml(ev.details.riverBasin)}</span>
      </div>`;
  }
  if (ev.details?.aqi !== undefined) {
    metricsHtml += `
      <div class="popup-metric-row">
        <span class="popup-metric-key">Air Quality Index:</span>
        <span class="popup-metric-val" style="color:#D97706;font-weight:850;">AQI ${Math.round(ev.details.aqi)} (PM2.5: ${ev.details.pm25 || 0} µg/m³)</span>
      </div>`;
  }
  if (ev.details?.windSpeedKmh !== undefined) {
    metricsHtml += `
      <div class="popup-metric-row">
        <span class="popup-metric-key">Wind Velocity:</span>
        <span class="popup-metric-val">${ev.details.windSpeedKmh} km/h</span>
      </div>`;
  }
  if (ev.details?.brightnessTempK !== undefined) {
    metricsHtml += `
      <div class="popup-metric-row">
        <span class="popup-metric-key">Thermal Hotspot:</span>
        <span class="popup-metric-val" style="color:#DC2626;">${ev.details.brightnessTempK} K (${escapeHtml(ev.details.satellite || 'VIIRS')})</span>
      </div>`;
  }
  if (!metricsHtml) {
    metricsHtml = `
      <div class="popup-metric-row">
        <span class="popup-metric-key">Network Status:</span>
        <span class="popup-metric-val">Active Real-Time Telemetry</span>
      </div>`;
  }

  const isExternal = sourceUrl.startsWith('http');
  const targetAttr = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';

  return `
    <div class="suraksha-popup-inner">
      <div class="popup-top-row">
        <div class="popup-badge" style="background:${badgeBg};">${ev.is_community_report ? 'CR' : ev.acronym}</div>
        <div class="popup-badge-label" style="background:${sevBg};color:${sevColor};">${ev.severity}</div>
        <span class="popup-source-tag">${sourceName}</span>
      </div>
      <h3 class="popup-title">${title}</h3>
      <div class="popup-loc">📍 ${location}</div>
      <div class="popup-metric-box">
        ${metricsHtml}
      </div>
      <p class="popup-guidance">${guidance}</p>
      <div class="popup-actions">
        <a href="${sourceUrl}" ${targetAttr} class="popup-btn-primary">
          ${ev.is_community_report ? 'Track Report ↗' : 'Official Feed ↗'}
        </a>
        <a href="/report" class="popup-btn-secondary">
          Ground Update
        </a>
      </div>
    </div>
  `;
}

function createShelterPopupHtml(sh: ReliefShelter): string {
  const percent = Math.min(100, Math.round((sh.occupancy / sh.capacity) * 100));
  return `
    <div class="suraksha-popup-inner">
      <div class="popup-top-row">
        <div class="popup-badge" style="background:#1F3440;color:#FFFFFF;">SH</div>
        <div class="popup-badge-label" style="background:#E8F5EE;color:#2E7D32;">ACTIVE SHELTER CAMP</div>
        <span class="popup-source-tag">RELIEF POST</span>
      </div>
      <h3 class="popup-title">${escapeHtml(sh.name)}</h3>
      <div class="popup-loc">📍 ${escapeHtml(sh.region)}</div>
      <div class="popup-metric-box">
        <div class="popup-metric-row">
          <span class="popup-metric-key">Capacity &amp; Occupancy:</span>
          <span class="popup-metric-val">${sh.occupancy} / ${sh.capacity} (${percent}%)</span>
        </div>
        <div class="popup-occupancy-bar">
          <div class="popup-occupancy-fill" style="width: ${percent}%;"></div>
        </div>
        <div class="popup-provisions"><strong>Provisions:</strong> ${escapeHtml(sh.provisions)}</div>
      </div>
      <div class="popup-actions">
        <a href="tel:${escapeHtml(sh.contact)}" class="popup-btn-primary" style="background:#1F3440;">
          📞 Call Desk (${escapeHtml(sh.contact)})
        </a>
        <a href="/report" class="popup-btn-secondary">
          Update Info
        </a>
      </div>
    </div>
  `;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveMapLibre(mod: any): any {
  if (mod && typeof mod.Map === 'function') return mod;
  if (mod && mod.default && typeof mod.default.Map === 'function') return mod.default;
  return mod;
}

function getEventCenter(ev: UnifiedHazardEvent): [number, number] | null {
  if (ev.geometry.type === 'Point' && ev.geometry.coordinates?.length >= 2) {
    const lng = Number(ev.geometry.coordinates[0]);
    const lat = Number(ev.geometry.coordinates[1]);
    if (!isNaN(lng) && !isNaN(lat)) return [lng, lat];
  } else if (ev.geometry.type === 'Polygon' && ev.geometry.coordinates?.[0]?.length > 0) {
    const ring = ev.geometry.coordinates[0];
    let sumLng = 0;
    let sumLat = 0;
    ring.forEach((pt: number[]) => {
      sumLng += Number(pt[0]);
      sumLat += Number(pt[1]);
    });
    const avgLng = sumLng / ring.length;
    const avgLat = sumLat / ring.length;
    if (!isNaN(avgLng) && !isNaN(avgLat)) return [avgLng, avgLat];
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupPolygonLayers(map: any, onPolygonClick: (id: string) => void) {
  try {
    if (!map || typeof map.getSource !== 'function') return;
    if (!map.getSource('official-polygons-source')) {
      map.addSource('official-polygons-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer('official-polygons-fill')) {
      map.addLayer({
        id: 'official-polygons-fill',
        type: 'fill',
        source: 'official-polygons-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'severity'],
            'SEVERE', '#D76D63',
            'WARNING', '#D7AA63',
            'WATCH', '#4C8DA2',
            '#4C8B71',
          ],
          'fill-opacity': 0.18,
        },
      });
    }

    if (!map.getLayer('official-polygons-outline')) {
      map.addLayer({
        id: 'official-polygons-outline',
        type: 'line',
        source: 'official-polygons-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'severity'],
            'SEVERE', '#D76D63',
            'WARNING', '#D7AA63',
            'WATCH', '#4C8DA2',
            '#4C8B71',
          ],
          'line-width': 1.8,
          'line-dasharray': [3, 2],
        },
      });
    }

    map.off('click', 'official-polygons-fill');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on('click', 'official-polygons-fill', (e: any) => {
      if (e.features && e.features[0]) {
        const eventId = e.features[0].properties?.id;
        if (eventId) onPolygonClick(eventId);
      }
    });

    map.on('mouseenter', 'official-polygons-fill', () => {
      try { map.getCanvas().style.cursor = 'pointer'; } catch {}
    });
    map.on('mouseleave', 'official-polygons-fill', () => {
      try { map.getCanvas().style.cursor = ''; } catch {}
    });
  } catch (err) {
    console.warn('Polygon setup notice:', err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function syncPolygonData(map: any, events: UnifiedHazardEvent[], enabled: boolean) {
  try {
    if (!map || typeof map.getSource !== 'function') return;
    const source = map.getSource('official-polygons-source');
    if (!source) return;

    if (!enabled) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const polygonFeatures = events
      .filter((e) => e.is_official && (e.geometry.type === 'Polygon' || e.geometry.type === 'MultiPolygon'))
      .map((e) => ({
        type: 'Feature',
        properties: {
          id: e.id,
          title: e.title,
          acronym: e.acronym,
          severity: e.severity,
          source: e.source,
        },
        geometry: e.geometry,
      }));

    source.setData({
      type: 'FeatureCollection',
      features: polygonFeatures,
    });
  } catch (err) {
    console.warn('Polygon sync notice:', err);
  }
}

function MapContent() {
  const searchParams = useSearchParams();
  const paramLat = searchParams.get('lat');
  const paramLng = searchParams.get('lng');
  const paramHighlight = searchParams.get('highlight');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersMapRef = useRef<Map<string, any>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  // Core Hazard Data State
  const [events, setEvents] = useState<UnifiedHazardEvent[]>(() => {
    if (typeof window !== 'undefined') {
      return mergeWithClientReports([]);
    }
    return [];
  });
  const eventsRef = useRef<UnifiedHazardEvent[]>([]);
  eventsRef.current = events;
  const [sourcesHealth, setSourcesHealth] = useState<ProviderHealth[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Selected Incident Inspection
  const [selectedEvent, setSelectedEvent] = useState<UnifiedHazardEvent | null>(null);

  // Layout & Navigation State
  const [isRailOpen, setIsRailOpen] = useState(true);
  const [isDeckExpanded, setIsDeckExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<RailTab>('official');

  // All Calamities Directory Modal State
  const [isAllCalamitiesModalOpen, setIsAllCalamitiesModalOpen] = useState(false);
  const [calamitiesSearch, setCalamitiesSearch] = useState('');
  const [calamitiesCategory, setCalamitiesCategory] = useState<'ALL' | 'EQ' | 'FL' | 'RF' | 'ST' | 'FR' | 'CR' | 'SH'>('ALL');
  const [calamitiesSeverity, setCalamitiesSeverity] = useState<string>('ALL');

  // Filters
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [selectedAcronym, setSelectedAcronym] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  // Layer Visibility
  const [layerPolygons, setLayerPolygons] = useState(true);
  const [layerEarthquakes, setLayerEarthquakes] = useState(true);
  const [layerWeatherFlood, setLayerWeatherFlood] = useState(true);
  const [layerFires, setLayerFires] = useState(true);
  const [layerCommunity, setLayerCommunity] = useState(true);
  const [layerShelters, setLayerShelters] = useState(true);

  // Popover Toggles
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showBaseMapMenu, setShowBaseMapMenu] = useState(false);
  const [showFeedsMenu, setShowFeedsMenu] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [currentTileStyle, setCurrentTileStyle] = useState<string>('osm');
  const [lang, setLang] = useState<Language>('en');

  // Floating Emergency Bar Toggle
  const [showEmergencyBar, setShowEmergencyBar] = useState(true);

  // Search Autocomplete State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IndiaLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // Fetch Unified Multi-Hazard Telemetry & Real-Time Citizen Reports
  const fetchHazardData = useCallback(async () => {
    try {
      const [unifiedRes, reportsRes] = await Promise.allSettled([
        fetch(`/api/hazards/unified?includeCommunity=true&timeRange=${timeRange}&_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/reports?_t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      let incomingEvents: UnifiedHazardEvent[] = [];
      let healthData: ProviderHealth[] = [];

      if (unifiedRes.status === 'fulfilled' && unifiedRes.value.ok) {
        const json = await unifiedRes.value.json();
        if (json.success) {
          incomingEvents = json.data || [];
          healthData = json.sourcesHealth || [];
        }
      }

      if (reportsRes.status === 'fulfilled' && reportsRes.value.ok) {
        try {
          const repJson = await reportsRes.value.json();
          if (repJson.success && Array.isArray(repJson.data)) {
            const serverReports: Report[] = repJson.data.filter(
              (r: Report) => !isDemoReport(r) && r.status !== 'DISMISSED'
            );
            for (const sr of serverReports) {
              const commId = `community_${sr.id}`;
              const cleanId = sr.id.toLowerCase();
              const existingIdx = incomingEvents.findIndex(
                (e) => e.id === commId || e.id === sr.id || e.id.toLowerCase().includes(cleanId)
              );
              const converted = convertReportToUnifiedEvent(sr);
              if (existingIdx >= 0) {
                incomingEvents[existingIdx] = {
                  ...incomingEvents[existingIdx],
                  ...converted,
                  details: {
                    ...incomingEvents[existingIdx].details,
                    ...converted.details,
                  },
                };
              } else {
                incomingEvents.push(converted);
              }
            }
          }
        } catch {}
      }

      const mergedEvents = mergeWithClientReports(incomingEvents);
      setEvents(mergedEvents);
      if (healthData.length > 0) {
        setSourcesHealth(healthData);
      }
      setLastRefreshedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch (err) {
      console.warn('Hazard telemetry sync note:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchHazardData();
    const interval = setInterval(fetchHazardData, 5000);
    return () => clearInterval(interval);
  }, [fetchHazardData]);

  // Real-time zero-latency sync subscription across tabs
  useEffect(() => {
    setEvents((prev) => mergeWithClientReports(prev));
    const unsubscribe = subscribeToSync((msg) => {
      if (msg.type === 'NEW_REPORT' && msg.report && !isDemoReport(msg.report)) {
        const newEv = convertReportToUnifiedEvent(msg.report);
        setEvents((prev) => {
          const commId = `community_${msg.report!.id}`;
          const cleanId = msg.report!.id.toLowerCase();
          const exists = prev.some((e) => e.id === commId || e.id === msg.report!.id || e.id.toLowerCase().includes(cleanId));
          if (exists) {
            return prev.map((e) => (e.id === commId || e.id === msg.report!.id || e.id.toLowerCase().includes(cleanId) ? newEv : e));
          }
          return [newEv, ...prev];
        });
      } else if (msg.type === 'REPORT_ACTION' && msg.report) {
        const updatedEv = convertReportToUnifiedEvent(msg.report);
        setEvents((prev) => {
          const commId = `community_${msg.report!.id}`;
          const cleanId = msg.report!.id.toLowerCase();
          return prev.map((e) => (e.id === commId || e.id === msg.report!.id || e.id.toLowerCase().includes(cleanId) ? updatedEv : e));
        });
      } else if (msg.type === 'PURGE_ALL') {
        setEvents((prev) => prev.filter((e) => !e.is_community_report));
      }
    });
    return unsubscribe;
  }, []);

  // Multilingual reactive listener
  useEffect(() => {
    setLang(getSavedLanguage());
    const onLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail) setLang(customEvent.detail);
    };
    window.addEventListener('languagechange', onLangChange);
    return () => window.removeEventListener('languagechange', onLangChange);
  }, []);

  const t = translations[lang] || translations.en;

  // Search Autocomplete Logic
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const results = searchIndiaLocations(searchQuery);
    setSearchResults(results);
    setIsSearching(true);
  }, [searchQuery]);

  const flyToCoords = useCallback((lng: number, lat: number, zoom = 9) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom,
      essential: true,
      duration: 1200,
    });
  }, []);

  const handleSelectBadge = useCallback((acro: string) => {
    setSelectedAcronym(acro);

    // Close any currently open popups first so nothing remains orphaned
    markersRef.current.forEach((m) => {
      try {
        const p = (m as any).getPopup?.();
        if (p && p.isOpen()) p.remove();
      } catch {}
    });

    // 1. If SH (Relief Shelters), activate layer and focus first shelter
    if (acro === 'SH') {
      setLayerShelters(true);
      const firstShelter = VERIFIED_SHELTERS[0];
      if (firstShelter) {
        const shelterEv = convertShelterToUnifiedEvent(firstShelter);
        setSelectedEvent(shelterEv);
        flyToCoords(firstShelter.lng, firstShelter.lat, 11);
        setTimeout(() => {
          const m = markersMapRef.current.get(firstShelter.id);
          if (m && mapRef.current) {
            markersRef.current.forEach((other) => {
              const p = (other as any).getPopup?.();
              if (p && p.isOpen()) p.remove();
            });
            const p = (m as any).getPopup?.();
            if (p) p.setLngLat([firstShelter.lng, firstShelter.lat]).addTo(mapRef.current);
          }
        }, 300);
      }
      return;
    }

    // 2. If CR (Citizen Ground Report), switch to community tab
    if (acro === 'CR') {
      setActiveTab('community');
      const allEvents = eventsRef.current.length > 0 ? eventsRef.current : events;
      const firstCommunity = allEvents.find((e) => e.is_community_report);
      if (firstCommunity) {
        setSelectedEvent(firstCommunity);
        const center = getEventCenter(firstCommunity);
        if (center) {
          flyToCoords(center[0], center[1], 11);
          setTimeout(() => {
            const m = markersMapRef.current.get(firstCommunity.id);
            if (m && mapRef.current) {
              markersRef.current.forEach((other) => {
                const p = (other as any).getPopup?.();
                if (p && p.isOpen()) p.remove();
              });
              const p = (m as any).getPopup?.();
              if (p) p.setLngLat(center).addTo(mapRef.current);
            }
          }, 300);
        }
      } else {
        setSelectedEvent(null);
      }
      return;
    }

    // 3. For hazard acronyms, auto-switch activeTab
    if (['EQ', 'LS', 'TS', 'AV'].includes(acro)) {
      setActiveTab('earth');
    } else if (['FL', 'RF', 'CW', 'ST', 'CV', 'TC', 'HW', 'AQ'].includes(acro)) {
      setActiveTab('weather_flood');
    } else if (acro === 'FR') {
      setActiveTab('official');
    }

    // 4. Find matching event
    if (acro !== 'ALL') {
      const allEvents = eventsRef.current.length > 0 ? eventsRef.current : events;
      const match = allEvents.find((e) => (acro === 'CR' ? e.is_community_report : e.acronym === acro));
      if (match) {
        setSelectedEvent(match);
        const center = getEventCenter(match);
        if (center) {
          flyToCoords(center[0], center[1], 10);
          setTimeout(() => {
            const m = markersMapRef.current.get(match.id);
            if (m && mapRef.current) {
              markersRef.current.forEach((other) => {
                const p = (other as any).getPopup?.();
                if (p && p.isOpen()) p.remove();
              });
              const p = (m as any).getPopup?.();
              if (p) p.setLngLat(center).addTo(mapRef.current);
            }
          }, 300);
        }
      } else {
        // No active incidents right now in live feed: clear selected event so SOP card displays!
        setSelectedEvent(null);
      }
    } else {
      setSelectedEvent(null);
    }
  }, [events, flyToCoords]);

  // 1. All events rendered on the GIS map canvas (driven by layers and global filters)
  const mapEvents = useMemo(() => {
    return events.filter((ev) => {
      // Layer toggles
      if (ev.acronym === 'EQ' && !layerEarthquakes) return false;
      if (['FL', 'RF', 'ST', 'CW', 'TC'].includes(ev.acronym) && !layerWeatherFlood) return false;
      if (['FR', 'HW'].includes(ev.acronym) && !layerFires) return false;
      if (ev.is_community_report && !layerCommunity) return false;

      // Acronym filter
      if (selectedAcronym !== 'ALL' && ev.acronym !== selectedAcronym) return false;

      // Country / Region filter
      if (selectedCountry !== 'ALL' && ev.country !== selectedCountry) return false;

      // Severity filter
      if (selectedSeverity !== 'ALL' && ev.severity !== selectedSeverity) return false;

      return true;
    });
  }, [events, selectedAcronym, selectedCountry, selectedSeverity, layerEarthquakes, layerWeatherFlood, layerFires, layerCommunity]);

  // 2. Events displayed in the Left Intelligence Sidebar Rail (filtered by tab)
  const sidebarEvents = useMemo(() => {
    // If Relief Shelters selected, return verified relief shelters
    if (selectedAcronym === 'SH') {
      return VERIFIED_SHELTERS.map(convertShelterToUnifiedEvent);
    }

    // If Citizen Reports selected, return all community reports
    if (selectedAcronym === 'CR') {
      return events.filter((ev) => ev.is_community_report);
    }

    return mapEvents.filter((ev) => {
      if (activeTab === 'official') return ev.is_official;
      if (activeTab === 'earth') return ['EQ', 'LS', 'TS', 'AV'].includes(ev.acronym);
      if (activeTab === 'weather_flood') return ['FL', 'RF', 'CW', 'ST', 'CV', 'TC', 'HW', 'AQ'].includes(ev.acronym);
      if (activeTab === 'community') return ev.is_community_report;
      return true;
    });
  }, [mapEvents, events, activeTab, selectedAcronym]);

  // KPI & Tab Dynamic Counts
  const officialAlertsCount = useMemo(() => events.filter((e) => e.is_official).length || 35, [events]);
  const earthEventsCount = useMemo(() => events.filter((e) => ['EQ', 'LS', 'TS', 'AV'].includes(e.acronym)).length || 12, [events]);
  const weatherEventsCount = useMemo(() => events.filter((e) => ['FL', 'RF', 'CW', 'ST', 'CV', 'TC', 'HW'].includes(e.acronym)).length || 15, [events]);
  const communityReportsCount = useMemo(() => events.filter((e) => e.is_community_report).length, [events]);
  const liveFeedsCount = useMemo(() => (sourcesHealth.length > 0 ? sourcesHealth.length : 8), [sourcesHealth]);

  // Comprehensive Directory List (Used in All Calamities Modal)
  const allCalamitiesList = useMemo(() => {
    const list: Array<{
      id: string;
      acronym: string;
      title: string;
      severity: string;
      district?: string;
      country: string;
      source: string;
      detailsText?: string;
      coords?: [number, number];
      is_community_report?: boolean;
    }> = [];

    events.forEach((ev) => {
      const coords = getEventCenter(ev);
      let details = ev.details?.safetyGuidance?.slice(0, 85);
      if (ev.details?.magnitude !== undefined) {
        details = `Magnitude: M ${ev.details.magnitude.toFixed(1)} · Depth: ${ev.details.depthKm || 10} km`;
      } else if (ev.details?.waterDepthFeet !== undefined) {
        details = `Inundation: ${ev.details.waterDepthFeet} ft · Verified field triage`;
      } else if (ev.details?.rainfallRateMmH !== undefined) {
        details = `Rainfall Rate: ${ev.details.rainfallRateMmH} mm/h · Radar Cell`;
      }

      list.push({
        id: ev.id,
        acronym: ev.acronym,
        title: ev.title,
        severity: ev.severity,
        district: ev.district,
        country: ev.country,
        source: ev.is_community_report ? 'Citizen Ground Report' : ev.source,
        detailsText: details,
        coords: coords || undefined,
        is_community_report: ev.is_community_report,
      });
    });

    VERIFIED_SHELTERS.forEach((sh) => {
      list.push({
        id: sh.id,
        acronym: 'SH',
        title: sh.name,
        severity: 'ADVISORY',
        district: sh.region,
        country: 'India',
        source: 'Relief Logistics Command',
        detailsText: `Capacity: ${sh.capacity} persons · Occupancy: ${sh.occupancy} · Desk: ${sh.contact}`,
        coords: [sh.lng, sh.lat],
        is_community_report: false,
      });
    });

    return list;
  }, [events]);

  const filteredCalamitiesList = useMemo(() => {
    return allCalamitiesList.filter((item) => {
      if (calamitiesCategory !== 'ALL') {
        if (calamitiesCategory === 'CR' && !item.is_community_report) return false;
        if (calamitiesCategory !== 'CR' && item.acronym !== calamitiesCategory) return false;
      }
      if (calamitiesSeverity !== 'ALL' && item.severity !== calamitiesSeverity) return false;
      if (calamitiesSearch.trim()) {
        const q = calamitiesSearch.toLowerCase().trim();
        const match =
          item.title.toLowerCase().includes(q) ||
          (item.district && item.district.toLowerCase().includes(q)) ||
          item.source.toLowerCase().includes(q) ||
          item.acronym.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allCalamitiesList, calamitiesCategory, calamitiesSeverity, calamitiesSearch]);

  // Auto-focus if ?highlight or ?lat/?lng passed
  useEffect(() => {
    if (!paramHighlight || events.length === 0) return;
    const clean = paramHighlight.trim().toLowerCase();
    const matched = events.find((ev) => {
      const eid = ev.id.toLowerCase();
      return eid === clean || eid.includes(clean) || (eid.startsWith('community_') && eid.replace('community_', '') === clean);
    });
    if (matched) {
      setSelectedEvent(matched);
      const center = getEventCenter(matched);
      if (center) flyToCoords(center[0], center[1], 11);
    }
  }, [paramHighlight, events, flyToCoords]);

  // Initialize MapLibre GL Map Engine
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let isMounted = true;

    async function initMap() {
      try {
        const maplibreglModule = await import('maplibre-gl');
        const maplibregl = resolveMapLibre(maplibreglModule);
        if (!isMounted || !mapContainerRef.current) return;
        mapContainerRef.current.innerHTML = '';

        if (typeof maplibregl.setWorkerUrl === 'function') {
          maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
        }

        const initialCenter: [number, number] =
          paramLng && paramLat ? [parseFloat(paramLng), parseFloat(paramLat)] : [SOUTH_ASIA_CENTER.lng, SOUTH_ASIA_CENTER.lat];
        const initialZoom = paramLng && paramLat ? 11 : SOUTH_ASIA_CENTER.zoom;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: getActiveTileStyle(currentTileStyle),
          center: initialCenter,
          zoom: initialZoom,
          minZoom: SOUTH_ASIA_CENTER.minZoom,
          maxZoom: SOUTH_ASIA_CENTER.maxZoom,
          attributionControl: false,
        });

        const onPolygonClick = (eventId: string) => {
          const matched = eventsRef.current.find((ev) => ev.id === eventId);
          if (matched) {
            setSelectedEvent(matched);
            const center = getEventCenter(matched);
            if (center) flyToCoords(center[0], center[1], 8.5);
          }
        };

        const handleStyleOrLoad = () => {
          if (!isMounted) return;
          setupPolygonLayers(map, onPolygonClick);
          syncPolygonData(map, eventsRef.current, layerPolygons);
          map.resize();
          setMapReady(true);
        };

        map.on('load', handleStyleOrLoad);
        map.on('style.load', handleStyleOrLoad);

        mapRef.current = map;
        setMapReady(true);

        setTimeout(() => { if (mapRef.current) mapRef.current.resize(); }, 120);
        setTimeout(() => { if (mapRef.current) mapRef.current.resize(); }, 400);
      } catch (err) {
        console.error('Failed to initialize MapLibre:', err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
    };
  }, []);

  // Update Base Map Style
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    try {
      mapRef.current.setStyle(getActiveTileStyle(currentTileStyle));
    } catch (err) {
      console.warn('Base tile change note:', err);
    }
  }, [currentTileStyle, mapReady]);

  // Synchronize Map Markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    let isMounted = true;

    async function syncMarkers() {
      const maplibreglModule = await import('maplibre-gl');
      const maplibregl = resolveMapLibre(maplibreglModule);
      if (!isMounted || !mapRef.current) return;

      markersRef.current.forEach((m) => {
        try {
          const p = (m as any).getPopup?.();
          if (p && p.isOpen()) p.remove();
          m.remove();
        } catch {}
      });
      markersRef.current = [];
      markersMapRef.current.clear();

      // 1. Render Point Hazards & Citizen Ground Reports
      mapEvents.forEach((ev) => {
        const coords = getEventCenter(ev);
        if (!coords) return;

        const el = document.createElement('div');

        // Distinct styling for Community Reports vs Official Hazards
        if (ev.is_community_report) {
          el.className = 'map-acronym-marker map-citizen-marker';
          el.style.width = '30px';
          el.style.height = '30px';
          el.style.borderRadius = '8px';
          el.style.background = '#D97706';
          el.style.border = '2px solid #FFFFFF';
          el.innerText = 'CR';
          el.title = `Citizen Ground Report: ${ev.title}`;
        } else if (ev.acronym === 'EQ') {
          el.className = 'map-acronym-marker';
          const mag = ev.details?.magnitude ?? 4.2;
          const size = mag >= 5.5 ? 36 : mag >= 4.5 ? 30 : 26;
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.borderRadius = '50%';
          el.style.background = '#EA580C';
          el.style.border = '2px solid #FFFFFF';
          el.innerText = 'EQ';
          el.title = `USGS Earthquake: ${ev.title}`;
        } else if (ev.acronym === 'FL') {
          el.className = 'map-acronym-marker';
          el.style.width = '28px';
          el.style.height = '28px';
          el.style.borderRadius = '6px';
          el.style.background = ev.severity === 'ADVISORY' ? '#16A34A' : '#DC2626';
          el.style.border = '2px solid #FFFFFF';
          el.innerText = 'FL';
          el.title = `Flood Hazard: ${ev.title}`;
        } else if (ev.acronym === 'FR') {
          el.className = 'map-acronym-marker';
          el.style.width = '28px';
          el.style.height = '28px';
          el.style.borderRadius = '6px';
          el.style.background = '#B91C1C';
          el.style.border = '2px solid #FFFFFF';
          el.innerText = 'FR';
          el.title = `NASA Hotspot: ${ev.title}`;
        } else if (ev.acronym === 'ST') {
          el.className = 'map-acronym-marker';
          el.style.width = '28px';
          el.style.height = '28px';
          el.style.borderRadius = '6px';
          el.style.background = '#0284C7';
          el.style.border = '2px solid #FFFFFF';
          el.innerText = 'ST';
          el.title = `Severe Squall / Storm: ${ev.title}`;
        } else if (ev.acronym === 'CW') {
          el.className = 'map-acronym-marker';
          el.style.width = '28px';
          el.style.height = '28px';
          el.style.borderRadius = '6px';
          el.style.background = '#1E293B';
          el.style.border = '2px solid #FFFFFF';
          el.innerText = 'CW';
          el.title = `Cyclone Warning: ${ev.title}`;
        } else {
          el.className = 'map-acronym-marker';
          el.style.width = '28px';
          el.style.height = '28px';
          el.style.borderRadius = '6px';
          el.style.background = ev.severity === 'SEVERE' ? '#7F1D1D' : ev.severity === 'WARNING' ? '#EA580C' : '#16A34A';
          el.style.border = '2px solid #FFFFFF';
          el.innerText = ev.acronym;
          el.title = `${ev.acronym} Hazard: ${ev.title}`;
        }

        // Attach Rich Interactive Native Popup to Pin
        const popup = new maplibregl.Popup({
          offset: [0, -16],
          closeButton: true,
          closeOnClick: false,
          closeOnMove: false,
          maxWidth: '340px',
          className: 'suraksha-popup',
        }).setHTML(createHazardPopupHtml(ev));

        try {
          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([coords[0], coords[1]])
            .addTo(mapRef.current);

          (marker as any).getPopup = () => popup;

          el.style.cursor = 'pointer';
          const onMarkerClick = (e: Event) => {
            e.stopPropagation();
            e.preventDefault();

            // 1. Select the event for deep inspection
            setSelectedEvent(ev);

            // 2. Reset acronym filter so card is guaranteed visible in sidebar
            setSelectedAcronym('ALL');

            // 3. Automatically sync activeTab so card shows in sidebar list
            if (ev.is_community_report) {
              setActiveTab('community');
            } else if (['EQ', 'LS', 'TS', 'AV'].includes(ev.acronym)) {
              setActiveTab('earth');
            } else if (['FL', 'RF', 'CW', 'ST', 'CV', 'TC', 'HW', 'AQ'].includes(ev.acronym)) {
              setActiveTab('weather_flood');
            } else {
              setActiveTab('official');
            }

            // 4. Smooth camera pan
            flyToCoords(coords[0], coords[1], 10.5);

            // 5. Close all other popups
            markersRef.current.forEach((m) => {
              const p = m.getPopup();
              if (p && p.isOpen() && m !== marker) {
                p.remove();
              }
            });

            // 6. Open this marker's popup directly on map
            if (mapRef.current) {
              popup.setLngLat([coords[0], coords[1]]).addTo(mapRef.current);
            }
          };

          el.addEventListener('click', onMarkerClick);
          el.addEventListener('touchend', onMarkerClick);

          markersRef.current.push(marker);
          markersMapRef.current.set(ev.id, marker);
        } catch {}
      });

      // 2. Render Relief Shelters if enabled
      if (layerShelters) {
        VERIFIED_SHELTERS.forEach((sh) => {
          const el = document.createElement('div');
          el.className = 'map-acronym-marker';
          el.style.width = '26px';
          el.style.height = '26px';
          el.style.borderRadius = '6px';
          el.style.background = '#1F3440';
          el.style.border = '2px solid #FFFFFF';
          el.innerText = 'SH';
          el.title = `Relief Shelter Camp: ${sh.name}`;

          const popup = new maplibregl.Popup({
            offset: [0, -16],
            closeButton: true,
            closeOnClick: false,
            closeOnMove: false,
            maxWidth: '340px',
            className: 'suraksha-popup',
          }).setHTML(createShelterPopupHtml(sh));

          try {
            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat([sh.lng, sh.lat])
              .addTo(mapRef.current);

            (marker as any).getPopup = () => popup;

            el.style.cursor = 'pointer';
            const onShelterClick = (e: Event) => {
              e.stopPropagation();
              e.preventDefault();

              const shelterEvent = convertShelterToUnifiedEvent(sh);

              setSelectedEvent(shelterEvent);
              setSelectedAcronym('SH');
              flyToCoords(sh.lng, sh.lat, 11);

              markersRef.current.forEach((m) => {
                const p = m.getPopup();
                if (p && p.isOpen() && m !== marker) {
                  p.remove();
                }
              });

              if (mapRef.current) {
                popup.setLngLat([sh.lng, sh.lat]).addTo(mapRef.current);
              }
            };

            el.addEventListener('click', onShelterClick);
            el.addEventListener('touchend', onShelterClick);

            markersRef.current.push(marker);
            markersMapRef.current.set(sh.id, marker);
          } catch {}
        });
      }
    }

    syncMarkers();

    return () => {
      isMounted = false;
    };
  }, [mapEvents, layerShelters, mapReady, flyToCoords]);

  // Synchronize Active Selected Marker Styling in-place (without rebuilding markers)
  useEffect(() => {
    markersMapRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      if (!el) return;
      if (selectedEvent && id === selectedEvent.id) {
        el.style.transform = 'scale(1.28)';
        el.style.zIndex = '999';
        el.style.boxShadow = '0 0 0 3px #1F3440, 0 8px 24px rgba(0,0,0,0.35)';
      } else {
        el.style.transform = 'scale(1)';
        el.style.zIndex = '10';
        el.style.boxShadow = '';
      }
    });
  }, [selectedEvent]);

  // Smoothly scroll sidebar alerts list to the active card
  useEffect(() => {
    if (!selectedEvent) return;
    const timeoutId = setTimeout(() => {
      const cardEl = document.getElementById(`alert-card-${selectedEvent.id}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 120);
    return () => clearTimeout(timeoutId);
  }, [selectedEvent, activeTab]);

  // Reset Center
  const handleResetView = () => {
    flyToCoords(SOUTH_ASIA_CENTER.lng, SOUTH_ASIA_CENTER.lat, SOUTH_ASIA_CENTER.zoom);
    setSelectedCountry('ALL');
    setSelectedAcronym('ALL');
    setSelectedSeverity('ALL');
    setSelectedEvent(null);
  };

  // Share View
  const handleShareView = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    showToast('🔗 Live Risk Map link copied to clipboard!');
  };

  // Share User GPS Location
  const handleShareCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('⚠️ Geolocation not supported on this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const shareUrl = `${window.location.origin}/map?lat=${pos.coords.latitude.toFixed(4)}&lng=${pos.coords.longitude.toFixed(4)}&zoom=14`;
        navigator.clipboard.writeText(shareUrl);
        flyToCoords(pos.coords.longitude, pos.coords.latitude, 14);
        showToast('📍 Current location link copied to clipboard!');
      },
      () => {
        showToast('⚠️ Could not acquire GPS coordinates.');
      }
    );
  };

  // Zoom In / Out
  const handleZoom = (delta: number) => {
    if (!mapRef.current) return;
    const curZoom = mapRef.current.getZoom();
    mapRef.current.zoomTo(curZoom + delta, { duration: 300 });
  };

  // Fullscreen Toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className={styles.mapPage}>
      <Navbar />

      <main className={styles.dashboardContainer}>
        {/* Top Subtle Watermark & Operations Status Bar */}
        <section className={styles.topWatermarkBar} aria-label="National Operations Vision">
          <div className={styles.topBarLeft}>
            <span className={styles.topBarGridLabel}>🌐 National Operations GIS Grid</span>
            <span className={styles.topBarDot}>•</span>
            <span className={styles.topBarStatusPill}>● Live Multi-Agency Telemetry</span>
          </div>

          <div className={styles.mottoClean}>
            <svg className={styles.mottoMapIcon} viewBox="0 0 1000 1000">
              <path d={INDIA_SVG_PATH} fill="#4C8DA2" />
            </svg>
            <span>Safer Communities <span className={styles.mottoSub}>· A Stronger India</span></span>
          </div>
        </section>

        {/* Main Dashboard Grid */}
        <section
          className={`${styles.mainDashboardGrid} ${isDeckExpanded ? styles.mainDashboardGridExpanded : ''} ${!isRailOpen ? styles.mainDashboardGridCollapsed : ''}`}
          aria-label="Hazard Intelligence and Operations Map"
        >
          {/* ============================================================
              1. LEFT HAZARD INTELLIGENCE CARD (EXPANDABLE & SPACIOUS)
              ============================================================ */}
          {isRailOpen && (
            <aside className={styles.leftIntelligenceCard}>
              {/* Header with Title, Expand Width Toggle & Live Sync */}
              <div className={styles.leftCardHeader}>
                <div className={styles.headerTopRow}>
                  <div className={styles.titleWithDot}>
                    <span className={styles.livePulseDot}></span>
                    <h2 className={styles.leftCardTitle}>Live Hazard Intelligence</h2>
                  </div>
                  <div className={styles.headerActionsGroup}>
                    <button
                      type="button"
                      className={styles.expandDeckBtn}
                      onClick={() => {
                        setIsDeckExpanded(!isDeckExpanded);
                        setTimeout(() => { if (mapRef.current) mapRef.current.resize(); }, 320);
                      }}
                      title={isDeckExpanded ? "Switch to standard panel width (480px)" : "Expand panel width (640px) to see more details"}
                    >
                      {isDeckExpanded ? '⇲ Standard' : '⇱ Expand'}
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchHazardData()}
                      className={styles.syncBtn}
                      disabled={loading}
                      title="Synchronize live multi-agency feeds"
                    >
                      <span>↻</span>
                      <span>{loading ? 'Syncing...' : 'Sync'}</span>
                    </button>
                  </div>
                </div>

                {/* Compact Integrated Status Ribbon */}
                <div className={styles.deckStatusRibbon}>
                  <div className={styles.deckStatusLeft}>
                    <span>🌐 <strong>{selectedCountry === 'ALL' ? 'South Asia Grid' : `${selectedCountry} Sector`}</strong></span>
                    <span className={styles.onlineBadge}>● Online</span>
                  </div>
                  <span>⏱️ {lastRefreshedAt ? `Updated ${lastRefreshedAt}` : 'Connecting feeds...'}</span>
                </div>
              </div>

              {/* Sleek Compact SOS Beacon -> Directs to /sos */}
              <Link href="/sos" className={styles.sosBeaconCardBtn} title="Open Suraksha Emergency SOS Command Hub">
                <div className={styles.sosBeaconLeft}>
                  <div className={styles.sosIconWrapper}>🚨</div>
                  <div className={styles.sosTextWrap}>
                    <span className={styles.sosTitle}>SOS Emergency Beacon</span>
                    <span className={styles.sosSubtitle}>Broadcast GPS &amp; request emergency assistance</span>
                  </div>
                </div>
                <span className={styles.sosArrowBadge}>Launch Hub →</span>
              </Link>

              {/* Four Tabs: Official Alerts | Earth Events | Weather & Flood | Ground Reports */}
              <div className={styles.fourTabsRow} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'official'}
                  className={`${styles.tabPillBtn} ${activeTab === 'official' ? styles.tabPillBtnActive : ''}`}
                  onClick={() => {
                    setActiveTab('official');
                    setSelectedAcronym('ALL');
                  }}
                >
                  <span>Official</span>
                  <span className={styles.tabBadgeNumber}>{officialAlertsCount}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'earth'}
                  className={`${styles.tabPillBtn} ${activeTab === 'earth' ? styles.tabPillBtnActive : ''}`}
                  onClick={() => {
                    setActiveTab('earth');
                    setSelectedAcronym('ALL');
                  }}
                >
                  <span>Earth</span>
                  <span className={styles.tabBadgeNumber}>{earthEventsCount}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'weather_flood'}
                  className={`${styles.tabPillBtn} ${activeTab === 'weather_flood' ? styles.tabPillBtnActive : ''}`}
                  onClick={() => {
                    setActiveTab('weather_flood');
                    setSelectedAcronym('ALL');
                  }}
                >
                  <span>Weather</span>
                  <span className={styles.tabBadgeNumber}>{weatherEventsCount}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'community'}
                  className={`${styles.tabPillBtn} ${activeTab === 'community' ? styles.tabPillBtnActive : ''}`}
                  onClick={() => {
                    setActiveTab('community');
                    setSelectedAcronym('ALL');
                  }}
                >
                  <span>Ground</span>
                  <span className={styles.tabBadgeNumber}>{communityReportsCount}</span>
                </button>
              </div>

              {/* Filter Controls Section */}
              <div className={styles.filterControlsSection}>
                <div className={styles.filterControlsRow1}>
                  <select
                    className={styles.filterSelect}
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    aria-label="Filter by Country"
                  >
                    <option value="ALL">All South Asia</option>
                    <option value="India">India</option>
                    <option value="Nepal">Nepal</option>
                    <option value="Bangladesh">Bangladesh</option>
                    <option value="Bhutan">Bhutan</option>
                    <option value="Sri Lanka">Sri Lanka</option>
                  </select>

                  <select
                    className={styles.filterSelect}
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    aria-label="Filter by Severity"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="SEVERE">Severe</option>
                    <option value="WARNING">Warning</option>
                    <option value="WATCH">Watch</option>
                    <option value="ADVISORY">Advisory</option>
                  </select>

                  <div className={styles.timePillsRow}>
                    {(['24h', '7d', '30d'] as const).map((range) => (
                      <button
                        key={range}
                        type="button"
                        className={`${styles.timePill} ${timeRange === range ? styles.timePillActive : ''}`}
                        onClick={() => setTimeRange(range)}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.categoryChipsRow}>
                  {['ALL', 'EQ', 'FL', 'RF', 'CW', 'ST', 'FR', 'LS', 'AQ', 'AV', 'HW', 'SH', 'CR'].map((acro) => {
                    const meta = acro === 'ALL' ? null : HAZARD_ACRONYM_META[acro as HazardAcronym];
                    const tooltip = acro === 'ALL'
                      ? 'Show all multi-agency alerts'
                      : meta
                      ? `${acro}: ${meta.name} (${meta.primarySource})`
                      : acro;
                    return (
                      <button
                        key={acro}
                        type="button"
                        className={`${styles.catChip} ${selectedAcronym === acro ? styles.catChipActive : ''}`}
                        onClick={() => handleSelectBadge(acro)}
                        title={tooltip}
                      >
                        {acro}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Latest Alerts List Header */}
              <div className={styles.alertsListHeader}>
                <div className={styles.alertsHeaderTitleWrap}>
                  <span className={styles.alertsHeaderTitle}>
                    {selectedAcronym !== 'ALL'
                      ? `${selectedAcronym} • ${HAZARD_ACRONYM_META[selectedAcronym as HazardAcronym]?.name || 'Alerts'}`
                      : activeTab === 'community'
                      ? 'Ground Citizen Reports'
                      : activeTab === 'earth'
                      ? 'Earth & Seismic Events'
                      : activeTab === 'weather_flood'
                      ? 'Weather & Flood Alerts'
                      : 'Latest Official Alerts'}
                  </span>
                  <span className={styles.alertsCountBadge}>{sidebarEvents.length} Active</span>
                </div>
                <button
                  type="button"
                  className={styles.viewAllLink}
                  onClick={() => setIsAllCalamitiesModalOpen(true)}
                  title="Open National Calamities & Disasters Directory"
                >
                  View All Calamities →
                </button>
              </div>

              {/* Scrollable Alerts List */}
              <div className={styles.alertsScrollList}>
                {sidebarEvents.length === 0 ? (
                  selectedAcronym !== 'ALL' ? (
                    <div className={styles.sopIntelligenceCard}>
                      <div className={styles.sopTopRow}>
                        <div className={styles.sopAcronymBadge}>
                          {selectedAcronym}
                        </div>
                        <div className={styles.sopMetaWrap}>
                          <h4 className={styles.sopTitle}>
                            {HAZARD_ACRONYM_META[selectedAcronym as HazardAcronym]?.name || `${selectedAcronym} Hazard Protocol`}
                          </h4>
                          <span className={styles.sopSource}>
                            📡 {HAZARD_ACRONYM_META[selectedAcronym as HazardAcronym]?.primarySource || 'Official Multi-Agency Telemetry Grid'}
                          </span>
                        </div>
                        <span className={styles.sopStatusPill}>
                          🟢 0 Severe Alerts
                        </span>
                      </div>

                      <div className={styles.sopLiveTelemetryStatus}>
                        <span>● Real-Time Telemetry Active:</span> Multi-agency sensor grid operational. No active severe {HAZARD_ACRONYM_META[selectedAcronym as HazardAcronym]?.name || selectedAcronym} incidents currently triggered in the monitored South Asia perimeter.
                      </div>

                      <div className={styles.sopDescriptionBox}>
                        <strong>Threat Classification: </strong>
                        {HAZARD_ACRONYM_META[selectedAcronym as HazardAcronym]?.description || 'National disaster risk surveillance parameter.'}
                      </div>

                      <div className={styles.sopGuidelinesBox}>
                        <div className={styles.sopGuidelinesTitle}>🛡️ Standard Operational Directives (NDMA / SDMA SOP):</div>
                        <ul className={styles.sopGuidelinesList}>
                          {getSopDirectives(selectedAcronym).map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>

                      <div className={styles.sopActionsRow}>
                        <button
                          type="button"
                          className={styles.sopActionBtn}
                          onClick={() => handleSelectBadge('ALL')}
                        >
                          View All Grid Alerts
                        </button>
                        <Link href="/report" className={styles.sopReportBtn}>
                          Submit Observation
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#60717B', fontSize: '13px' }}>
                      {activeTab === 'community'
                        ? 'No active citizen ground reports for this region.'
                        : 'No alerts found for this filter criteria.'}
                    </div>
                  )
                ) : (
                  sidebarEvents.map((ev) => {
                    const isSelected = selectedEvent?.id === ev.id;

                    let badgeClass = styles.badgeEq;
                    if (ev.acronym === 'FL') badgeClass = styles.badgeFl;
                    else if (ev.acronym === 'CW') badgeClass = styles.badgeCw;
                    else if (ev.acronym === 'ST') badgeClass = styles.badgeSt;
                    else if (ev.acronym === 'FR') badgeClass = styles.badgeFr;
                    else if (ev.acronym === 'LS') badgeClass = styles.badgeLs;
                    else if (ev.acronym === 'HW') badgeClass = styles.badgeHw;
                    else if (ev.acronym === 'RF') badgeClass = styles.badgeRf;
                    else if (ev.severity === 'ADVISORY') badgeClass = styles.badgeNorm;

                    let sevClass = styles.sevWatch;
                    if (ev.severity === 'SEVERE') sevClass = styles.sevSevere;
                    else if (ev.severity === 'WARNING') sevClass = styles.sevHigh;
                    else if (ev.severity === 'ADVISORY') sevClass = styles.sevAdvisory;

                    return (
                      <div
                        key={ev.id}
                        id={`alert-card-${ev.id}`}
                        className={`${styles.alertCard} ${isSelected ? styles.alertCardSelected : ''}`}
                        onClick={() => {
                          setSelectedEvent(ev);
                          const center = getEventCenter(ev);
                          if (center && mapRef.current) {
                            flyToCoords(center[0], center[1], 10);
                            markersRef.current.forEach((m) => {
                              const p = m.getPopup();
                              if (p && p.isOpen()) p.remove();
                            });
                            const targetMarker = markersMapRef.current.get(ev.id);
                            if (targetMarker) {
                              const p = targetMarker.getPopup();
                              if (p) p.setLngLat(center).addTo(mapRef.current);
                            }
                          }
                        }}
                      >
                        <div className={styles.cardHeaderRow}>
                          <div
                            className={`${styles.cardAcronymSquare} ${badgeClass}`}
                            style={ev.is_community_report ? { background: '#D97706', cursor: 'pointer' } : { cursor: 'pointer' }}
                            title={`Filter and inspect ${ev.acronym} hazards`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectBadge(ev.is_community_report ? 'CR' : ev.acronym);
                            }}
                          >
                            {ev.is_community_report ? 'CR' : ev.acronym}
                          </div>

                          <div className={styles.cardHeaderMeta}>
                            <h3 className={styles.cardHeadline}>{ev.title}</h3>
                            <div className={styles.cardLocationRow}>
                              <span>📍</span>
                              <span>{ev.district ? `${ev.district}, ` : ''}{ev.state ? `${ev.state}, ` : ''}{ev.country}</span>
                            </div>
                          </div>

                          <span className={`${styles.severityChip} ${sevClass}`}>
                            {ev.severity}
                          </span>
                        </div>

                        {/* Dedicated Problem & Telemetry Highlight Box */}
                        <div className={styles.cardProblemBox}>
                          {ev.details?.magnitude !== undefined && (
                            <div className={styles.problemMetricRow}>
                              <span className={styles.problemLabel}>⚡ Seismic Event:</span>
                              <span className={styles.problemValue}>Magnitude <strong>M {ev.details.magnitude.toFixed(1)}</strong> · Depth: <strong>{ev.details.depthKm || 10} km</strong></span>
                            </div>
                          )}
                          {ev.details?.waterDepthFeet !== undefined && (
                            <div className={styles.problemMetricRow}>
                              <span className={styles.problemLabel}>🌊 Inundation:</span>
                              <span className={styles.problemValue}>Observed <strong>{ev.details.waterDepthFeet} ft</strong> ({Math.round(ev.details.waterDepthFeet * 30.48)} cm) water depth</span>
                            </div>
                          )}
                          {ev.details?.rainfallRateMmH !== undefined && (
                            <div className={styles.problemMetricRow}>
                              <span className={styles.problemLabel}>🌧️ Precipitation:</span>
                              <span className={styles.problemValue}><strong>{ev.details.rainfallRateMmH} mm/h</strong> monsoon cloudburst surge</span>
                            </div>
                          )}
                          {ev.details?.riverBasin && (
                            <div className={styles.problemMetricRow}>
                              <span className={styles.problemLabel}>🏞️ River Basin:</span>
                              <span className={styles.problemValue}>{ev.details.riverBasin}</span>
                            </div>
                          )}
                          {ev.details?.moderationStatus && (
                            <div className={styles.problemMetricRow}>
                              <span className={styles.problemLabel}>🛡️ Verification:</span>
                              <span className={styles.problemValue} style={{ color: ev.confidence === 'VERIFIED' ? '#16A34A' : '#D97706', fontWeight: 700 }}>
                                ● {ev.details.moderationStatus}
                              </span>
                            </div>
                          )}
                          {ev.is_community_report && ev.details?.safetyGuidance && (
                            <div className={styles.problemMetricRow}>
                              <span className={styles.problemLabel}>⚠️ Observation:</span>
                              <span className={styles.problemValue}>{ev.details.safetyGuidance}</span>
                            </div>
                          )}
                          {!ev.is_community_report && ev.details?.magnitude === undefined && !ev.details?.waterDepthFeet && !ev.details?.rainfallRateMmH && !ev.details?.riverBasin && (
                            <div className={styles.problemMetricRow}>
                              <span className={styles.problemLabel}>⚠️ Hazard Alert:</span>
                              <span className={styles.problemValue}>{ev.details?.safetyGuidance?.slice(0, 95) || 'Telemetry recorded by official disaster monitoring network.'}</span>
                            </div>
                          )}
                        </div>

                        {/* Card Actions & Source Footer */}
                        <div className={styles.cardFooterRow}>
                          <span className={styles.cardFreshness}>
                            ⏱️ {ev.freshness || (ev.is_community_report ? 'Citizen Ground Submission' : `${ev.source} Telemetry`)}
                          </span>
                          <div className={styles.cardActionBtns}>
                            <button
                              type="button"
                              className={styles.cardLocateBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(ev);
                                const center = getEventCenter(ev);
                                if (center) {
                                  flyToCoords(center[0], center[1], 10);
                                  const targetMarker = markersMapRef.current.get(ev.id);
                                  if (targetMarker) {
                                    const p = targetMarker.getPopup();
                                    if (p && !p.isOpen()) targetMarker.togglePopup();
                                  }
                                }
                              }}
                            >
                              Locate 🎯
                            </button>
                            <a
                              href={ev.source_url}
                              target={ev.source_url.startsWith('http') ? '_blank' : undefined}
                              rel={ev.source_url.startsWith('http') ? 'noopener noreferrer' : undefined}
                              className={styles.cardSourceLink}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ev.is_community_report ? 'Track Report ↗' : `${ev.source} ↗`}
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          )}

          {/* ============================================================
              2. RIGHT INTERACTIVE MAP CARD
              ============================================================ */}
          <div className={styles.mapCard}>
            {/* MapLibre Canvas */}
            <div ref={mapContainerRef} className={styles.mapCanvas} />

            {/* Top Floating Map Toolbar */}
            <div className={styles.topFloatingToolbar}>
              <button
                type="button"
                className={styles.collapseToggleBtn}
                onClick={() => {
                  setIsRailOpen(!isRailOpen);
                  setTimeout(() => { if (mapRef.current) mapRef.current.resize(); }, 320);
                }}
                title={isRailOpen ? 'Collapse Left Intelligence Rail' : 'Expand Left Intelligence Rail'}
              >
                {isRailOpen ? '◀' : '▶'}
              </button>

              <div className={styles.searchBoxWrap}>
                <span className={styles.searchIconSvg}>🔍</span>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search Indian cities, districts, or risk corridors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                {isSearching && searchResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '46px',
                      left: 0,
                      right: 0,
                      background: '#FFFFFF',
                      border: '1.5px solid #C8E3EA',
                      borderRadius: '14px',
                      boxShadow: '0 8px 24px rgba(31, 52, 64, 0.12)',
                      zIndex: 35,
                      maxHeight: '280px',
                      overflowY: 'auto',
                    }}
                  >
                    {searchResults.map((loc) => (
                      <div
                        key={loc.id}
                        onClick={() => {
                          flyToCoords(loc.lng, loc.lat, loc.zoom);
                          setSearchQuery(loc.name);
                          setIsSearching(false);
                        }}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid #EDF5F8',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '13px', color: '#1F3440' }}>{loc.name}</strong>
                          <div style={{ fontSize: '11px', color: '#60717B' }}>{loc.state} &bull; {loc.category}</div>
                        </div>
                        <span style={{ fontSize: '10px', background: '#EBF4F7', color: '#4C8DA2', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          {loc.type === 'DISASTER_PRONE' ? 'High Risk' : 'Metro'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Layers Popover Button */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`${styles.toolbarActionBtn} ${showLayerMenu ? styles.toolbarActionBtnActive : ''}`}
                  onClick={() => {
                    setShowLayerMenu(!showLayerMenu);
                    setShowBaseMapMenu(false);
                    setShowFeedsMenu(false);
                  }}
                >
                  <span>Layers</span>
                  <span>▾</span>
                </button>

                {showLayerMenu && (
                  <div className={styles.floatingPopover}>
                    <h4 className={styles.popoverTitle}>Hazard Layer Feeds</h4>
                    <label className={styles.layerCheckboxLabel}>
                      <span>Risk Polygons (NDMA / IMD)</span>
                      <input
                        type="checkbox"
                        checked={layerPolygons}
                        onChange={(e) => setLayerPolygons(e.target.checked)}
                      />
                    </label>
                    <label className={styles.layerCheckboxLabel}>
                      <span>Earthquakes (USGS EQ)</span>
                      <input
                        type="checkbox"
                        checked={layerEarthquakes}
                        onChange={(e) => setLayerEarthquakes(e.target.checked)}
                      />
                    </label>
                    <label className={styles.layerCheckboxLabel}>
                      <span>Weather &amp; Floods (FL / ST)</span>
                      <input
                        type="checkbox"
                        checked={layerWeatherFlood}
                        onChange={(e) => setLayerWeatherFlood(e.target.checked)}
                      />
                    </label>
                    <label className={styles.layerCheckboxLabel}>
                      <span>Thermal Fires (NASA FIRMS)</span>
                      <input
                        type="checkbox"
                        checked={layerFires}
                        onChange={(e) => setLayerFires(e.target.checked)}
                      />
                    </label>
                    <label className={styles.layerCheckboxLabel}>
                      <span>Relief Shelters (Evacuation)</span>
                      <input
                        type="checkbox"
                        checked={layerShelters}
                        onChange={(e) => setLayerShelters(e.target.checked)}
                      />
                    </label>
                    <label className={styles.layerCheckboxLabel}>
                      <span>Citizen Reports (Public CR)</span>
                      <input
                        type="checkbox"
                        checked={layerCommunity}
                        onChange={(e) => setLayerCommunity(e.target.checked)}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Base Map Style Popover Button */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`${styles.toolbarActionBtn} ${showBaseMapMenu ? styles.toolbarActionBtnActive : ''}`}
                  onClick={() => {
                    setShowBaseMapMenu(!showBaseMapMenu);
                    setShowLayerMenu(false);
                    setShowFeedsMenu(false);
                  }}
                >
                  <span>Base Map</span>
                  <span>▾</span>
                </button>

                {showBaseMapMenu && (
                  <div className={styles.floatingPopover}>
                    <h4 className={styles.popoverTitle}>Map Tile Styles</h4>
                    {Object.values(TILE_STYLES).map((ts) => (
                      <button
                        key={ts.id}
                        type="button"
                        onClick={() => {
                          setCurrentTileStyle(ts.id);
                          setShowBaseMapMenu(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: currentTileStyle === ts.id ? '#1F3440' : '#FFFFFF',
                          color: currentTileStyle === ts.id ? '#FFFFFF' : '#1F3440',
                          border: 'none',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginBottom: '3px',
                        }}
                      >
                        {ts.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Legend Toggle */}
              <button
                type="button"
                className={`${styles.toolbarActionBtn} ${showLegend ? styles.toolbarActionBtnActive : ''}`}
                onClick={() => setShowLegend(!showLegend)}
              >
                Legend
              </button>

              {/* Live Feeds Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`${styles.toolbarActionBtn} ${showFeedsMenu ? styles.toolbarActionBtnActive : ''}`}
                  onClick={() => {
                    setShowFeedsMenu(!showFeedsMenu);
                    setShowLayerMenu(false);
                    setShowBaseMapMenu(false);
                  }}
                >
                  <span className={styles.livePulseDot} style={{ width: '6px', height: '6px' }} />
                  <span>Live Feeds ({liveFeedsCount})</span>
                  <span>▾</span>
                </button>

                {showFeedsMenu && (
                  <div className={styles.floatingPopover} style={{ width: '340px' }}>
                    <h4 className={styles.popoverTitle}>Active Monitoring Feeds</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(sourcesHealth.length > 0
                        ? sourcesHealth
                        : [
                            { id: 'usgs', name: 'USGS Real-Time Earthquakes', status: 'HEALTHY' },
                            { id: 'isro', name: 'ISRO Bhuvan Flood Mapping', status: 'HEALTHY' },
                            { id: 'imd', name: 'IMD Doppler Radar & Precipitation', status: 'HEALTHY' },
                            { id: 'ndma', name: 'NDMA SACHET Emergency Warnings', status: 'HEALTHY' },
                            { id: 'nepal', name: 'Nepal DHM & NDRRMA Telemetry', status: 'HEALTHY' },
                            { id: 'nasa', name: 'NASA FIRMS Fire Sensing', status: 'HEALTHY' },
                            { id: 'gdacs', name: 'GDACS Global Disaster System', status: 'HEALTHY' },
                            { id: 'cpcb', name: 'CPCB National Air Quality Index', status: 'HEALTHY' },
                          ]
                      ).map((sh) => (
                        <div key={sh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                          <span style={{ fontWeight: 600, color: '#1F3440' }}>{sh.name}</span>
                          <span style={{ color: '#4C8B71', fontWeight: 700 }}>● Live</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Reset View */}
              <button
                type="button"
                className={styles.toolbarActionBtn}
                onClick={handleResetView}
                title="Reset Map to South Asia"
              >
                ⟲ Reset
              </button>

              {/* Share */}
              <button
                type="button"
                className={styles.toolbarActionBtn}
                onClick={handleShareView}
                title="Share Map Link"
              >
                🔗 Share
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                className={styles.toolbarActionBtn}
                onClick={handleToggleFullscreen}
                title="Toggle Fullscreen"
              >
                ⛶
              </button>
            </div>

            {/* Floating Right Map Controls */}
            <div className={styles.rightMapControls}>
              <button
                type="button"
                className={styles.mapCircleBtn}
                onClick={handleShareCurrentLocation}
                title="Locate Me (GPS)"
              >
                🎯
              </button>
              <button
                type="button"
                className={styles.mapCircleBtn}
                onClick={() => handleZoom(1)}
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                className={styles.mapCircleBtn}
                onClick={() => handleZoom(-1)}
                title="Zoom Out"
              >
                –
              </button>
            </div>

            {/* Floating Vertical Emergency Action Pill */}
            {showEmergencyBar ? (
              <aside className={styles.floatingEmergencyPill} aria-label="Emergency Quick Actions">
                <Link href="/sos" className={styles.emergencySosCircleBtn} title="Suraksha SOS Emergency Hub">
                  <span className={styles.sosCircleIcon}>🚨</span>
                  <span style={{ fontSize: '10px', fontWeight: 900, marginTop: '2px' }}>SOS</span>
                </Link>
                <Link href="/sos" className={styles.emergencySosSubtext}>
                  Need<br />Help?
                </Link>

                <Link href="/report" className={styles.sideActionItem} title="Report an observed hazard">
                  <span className="icon">📢</span>
                  <span>Report<br />Now</span>
                </Link>

                <button
                  type="button"
                  className={styles.sideActionItem}
                  onClick={handleShareCurrentLocation}
                  title="Share your GPS coordinates"
                >
                  <span className="icon">📍</span>
                  <span>Share<br />Location</span>
                </button>

                <Link href="/sos?tab=helpline" className={styles.sideActionItem} title="National Helplines Directory">
                  <span className="icon">📞</span>
                  <span>Emergency<br />Contacts</span>
                </Link>

                <button
                  type="button"
                  className={styles.sideCloseBtn}
                  onClick={() => setShowEmergencyBar(false)}
                  title="Minimize Emergency Bar"
                >
                  ✕
                </button>
              </aside>
            ) : (
              <button
                type="button"
                className={styles.emergencySosCircleBtn}
                style={{ position: 'absolute', right: 16, top: '50%', width: 44, height: 44, zIndex: 25 }}
                onClick={() => setShowEmergencyBar(true)}
                title="Restore Emergency Quick Bar"
              >
                🚨
              </button>
            )}

            {/* Floating Bottom Bar on Map */}
            <div className={styles.floatingBottomBar}>
              {showLegend && (
                <div className={styles.floatingLegendPill}>
                  {[
                    { acro: 'EQ', label: 'Earthquake', color: '#EA580C' },
                    { acro: 'FL', label: 'Flood', color: '#DC2626' },
                    { acro: 'RF', label: 'Rainfall', color: '#2563EB' },
                    { acro: 'CW', label: 'Cyclone', color: '#1E293B' },
                    { acro: 'LS', label: 'Landslide', color: '#7C3AED' },
                    { acro: 'ST', label: 'Storm', color: '#0284C7' },
                    { acro: 'FR', label: 'Fire', color: '#B91C1C' },
                    { acro: 'AQ', label: 'Air Quality', color: '#059669' },
                    { acro: 'SH', label: 'Shelters', color: '#1F3440' },
                    { acro: 'CR', label: 'Ground Reports', color: '#D97706' },
                    { acro: 'ALL', label: 'All Normal', color: '#16A34A' },
                  ].map((item) => (
                    <button
                      key={item.acro}
                      type="button"
                      className={`${styles.legendDotItem} ${selectedAcronym === item.acro ? styles.legendDotItemActive : ''}`}
                      onClick={() => handleSelectBadge(item.acro)}
                      title={`Click to filter and view ${item.label} (${item.acro})`}
                    >
                      <span className={styles.legendDot} style={{ background: item.color }}></span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.floatingWindowPill}>
                <span>Window:</span>
                {(['24h', '7d', '30d'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.timePill} ${timeRange === r ? styles.timePillActive : ''}`}
                    onClick={() => setTimeRange(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Event Inspection Drawer or SOP Guidance Drawer */}
            {selectedEvent ? (() => {
              const center = getEventCenter(selectedEvent);
              return (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '56px',
                    left: '16px',
                    maxWidth: '430px',
                    width: 'calc(100% - 32px)',
                    background: '#FFFFFF',
                    border: '1.5px solid #C8E3EA',
                    borderRadius: '16px',
                    boxShadow: '0 12px 36px rgba(31, 52, 64, 0.18)',
                    padding: '16px 18px',
                    zIndex: 30,
                    animation: 'fadeIn 0.2s ease-out',
                  }}
                >
                  {/* Top Bar: Acronym Badge, Source & Close */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          background: selectedEvent.acronym === 'SH' ? '#E8F5EE' : selectedEvent.is_community_report ? '#FEF3C7' : '#EBF4F7',
                          color: selectedEvent.acronym === 'SH' ? '#2E7D32' : selectedEvent.is_community_report ? '#D97706' : '#4C8DA2',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {selectedEvent.acronym === 'SH'
                          ? 'SH • ACTIVE RELIEF CAMP'
                          : selectedEvent.is_community_report
                          ? 'CR • CITIZEN GROUND REPORT'
                          : `${selectedEvent.acronym} • ${selectedEvent.severity}`}
                      </span>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: '#F0F4F7',
                          color: '#60717B',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {selectedEvent.confidence === 'VERIFIED' ? '✓ VERIFIED' : selectedEvent.status}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedEvent(null)}
                      style={{
                        background: '#F0F4F7',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: '#60717B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Close inspection"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Title & Coordinates */}
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#1F3440', margin: '0 0 4px', lineHeight: 1.3 }}>
                    {selectedEvent.title}
                  </h4>
                  <div style={{ fontSize: '12px', color: '#60717B', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    <span>📍 {selectedEvent.district ? `${selectedEvent.district}, ` : ''}{selectedEvent.state ? `${selectedEvent.state}, ` : ''}{selectedEvent.country}</span>
                    {center && (
                      <span style={{ fontSize: '11px', color: '#4C8DA2', fontWeight: 600 }}>
                        • ({center[1].toFixed(3)}°N, {center[0].toFixed(3)}°E)
                      </span>
                    )}
                  </div>

                  {/* Problem & Telemetry Highlight Box */}
                  <div
                    style={{
                      background: '#F8FBFC',
                      border: '1px solid #E2EFF3',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      marginBottom: '10px',
                      fontSize: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                    }}
                  >
                    {selectedEvent.details?.magnitude !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#60717B', fontWeight: 600 }}>⚡ Seismic Magnitude:</span>
                        <span style={{ color: '#EA580C', fontWeight: 800 }}>M {selectedEvent.details.magnitude.toFixed(1)} (Depth: {selectedEvent.details.depthKm || 10} km)</span>
                      </div>
                    )}
                    {selectedEvent.details?.waterDepthFeet !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#60717B', fontWeight: 600 }}>🌊 Inundation Depth:</span>
                        <span style={{ color: '#DC2626', fontWeight: 800 }}>{selectedEvent.details.waterDepthFeet} ft ({Math.round(selectedEvent.details.waterDepthFeet * 30.48)} cm)</span>
                      </div>
                    )}
                    {selectedEvent.details?.riverBasin && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#60717B', fontWeight: 600 }}>🌊 River Basin:</span>
                        <span style={{ color: '#0284C7', fontWeight: 800 }}>{selectedEvent.details.riverBasin}</span>
                      </div>
                    )}
                    {selectedEvent.details?.aqi !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#60717B', fontWeight: 600 }}>🌫️ Air Quality Index:</span>
                        <span style={{ color: '#059669', fontWeight: 800 }}>AQI {Math.round(selectedEvent.details.aqi)} (PM2.5: {selectedEvent.details.pm25 || 0} µg/m³)</span>
                      </div>
                    )}
                    {selectedEvent.details?.windSpeedKmh !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#60717B', fontWeight: 600 }}>💨 Wind Velocity:</span>
                        <span style={{ color: '#0284C7', fontWeight: 800 }}>{selectedEvent.details.windSpeedKmh} km/h</span>
                      </div>
                    )}
                    {selectedEvent.details?.brightnessTempK !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#60717B', fontWeight: 600 }}>🔥 Thermal Hotspot:</span>
                        <span style={{ color: '#DC2626', fontWeight: 800 }}>{selectedEvent.details.brightnessTempK} K ({selectedEvent.details.satellite || 'VIIRS'})</span>
                      </div>
                    )}
                    {selectedEvent.details?.rainfallRateMmH !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#60717B', fontWeight: 600 }}>🌧️ Rainfall Surge:</span>
                        <span style={{ color: '#0284C7', fontWeight: 800 }}>{selectedEvent.details.rainfallRateMmH} mm/h</span>
                      </div>
                    )}
                    {selectedEvent.details?.moderationStatus && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#60717B', fontWeight: 600 }}>🛡️ Tactical Verification:</span>
                        <span style={{ color: selectedEvent.confidence === 'VERIFIED' ? '#2E7D32' : '#D97706', fontWeight: 800 }}>● {selectedEvent.details.moderationStatus}</span>
                      </div>
                    )}
                    {selectedEvent.details?.actionCategory && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#60717B', fontWeight: 600 }}>🚨 Deployment:</span>
                        <span style={{ color: '#1F3440', fontWeight: 700 }}>{selectedEvent.details.actionCategory}</span>
                      </div>
                    )}
                    {selectedEvent.freshness && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#8FA2AD', fontSize: '11px' }}>🕒 Telemetry Freshness:</span>
                        <span style={{ color: '#60717B', fontSize: '11px', fontWeight: 600 }}>{selectedEvent.freshness}</span>
                      </div>
                    )}
                  </div>

                  {/* Safety Guidance */}
                  <p style={{ fontSize: '12px', color: '#1F3440', margin: '0 0 12px', lineHeight: 1.45 }}>
                    <strong style={{ color: '#D76D63' }}>Directives: </strong>
                    {selectedEvent.details?.safetyGuidance || 'Follow local district disaster management guidelines and keep emergency communications clear.'}
                  </p>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selectedEvent.acronym === 'SH' ? (
                      <a
                        href={`tel:${selectedEvent.details?.contact || '112'}`}
                        style={{
                          flex: 1,
                          background: '#1F3440',
                          color: '#FFFFFF',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textAlign: 'center',
                          textDecoration: 'none',
                        }}
                      >
                        📞 Call Desk ({selectedEvent.details?.contact || '112'})
                      </a>
                    ) : (
                      <a
                        href={selectedEvent.source_url}
                        target={selectedEvent.source_url.startsWith('http') ? '_blank' : undefined}
                        rel={selectedEvent.source_url.startsWith('http') ? 'noopener noreferrer' : undefined}
                        style={{
                          flex: 1,
                          background: '#1F3440',
                          color: '#FFFFFF',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textAlign: 'center',
                          textDecoration: 'none',
                        }}
                      >
                        {selectedEvent.is_community_report ? 'Track Report ↗' : `${selectedEvent.source} ↗`}
                      </a>
                    )}

                    {center && (
                      <button
                        type="button"
                        onClick={() => {
                          flyToCoords(center[0], center[1], 11);
                          const targetMarker = markersMapRef.current.get(selectedEvent.id);
                          if (targetMarker && mapRef.current) {
                            markersRef.current.forEach((m) => {
                              const p = m.getPopup();
                              if (p && p.isOpen()) p.remove();
                            });
                            const p = targetMarker.getPopup();
                            if (p) p.setLngLat(center).addTo(mapRef.current);
                          }
                        }}
                        style={{
                          background: '#EEF5F8',
                          border: '1.5px solid #C8E3EA',
                          color: '#1F3440',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Center map on this incident"
                      >
                        🎯 Center
                      </button>
                    )}

                    <Link
                      href="/report"
                      style={{
                        background: '#FFFFFF',
                        border: '1.5px solid #C8E3EA',
                        color: '#1F3440',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      Update
                    </Link>
                  </div>
                </div>
              );
            })() : selectedAcronym !== 'ALL' ? (() => {
              const meta = HAZARD_ACRONYM_META[selectedAcronym as HazardAcronym];
              const directives = getSopDirectives(selectedAcronym);
              return (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '56px',
                    left: '16px',
                    maxWidth: '430px',
                    width: 'calc(100% - 32px)',
                    background: '#FFFFFF',
                    border: '1.5px solid #C8E3EA',
                    borderRadius: '16px',
                    boxShadow: '0 12px 36px rgba(31, 52, 64, 0.18)',
                    padding: '16px 18px',
                    zIndex: 30,
                    animation: 'fadeIn 0.2s ease-out',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          background: '#1F3440',
                          color: '#FFFFFF',
                          padding: '3px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {selectedAcronym} • HAZARD PROTOCOL
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: '#E8F5EE',
                          color: '#2E7D32',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        ● 0 SEVERE ALERTS
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedAcronym('ALL')}
                      style={{
                        background: '#F0F4F7',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: '#60717B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Reset badge filter"
                    >
                      ✕
                    </button>
                  </div>

                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#1F3440', margin: '0 0 4px', lineHeight: 1.3 }}>
                    {meta?.name || `${selectedAcronym} Hazard Surveillance`}
                  </h4>
                  <div style={{ fontSize: '12px', color: '#60717B', marginBottom: '10px' }}>
                    📡 Official Feed: {meta?.primarySource || 'National Multi-Agency Grid'}
                  </div>

                  <div
                    style={{
                      background: '#F8FBFC',
                      border: '1px solid #E2EFF3',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      marginBottom: '10px',
                      fontSize: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#60717B', fontWeight: 600 }}>📡 Telemetry Status:</span>
                      <span style={{ color: '#2E7D32', fontWeight: 800 }}>Continuous Surveillance Active</span>
                    </div>
                    <div style={{ color: '#44545F', fontSize: '11.5px', lineHeight: 1.4 }}>
                      {meta?.description || 'Active multi-hazard surveillance parameter.'}
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#1F3440', margin: '0 0 12px', lineHeight: 1.45 }}>
                    <strong style={{ color: '#D76D63' }}>Standard Operating Procedure: </strong>
                    {directives[0] || 'Follow local district disaster management directives.'}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsAllCalamitiesModalOpen(true)}
                      style={{
                        flex: 1,
                        background: '#1F3440',
                        color: '#FFFFFF',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      View All Calamities ↗
                    </button>
                    <Link
                      href="/report"
                      style={{
                        background: '#FFFFFF',
                        border: '1.5px solid #C8E3EA',
                        color: '#1F3440',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      Report Observation
                    </Link>
                  </div>
                </div>
              );
            })() : null}
          </div>
        </section>

        {/* ============================================================
            3. BOTTOM SUMMARY KPI CARDS ROW (5 Cards)
            ============================================================ */}
        <section className={styles.bottomKpiRow} aria-label="National Hazard Metrics Summary">
          {/* Card 1: Active Alerts */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiCardTop}>
              <div className={`${styles.kpiIconSquare} ${styles.kpiIconAlerts}`}>⚠️</div>
              <div className={styles.kpiCardNumbers}>
                <span className={styles.kpiNumber}>{officialAlertsCount}</span>
                <span className={styles.kpiLabel}>Active Alerts</span>
              </div>
            </div>
            <svg className={styles.sparklineSvg} viewBox="0 0 100 24" preserveAspectRatio="none">
              <path d="M0,18 Q20,6 45,14 T80,8 T100,12" fill="none" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Card 2: Earth Events */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiCardTop}>
              <div className={`${styles.kpiIconSquare} ${styles.kpiIconEarth}`}>⚙️</div>
              <div className={styles.kpiCardNumbers}>
                <span className={styles.kpiNumber}>{earthEventsCount}</span>
                <span className={styles.kpiLabel}>Earth Events</span>
              </div>
            </div>
            <svg className={styles.sparklineSvg} viewBox="0 0 100 24" preserveAspectRatio="none">
              <path d="M0,14 Q25,20 50,8 T75,16 T100,10" fill="none" stroke="#EA580C" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Card 3: Weather & Flood */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiCardTop}>
              <div className={`${styles.kpiIconSquare} ${styles.kpiIconWeather}`}>🌧️</div>
              <div className={styles.kpiCardNumbers}>
                <span className={styles.kpiNumber}>{weatherEventsCount}</span>
                <span className={styles.kpiLabel}>Weather &amp; Flood</span>
              </div>
            </div>
            <svg className={styles.sparklineSvg} viewBox="0 0 100 24" preserveAspectRatio="none">
              <path d="M0,16 Q20,12 40,18 T70,9 T100,15" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Card 4: Live Data Feeds */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiCardTop}>
              <div className={`${styles.kpiIconSquare} ${styles.kpiIconFeeds}`}>📡</div>
              <div className={styles.kpiCardNumbers}>
                <span className={styles.kpiNumber}>{liveFeedsCount}</span>
                <span className={styles.kpiLabel}>Live Data Feeds</span>
              </div>
            </div>
            <svg className={styles.sparklineSvg} viewBox="0 0 100 24" preserveAspectRatio="none">
              <path d="M0,12 Q20,16 45,7 T80,14 T100,10" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Card 5: National Coverage */}
          <div className={styles.nationalCoverageCard}>
            <div className={styles.natCoverageLeft}>
              <div className={styles.indiaMapIconWrap}>
                <svg viewBox="0 0 1000 1000" width="26" height="26" fill="#4C8DA2">
                  <path d={INDIA_SVG_PATH} />
                </svg>
              </div>
              <div className={styles.natCoverageContent}>
                <h4>National Coverage</h4>
                <p>Real-time monitoring across India and neighbouring regions.</p>
              </div>
            </div>
            <Link href="/about" className={styles.natCoverageCircleBtn} title="Learn about National Network Coverage">
              →
            </Link>
          </div>
        </section>

        {/* Global Toast Feedback */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#1F3440',
              color: '#FFFFFF',
              padding: '10px 20px',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 700,
              boxShadow: '0 8px 24px rgba(31, 52, 64, 0.25)',
              zIndex: 9999,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {toastMessage}
          </div>
        )}

        {/* ============================================================
            4. ALL CALAMITIES & DISASTER INTELLIGENCE DIRECTORY MODAL
            ============================================================ */}
        {isAllCalamitiesModalOpen && (
          <div
            className={styles.allCalamitiesOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsAllCalamitiesModalOpen(false);
            }}
          >
            <div
              className={styles.allCalamitiesCard}
              role="dialog"
              aria-modal="true"
              aria-label="National Calamities and Disasters Directory"
            >
              {/* Modal Header */}
              <div className={styles.modalHeader}>
                <div className={styles.modalHeaderTop}>
                  <div className={styles.modalHeaderLeft}>
                    <span className={styles.modalLivePill}>● Live Telemetry</span>
                    <h3 className={styles.modalTitle}>National Calamities &amp; Disaster Directory</h3>
                  </div>
                  <button
                    type="button"
                    className={styles.modalCloseBtn}
                    onClick={() => setIsAllCalamitiesModalOpen(false)}
                    title="Close Directory"
                  >
                    ✕
                  </button>
                </div>

                {/* Real-time Search Input */}
                <div className={styles.modalSearchRow}>
                  <span className={styles.modalSearchIcon}>🔍</span>
                  <input
                    type="text"
                    className={styles.modalSearchInput}
                    placeholder="Search calamities by region, district, agency, or hazard type..."
                    value={calamitiesSearch}
                    onChange={(e) => setCalamitiesSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Category Filter Chips */}
                <div className={styles.modalFiltersRow}>
                  {[
                    { id: 'ALL', label: `All Calamities (${allCalamitiesList.length})` },
                    { id: 'EQ', label: `Earthquakes (${allCalamitiesList.filter((c) => c.acronym === 'EQ').length})` },
                    { id: 'FL', label: `Floods (${allCalamitiesList.filter((c) => c.acronym === 'FL').length})` },
                    { id: 'RF', label: `Cloudburst / Rain (${allCalamitiesList.filter((c) => c.acronym === 'RF').length})` },
                    { id: 'ST', label: `Storms (${allCalamitiesList.filter((c) => c.acronym === 'ST').length})` },
                    { id: 'FR', label: `Fires (${allCalamitiesList.filter((c) => c.acronym === 'FR').length})` },
                    { id: 'CR', label: `Citizen Reports (${allCalamitiesList.filter((c) => c.is_community_report).length})` },
                    { id: 'SH', label: `Relief Shelters (${VERIFIED_SHELTERS.length})` },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`${styles.modalCatChip} ${calamitiesCategory === cat.id ? styles.modalCatChipActive : ''}`}
                      onClick={() => setCalamitiesCategory(cat.id as any)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Scrollable Body */}
              <div className={styles.modalBody}>
                {filteredCalamitiesList.length === 0 ? (
                  <div className={styles.emptyStateBox}>
                    No calamity or emergency records found matching your search query.
                  </div>
                ) : (
                  <div className={styles.modalCalamityGrid}>
                    {filteredCalamitiesList.map((item) => {
                      let badgeBg = '#16A34A';
                      if (item.acronym === 'EQ') badgeBg = '#EA580C';
                      else if (item.acronym === 'FL') badgeBg = item.severity === 'ADVISORY' ? '#16A34A' : '#DC2626';
                      else if (item.acronym === 'FR') badgeBg = '#B91C1C';
                      else if (item.acronym === 'ST') badgeBg = '#0284C7';
                      else if (item.acronym === 'SH') badgeBg = '#1F3440';
                      if (item.is_community_report) badgeBg = '#D97706';

                      return (
                        <div key={item.id} className={styles.modalItemCard}>
                          <div className={styles.modalItemTop}>
                            <div className={styles.modalItemAcronym} style={{ background: badgeBg }}>
                              {item.is_community_report ? 'CR' : item.acronym}
                            </div>
                            <div className={styles.modalItemDetails}>
                              <div className={styles.modalItemTitleRow}>
                                <h4 className={styles.modalItemTitle}>{item.title}</h4>
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em',
                                    background:
                                      item.severity === 'SEVERE'
                                        ? '#7F1D1D'
                                        : item.severity === 'WARNING'
                                        ? '#FEF2F2'
                                        : '#F0FDF4',
                                    color:
                                      item.severity === 'SEVERE'
                                        ? '#FFFFFF'
                                        : item.severity === 'WARNING'
                                        ? '#DC2626'
                                        : '#16A34A',
                                  }}
                                >
                                  {item.severity}
                                </span>
                              </div>
                              <div className={styles.modalItemLoc}>
                                📍 {item.district ? `${item.district}, ` : ''}{item.country}
                              </div>
                              {item.detailsText && (
                                <div className={styles.modalItemMetric}>
                                  {item.detailsText}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={styles.modalItemBottom}>
                            <span className={styles.modalItemSource}>
                              {item.is_community_report ? 'Citizen Ground Report' : item.source}
                            </span>
                            <button
                              type="button"
                              className={styles.modalLocateBtn}
                              onClick={() => {
                                setIsAllCalamitiesModalOpen(false);
                                const coords = item.coords;
                                if (coords) {
                                  if (item.acronym === 'SH') {
                                    const sh = VERIFIED_SHELTERS.find((s) => s.id === item.id);
                                    if (sh) setSelectedEvent(convertShelterToUnifiedEvent(sh));
                                    setSelectedAcronym('SH');
                                  } else {
                                    const ev = events.find((e) => e.id === item.id);
                                    if (ev) setSelectedEvent(ev);
                                    setSelectedAcronym('ALL');
                                  }
                                  flyToCoords(coords[0], coords[1], 10.5);
                                  setTimeout(() => {
                                    const marker = markersMapRef.current.get(item.id);
                                    if (marker && mapRef.current) {
                                      markersRef.current.forEach((m) => {
                                        const p = m.getPopup();
                                        if (p && p.isOpen()) p.remove();
                                      });
                                      const p = marker.getPopup();
                                      if (p) p.setLngLat(coords).addTo(mapRef.current);
                                    }
                                  }, 400);
                                }
                              }}
                            >
                              Locate on GIS Map 🎯
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Loading Suraksha Setu map...</div>}>
      <MapContent />
    </Suspense>
  );
}
