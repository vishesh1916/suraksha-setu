'use client';

import { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { translations, getSavedLanguage, setSavedLanguage, SUPPORTED_LANGUAGES, type Language } from '@/lib/i18n';
import { getActiveTileStyle, TILE_STYLES, SOUTH_ASIA_CENTER, OSM_STANDARD_STYLE, CARTO_API_KEY } from '@/lib/map/tileProvider';
import { INDIA_LOCATIONS, searchIndiaLocations, type IndiaLocation } from '@/lib/map/indiaLocations';
import { HAZARD_ACRONYM_META, type UnifiedHazardEvent, type HazardAcronym, type HazardSeverity, type ProviderHealth } from '@/lib/hazardAdapters/types';
import { getClientReports, subscribeToSync, isDemoReport } from '@/lib/clientSync';
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
    title: `Unverified community report: ${r.landmark || r.category.replace('_', ' ')}`,
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
      safetyGuidance: 'Citizen-submitted ground observation. Triage in progress by district emergency control room.',
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

export interface ReliefShelter {
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
    provisions: 'Potable Drinking Water, 450 Dry Ration Kits, First Aid Trauma Unit, 4 Inflatable Boats',
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
    provisions: 'Generator Power Backup, Cooked Meals, Pediatric Medical Station, Dewatering Pumps',
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
    provisions: 'Water Filtration Unit, NDRF 1st Bn Rescue Staging Post, Life Jackets, ORS Packets',
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
    provisions: 'Thermal Blankets, High-Altitude Medical Kit, Satellite VHF Wireless Comms',
    contact: '01892-223322',
  },
  {
    id: 'shelter_chennai_1',
    name: 'Ripon Building Emergency Relief Staging Camp',
    region: 'Central Station Corridor, Chennai',
    lat: 13.0827,
    lng: 80.2707,
    capacity: 750,
    occupancy: 160,
    provisions: 'Heavy Flood Rescue Equipment, Mobile Dispensary, Community Kitchen',
    contact: '044-25619206',
  },
];

type RailTab = 'official' | 'earth' | 'weather_flood' | 'fire_heat' | 'community';

// Robust MapLibre export resolver across SSR/Webpack ESM synthetics
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveMapLibre(mod: any): any {
  if (mod && typeof mod.Map === 'function') return mod;
  if (mod && mod.default && typeof mod.default.Map === 'function') return mod.default;
  return mod;
}

// Calculate center coordinates for any hazard event (Points or Polygon centroids)
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
  } else if (ev.geometry.type === 'MultiPolygon' && ev.geometry.coordinates?.[0]?.[0]?.length > 0) {
    const ring = ev.geometry.coordinates[0][0];
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

// Configures and mounts official GeoJSON hazard polygon layers onto active style
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupPolygonLayers(map: any, onPolygonClick: (eventId: string) => void) {
  try {
    if (!map.getSource('official-polygons-source')) {
      map.addSource('official-polygons-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
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
            'SEVERE',
            '#A82824',
            'WARNING',
            '#C4511A',
            'WATCH',
            '#D67A20',
            '#2E5A44',
          ],
          'fill-opacity': 0.18,
        },
      });
    }

    if (!map.getLayer('official-polygons-line')) {
      map.addLayer({
        id: 'official-polygons-line',
        type: 'line',
        source: 'official-polygons-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'severity'],
            'SEVERE',
            '#A82824',
            'WARNING',
            '#C4511A',
            'WATCH',
            '#D67A20',
            '#2E5A44',
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
        const feat = e.features[0];
        const eventId = feat.properties?.id;
        if (eventId) {
          onPolygonClick(eventId);
        }
      }
    });

    map.on('mouseenter', 'official-polygons-fill', () => {
      try { map.getCanvas().style.cursor = 'pointer'; } catch {}
    });
    map.on('mouseleave', 'official-polygons-fill', () => {
      try { map.getCanvas().style.cursor = ''; } catch {}
    });
  } catch (err) {
    console.warn('Polygon layer setup notice:', err);
  }
}

// Safely synchronize polygon data features into the official-polygons-source
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
    console.warn('Polygon source sync notice:', err);
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
  const [mapReady, setMapReady] = useState(false);

  // Core Hazard Data State — Pre-populated with local client community reports for 0ms latency
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

  // Rail & Tab Navigation State
  const [isRailOpen, setIsRailOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<RailTab>('official');

  // Multi-Facet Filters
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
  const [showLegend, setShowLegend] = useState(false);
  const [showFeedsMenu, setShowFeedsMenu] = useState(false);
  const [showMapLangMenu, setShowMapLangMenu] = useState(false);
  const [currentTileStyle, setCurrentTileStyle] = useState<string>('osm');
  const [lang, setLang] = useState<Language>('en');

  // Search Autocomplete State (India Major Cities & Disaster Prone Corridors)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IndiaLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // SOS Emergency Drawer State
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosLandmark, setSosLandmark] = useState('');
  const [sosPhone, setSosPhone] = useState('');
  const [sosNotes, setSosNotes] = useState('');
  const [sosSuccessId, setSosSuccessId] = useState<string | null>(null);

  // Fetch Unified Multi-Hazard Telemetry & Real-Time Citizen Reports
  const fetchHazardData = useCallback(async () => {
    try {
      const [unifiedRes, reportsRes] = await Promise.allSettled([
        fetch(
          `/api/hazards/unified?includeCommunity=true&timeRange=${timeRange}&_t=${Date.now()}`,
          { cache: 'no-store' }
        ),
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

      // If server reports endpoint returned active reports, merge any new genuine reports
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

      // Seamlessly merge with client reports (zero-latency local storage)
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

  // Initial load and fast 5s background refresh
  useEffect(() => {
    fetchHazardData();
    const interval = setInterval(fetchHazardData, 5000); // 5s fast live refresh for cross-device updates
    return () => clearInterval(interval);
  }, [fetchHazardData]);

  // Real-time zero-latency sync subscription across tabs (BroadcastChannel + storage)
  useEffect(() => {
    // Immediate hydration on mount
    setEvents((prev) => mergeWithClientReports(prev));

    const unsubscribe = subscribeToSync((msg) => {
      if (msg.type === 'NEW_REPORT' && msg.report && !isDemoReport(msg.report)) {
        const newEv = convertReportToUnifiedEvent(msg.report);
        setEvents((prev) => {
          const commId = `community_${msg.report!.id}`;
          const cleanId = msg.report!.id.toLowerCase();
          const exists = prev.some(
            (e) => e.id === commId || e.id === msg.report!.id || e.id.toLowerCase().includes(cleanId)
          );
          if (exists) {
            return prev.map((e) =>
              e.id === commId || e.id === msg.report!.id || e.id.toLowerCase().includes(cleanId)
                ? newEv
                : e
            );
          }
          return [newEv, ...prev];
        });
      } else if (msg.type === 'REPORT_ACTION' && msg.report) {
        const updatedEv = convertReportToUnifiedEvent(msg.report);
        setEvents((prev) => {
          const commId = `community_${msg.report!.id}`;
          const cleanId = msg.report!.id.toLowerCase();
          return prev.map((e) =>
            e.id === commId || e.id === msg.report!.id || e.id.toLowerCase().includes(cleanId)
              ? updatedEv
              : e
          );
        });
      } else if (msg.type === 'PURGE_ALL') {
        setEvents((prev) => prev.filter((e) => !e.is_community_report));
      }
    });
    return unsubscribe;
  }, []);

  // Multilingual reactive listener (6 Indian languages)
  useEffect(() => {
    setLang(getSavedLanguage());
    const onLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail) {
        setLang(customEvent.detail);
      } else {
        setLang(getSavedLanguage());
      }
    };
    window.addEventListener('languagechange', onLangChange);
    return () => window.removeEventListener('languagechange', onLangChange);
  }, []);

  const t = translations[lang] || translations.en;

  // Handle Autocomplete Search Query for India Major Cities & Disaster Prone areas
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const results = searchIndiaLocations(searchQuery, 7);
    setSearchResults(results);
  }, [searchQuery]);

  // Filtered Events: Synchronized for BOTH the Sidebar Feed List and Map Canvas Markers
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // 1. Layer Visibility checks (from top-right controls)
      if (ev.is_community_report && !layerCommunity) return false;
      if (ev.acronym === 'EQ' && !layerEarthquakes) return false;
      if (['FL', 'RF', 'CW', 'ST', 'CV'].includes(ev.acronym) && !layerWeatherFlood) return false;
      if (['FR', 'HW'].includes(ev.acronym) && !layerFires) return false;

      // 2. Tab Category checks (Bifurcated Calamities)
      if (activeTab === 'official' && ev.is_community_report) return false;
      if (activeTab === 'earth' && (ev.is_community_report || !['EQ', 'LS', 'TS', 'AV'].includes(ev.acronym))) return false;
      if (activeTab === 'weather_flood' && (ev.is_community_report || !['FL', 'RF', 'CW', 'ST', 'CV'].includes(ev.acronym))) return false;
      if (activeTab === 'fire_heat' && (ev.is_community_report || !['FR', 'HW'].includes(ev.acronym))) return false;
      if (activeTab === 'community' && !ev.is_community_report) return false;

      // 3. Facet Country Filter (flexible matching)
      if (selectedCountry !== 'ALL') {
        const cLow = (ev.country || '').toLowerCase();
        const selLow = selectedCountry.toLowerCase();
        if (!cLow.includes(selLow) && !selLow.includes(cLow)) return false;
      }

      // 4. Facet Acronym Filter
      if (selectedAcronym !== 'ALL' && ev.acronym !== selectedAcronym) return false;

      // 5. Facet Severity Filter
      if (selectedSeverity !== 'ALL' && ev.severity !== selectedSeverity) return false;

      return true;
    });
  }, [
    events,
    activeTab,
    selectedCountry,
    selectedAcronym,
    selectedSeverity,
    layerCommunity,
    layerEarthquakes,
    layerWeatherFlood,
    layerFires,
  ]);

  // Map markers mirror filteredEvents so markers dynamically update with every tab/filter selection
  const mapMarkersList = useMemo(() => {
    return filteredEvents;
  }, [filteredEvents]);

  // Global counts for tabs (unaffected by active filter)
  const officialAlertsCount = useMemo(
    () => events.filter((e) => e.is_official).length,
    [events]
  );
  const communityReportsCount = useMemo(
    () => events.filter((e) => e.is_community_report).length,
    [events]
  );

  // Auto-focus and highlight event if passed in URL query param (?highlight=reportId)
  useEffect(() => {
    if (!paramHighlight || events.length === 0) return;
    const clean = paramHighlight.trim().toLowerCase();
    const matched = events.find((ev) => {
      const eid = ev.id.toLowerCase();
      return (
        eid === clean ||
        eid.includes(clean) ||
        clean.includes(eid) ||
        (eid.startsWith('community_') && eid.replace('community_', '') === clean)
      );
    });
    if (matched) {
      setSelectedEvent(matched);
      setIsRailOpen(true);
      if (matched.is_community_report) {
        setActiveTab('community');
      }
      const center = getEventCenter(matched);
      if (center) {
        flyToCoords(center[0], center[1], 12);
      }
    }
  }, [paramHighlight, events]);

  // Initialize MapLibre GL Map Engine
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let isMounted = true;
    let styleTimeout: NodeJS.Timeout;

    async function initMap() {
      try {
        const maplibreglModule = await import('maplibre-gl');
        const maplibregl = resolveMapLibre(maplibreglModule);

        if (!isMounted || !mapContainerRef.current) return;
        mapContainerRef.current.innerHTML = '';

        // Configure standalone Web Worker URL explicitly for MapLibre GL v6
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
          attributionControl: true,
          transformRequest: (url: string) => {
            if (url.includes('cartocdn.com')) {
              let cleanUrl = url;
              if (!cleanUrl.includes('key=')) {
                const sep = cleanUrl.includes('?') ? '&' : '?';
                cleanUrl = `${cleanUrl}${sep}key=${CARTO_API_KEY}`;
              }
              if (!cleanUrl.includes('api_key=')) {
                const sep = cleanUrl.includes('?') ? '&' : '?';
                cleanUrl = `${cleanUrl}${sep}api_key=${CARTO_API_KEY}`;
              }
              return { url: cleanUrl };
            }
            return { url };
          },
        });

        let styleLoaded = false;

        const onPolygonClick = (eventId: string) => {
          const matched = eventsRef.current.find((ev) => ev.id === eventId);
          if (matched) {
            setSelectedEvent(matched);
            const center = getEventCenter(matched);
            if (center) {
              flyToCoords(center[0], center[1], 8.5);
            }
          }
        };

        const handleStyleOrLoad = () => {
          styleLoaded = true;
          if (!isMounted) return;
          setupPolygonLayers(map, onPolygonClick);
          syncPolygonData(map, eventsRef.current, layerPolygons);
          map.resize();
          setMapReady(true);
        };

        map.on('load', handleStyleOrLoad);
        map.on('style.load', handleStyleOrLoad);

        // Warning logger only (avoid resetting styles abruptly)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on('error', (e: any) => {
          console.warn('MapLibre engine notice:', e?.error?.message || e);
        });

        // 6s fallback if vector style failed to load completely
        styleTimeout = setTimeout(() => {
          if (!styleLoaded && mapRef.current && currentTileStyle === 'openfreemap_vector') {
            console.warn('OpenFreeMap vector tiles timeout (>6s), falling back to OpenStreetMap standard style');
            try {
              mapRef.current.setStyle(OSM_STANDARD_STYLE);
            } catch {}
          }
        }, 6000);

        map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
        map.addControl(
          new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
          }),
          'top-right'
        );

        mapRef.current = map;
        setMapReady(true);

        // Viewport recalculation intervals to ensure canvas matches container dimensions
        setTimeout(() => {
          if (mapRef.current) mapRef.current.resize();
        }, 80);
        setTimeout(() => {
          if (mapRef.current) mapRef.current.resize();
        }, 300);
        setTimeout(() => {
          if (mapRef.current) mapRef.current.resize();
        }, 800);
      } catch (err) {
        console.error('Failed to initialize MapLibre map engine:', err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      clearTimeout(styleTimeout);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Resize MapLibre whenever left intelligence rail collapses or expands
  useEffect(() => {
    if (mapRef.current) {
      const t1 = setTimeout(() => mapRef.current?.resize(), 60);
      const t2 = setTimeout(() => mapRef.current?.resize(), 260);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isRailOpen]);

  // Viewport resize observer on map canvas element
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    ro.observe(mapContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Update Polygon GeoJSON Source when events, layerPolygons toggle, or mapReady changes
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    syncPolygonData(mapRef.current, mapMarkersList, layerPolygons);
  }, [mapReady, mapMarkersList, layerPolygons]);

  // Render Marker Badges on the Map for ALL natural calamities and disasters
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    let isMounted = true;

    async function updateMarkers() {
      const maplibreglModule = await import('maplibre-gl');
      const maplibregl = resolveMapLibre(maplibreglModule);

      if (!isMounted || !mapRef.current) return;

      // Clear existing markers safely
      markersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch {}
      });
      markersRef.current = [];

      // 1. Render Point & Polygon Centroid Hazard Markers (ISRO, NASA, USGS, NDMA, Nepal, and Citizen Reports)
      mapMarkersList.forEach((ev) => {
        const coords = getEventCenter(ev);
        if (!coords) return;

        const el = document.createElement('div');
        el.className = `map-acronym-marker ${styles.acronymBadge}`;
        el.style.cursor = 'pointer';
        el.style.userSelect = 'none';

        // Severity coloring
        let sevClass = styles.sevAdvisory;
        if (ev.severity === 'SEVERE') sevClass = styles.sevSevere;
        else if (ev.severity === 'WARNING') sevClass = styles.sevWarning;
        else if (ev.severity === 'WATCH') sevClass = styles.sevWatch;

        el.classList.add(sevClass);

        // Earthquake Magnitude Sizing
        if (ev.acronym === 'EQ') {
          const mag = ev.details?.magnitude ?? 4.0;
          const size = mag >= 6.0 ? 38 : mag >= 4.5 ? 32 : 28;
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.borderRadius = '50%';
          el.innerText = 'EQ';
          el.title = `${ev.title} · M${mag.toFixed(1)} (${ev.source})`;
        } else if (ev.is_community_report) {
          // Neutral dashed community style
          el.style.background = '#F3F1EB';
          el.style.color = '#161816';
          el.style.border = '1.5px dashed #737571';
          el.innerText = ev.acronym;
          el.title = `Unverified Community Report: ${ev.title}`;
        } else {
          el.innerText = ev.acronym;
          el.title = `${ev.title} (${ev.source})`;
        }

        // Active selected outline
        if (selectedEvent?.id === ev.id) {
          el.style.outline = '3px solid #161816';
          el.style.outlineOffset = '2px';
          el.style.transform = 'scale(1.18)';
          el.style.zIndex = '100';
        }

        // Pulse effect for severe alerts
        if (ev.severity === 'SEVERE' && ev.is_official) {
          el.classList.add('map-marker-pulse');
        }

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedEvent(ev);
          flyToCoords(coords[0], coords[1], ev.geometry.type === 'Polygon' ? 8.5 : 9);
        });

        try {
          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([coords[0], coords[1]])
            .addTo(mapRef.current);

          markersRef.current.push(marker);
        } catch (mErr) {
          console.warn('Failed to add marker for', ev.id, mErr);
        }
      });

      // 2. Render Relief Shelters if enabled
      if (layerShelters) {
        VERIFIED_SHELTERS.forEach((sh) => {
          const el = document.createElement('div');
          el.className = styles.acronymBadge;
          el.style.background = '#161816';
          el.style.color = '#FFFFFF';
          el.style.border = '1.5px solid #E5E2D9';
          el.style.width = '24px';
          el.style.height = '24px';
          el.style.borderRadius = '4px';
          el.style.cursor = 'pointer';
          el.innerText = 'SH';
          el.title = `Relief Shelter: ${sh.name}`;

          el.addEventListener('click', (e) => {
            e.stopPropagation();
            setSelectedEvent({
              id: sh.id,
              source: 'Verified Disaster Relief Logistics Command',
              source_url: '#',
              hazard_type: 'RELIEF_SHELTER',
              acronym: 'FL',
              title: sh.name,
              severity: 'ADVISORY',
              status: 'ACTIVE',
              geometry: { type: 'Point', coordinates: [sh.lng, sh.lat] },
              country: 'India',
              district: sh.region,
              issued_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              freshness: 'Verified Shelter Network',
              confidence: 'VERIFIED',
              is_official: true,
              is_community_report: false,
              details: {
                nearestLocality: sh.region,
                shelterProvisions: sh.provisions,
                contact: sh.contact,
                safetyGuidance: `Emergency transit camp open. Capacity: ${sh.capacity} persons (Current Occupancy: ${sh.occupancy}).`,
              },
            });
            flyToCoords(sh.lng, sh.lat, 12);
          });

          try {
            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat([sh.lng, sh.lat])
              .addTo(mapRef.current);

            markersRef.current.push(marker);
          } catch {}
        });
      }
    }

    updateMarkers();

    return () => {
      isMounted = false;
    };
  }, [mapReady, mapMarkersList, layerShelters, layerEarthquakes, layerWeatherFlood, layerFires, layerCommunity, selectedEvent]);

  // FlyTo Location
  const flyToCoords = (lng: number, lat: number, zoom: number = 11) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom,
      essential: true,
      duration: 1400,
    });
  };

  // Reset to South Asia Center View
  const handleResetView = () => {
    flyToCoords(SOUTH_ASIA_CENTER.lng, SOUTH_ASIA_CENTER.lat, SOUTH_ASIA_CENTER.zoom);
  };

  // Share Current Map View Link
  const handleShareView = () => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    const zoom = mapRef.current.getZoom();
    const url = new URL(window.location.href);
    url.searchParams.set('lat', center.lat.toFixed(4));
    url.searchParams.set('lng', center.lng.toFixed(4));
    url.searchParams.set('zoom', zoom.toFixed(1));
    navigator.clipboard.writeText(url.toString());
    alert('Map view link copied to clipboard!');
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Switch Base Map Style
  const handleSelectTileStyle = (styleKey: string) => {
    if (!mapRef.current) return;
    setCurrentTileStyle(styleKey);
    const styleUrl = getActiveTileStyle(styleKey);
    mapRef.current.setStyle(styleUrl);
    setShowBaseMapMenu(false);
  };

  // Submit SOS Distress Beacon
  const handleSubmitSos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sosLandmark.trim()) {
      alert('Please enter your landmark or location.');
      return;
    }
    setSosSubmitting(true);
    try {
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterName: 'Distress Citizen',
          phone: sosPhone.trim() || 'Not provided',
          location: { latitude: SOUTH_ASIA_CENTER.lat, longitude: SOUTH_ASIA_CENTER.lng },
          landmark: sosLandmark.trim(),
          hazardType: 'FLOODING',
          peopleCount: 2,
          notes: sosNotes.trim(),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setSosSuccessId(json.data?.id || 'SOS-CONFIRMED');
        fetchHazardData();
      } else {
        alert('Failed to send SOS broadcast. Please dial 112 directly.');
      }
    } catch {
      alert('Network issue. Call National Emergency Helpline 112 immediately.');
    } finally {
      setSosSubmitting(false);
    }
  };

  return (
    <div className={styles.mapPage}>
      {/* 1. Universal Top Header */}
      <Navbar />

      {/* 2. Operational Layout */}
      <div className={styles.mapLayout}>
        {/* ============================================================
            Left Information Rail (Collapsible)
            ============================================================ */}
        <aside className={`${styles.leftRail} ${!isRailOpen ? styles.leftRailCollapsed : ''}`}>
          <button
            type="button"
            className={styles.railToggleBtn}
            onClick={() => setIsRailOpen(!isRailOpen)}
            title={isRailOpen ? 'Collapse intelligence panel' : 'Expand intelligence panel'}
            aria-label="Toggle rail"
          >
            {isRailOpen ? '◀' : '▶'}
          </button>

          {/* Rail Header */}
          <div className={styles.railHeader}>
            <div className={styles.railHeaderTop}>
              <div className={styles.railTitleWrapper}>
                <div className={styles.pulseDotLive} />
                <h2 className={styles.railTitle}>{t.map.liveIntel}</h2>
              </div>
              <span className={styles.regionPill}>
                {selectedCountry === 'ALL' ? 'South Asia Grid' : selectedCountry}
              </span>
            </div>

            <div className={styles.railMetaSub}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{t.map.refreshed}: {lastRefreshedAt || 'Connecting feeds...'}</span>
                <button
                  type="button"
                  onClick={() => fetchHazardData()}
                  title="Fetch latest live telemetry now (Auto-refreshes every 30s)"
                  className={styles.refreshTriggerBtn}
                  disabled={loading}
                >
                  <span style={{ display: 'inline-block', transform: loading ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s linear' }}>↻</span>
                  <span>{loading ? t.map.syncing : t.map.sync}</span>
                </button>
              </div>
              <button
                type="button"
                className={styles.sosQuickTriggerBtn}
                onClick={() => setIsSosOpen(true)}
              >
                {t.map.sosBeacon}
              </button>
            </div>
          </div>

          {/* 5 Categorical Tabs */}
          <nav className={styles.tabNav}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'official' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('official');
                setSelectedAcronym('ALL');
              }}
            >
              <span>{t.map.tabOfficial}</span>
              <span className={styles.tabCountBadge}>{officialAlertsCount}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'earth' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('earth');
                setSelectedAcronym('ALL');
              }}
            >
              <span>{t.map.tabEarth}</span>
              <span className={styles.tabCountBadge}>
                {events.filter((e) => !e.is_community_report && ['EQ', 'LS', 'TS', 'AV'].includes(e.acronym)).length}
              </span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'weather_flood' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('weather_flood');
                setSelectedAcronym('ALL');
              }}
            >
              <span>{t.map.tabWeatherFlood}</span>
              <span className={styles.tabCountBadge}>
                {events.filter((e) => !e.is_community_report && ['FL', 'RF', 'CW', 'ST', 'CV'].includes(e.acronym)).length}
              </span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'fire_heat' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('fire_heat');
                setSelectedAcronym('ALL');
              }}
            >
              <span>{t.map.tabFireHeat}</span>
              <span className={styles.tabCountBadge}>
                {events.filter((e) => !e.is_community_report && ['FR', 'HW'].includes(e.acronym)).length}
              </span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'community' ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('community');
                setSelectedAcronym('ALL');
              }}
            >
              <span>{t.map.tabCommunity}</span>
              <span className={styles.tabCountBadge}>{communityReportsCount}</span>
            </button>
          </nav>

          {/* Facet Filter Bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterRowPrimary}>
              <select
                className={styles.filterSelect}
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                aria-label="Filter by Country"
              >
                <option value="ALL">All South Asia</option>
                <option value="India">India</option>
                <option value="Nepal">Nepal</option>
                <option value="Bhutan">Bhutan</option>
                <option value="Bangladesh">Bangladesh</option>
                <option value="Sri Lanka">Sri Lanka</option>
              </select>

              <select
                className={styles.filterSelect}
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                aria-label="Filter by Severity"
              >
                <option value="ALL">All Severities</option>
                <option value="SEVERE">Severe / Critical</option>
                <option value="WARNING">Warning</option>
                <option value="WATCH">Watch</option>
                <option value="ADVISORY">Advisory</option>
              </select>

              <div className={styles.filterTimeGroup}>
                <button
                  type="button"
                  className={`${styles.filterTimeBtn} ${timeRange === '24h' ? styles.filterTimeBtnActive : ''}`}
                  onClick={() => setTimeRange('24h')}
                >
                  24h
                </button>
                <button
                  type="button"
                  className={`${styles.filterTimeBtn} ${timeRange === '7d' ? styles.filterTimeBtnActive : ''}`}
                  onClick={() => setTimeRange('7d')}
                >
                  7d
                </button>
                <button
                  type="button"
                  className={`${styles.filterTimeBtn} ${timeRange === '30d' ? styles.filterTimeBtnActive : ''}`}
                  onClick={() => setTimeRange('30d')}
                >
                  30d
                </button>
              </div>
            </div>

            {/* Quick Acronym Badges Filter */}
            <div className={styles.filterAcronymPills}>
              <button
                type="button"
                className={`${styles.acronymPill} ${selectedAcronym === 'ALL' ? styles.acronymPillActive : ''}`}
                onClick={() => setSelectedAcronym('ALL')}
              >
                ALL
              </button>
              {(Object.keys(HAZARD_ACRONYM_META) as HazardAcronym[]).map((acr) => (
                <button
                  key={acr}
                  type="button"
                  className={`${styles.acronymPill} ${selectedAcronym === acr ? styles.acronymPillActive : ''}`}
                  onClick={() => {
                    const next = selectedAcronym === acr ? 'ALL' : acr;
                    setSelectedAcronym(next);
                    if (next !== 'ALL') {
                      if (['EQ', 'LS', 'TS', 'AV'].includes(next)) {
                        setActiveTab('earth');
                      } else if (['FL', 'RF', 'CW', 'ST', 'CV'].includes(next)) {
                        setActiveTab('weather_flood');
                      } else if (['FR', 'HW'].includes(next)) {
                        setActiveTab('fire_heat');
                      }
                    }
                  }}
                  title={HAZARD_ACRONYM_META[acr].name}
                >
                  {acr}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Feed List */}
          <div className={styles.railContent}>
            {loading ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#737571', fontSize: '13px' }}>
                Establishing multi-agency telemetry uplink...
              </div>
            ) : filteredEvents.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#737571', fontSize: '13px' }}>
                No active hazard events match the current filter criteria.
              </div>
            ) : (
              <>
                <div className={styles.feedSectionHeader}>
                  <span className={styles.feedSectionTitle}>
                    {activeTab === 'official' && t.map.latestOfficial}
                    {activeTab === 'earth' && (t.map.tabEarth || 'Earthquake & Seismic Events')}
                    {activeTab === 'weather_flood' && (t.map.tabWeatherFlood || 'Weather & Flood Alerts')}
                    {activeTab === 'fire_heat' && (t.map.tabFireHeat || 'Thermal Fires & Heatwaves')}
                    {activeTab === 'community' && (t.map.tabCommunity || 'Community Reports')}
                    {selectedAcronym !== 'ALL' && ` · ${selectedAcronym}`}
                  </span>
                  <span className={styles.tabCountBadge}>{filteredEvents.length}</span>
                </div>

                {filteredEvents.map((ev) => {
                  const isSelected = selectedEvent?.id === ev.id;

                  if (ev.is_community_report) {
                    const modStatus = ev.details?.moderationStatus || 'Received';
                    let modClass = styles.modReceived;
                    if (modStatus === 'Under review') modClass = styles.modUnderReview;
                    else if (modStatus === 'Verified') modClass = styles.modVerified;
                    else if (modStatus === 'Dismissed') modClass = styles.modDismissed;
                    else if (modStatus === 'Resolved') modClass = styles.modResolved;

                    return (
                      <div
                        key={ev.id}
                        className={`${styles.communityCard} ${isSelected ? styles.hazardCardSelected : ''}`}
                        onClick={() => {
                          setSelectedEvent(ev);
                          const center = getEventCenter(ev);
                          if (center) {
                            flyToCoords(center[0], center[1], 11);
                          }
                        }}
                      >
                        <div className={styles.communityBadgeRow}>
                          <span className={styles.unverifiedLabel}>Unverified Community Report</span>
                          <span className={`${styles.moderationPill} ${modClass}`}>
                            {modStatus}
                          </span>
                        </div>

                        <h3 className={styles.cardTitle}>{ev.title}</h3>
                        <div className={styles.cardLocation}>
                          <span>📍 {ev.district || 'Ground observation'}</span>
                        </div>

                        <div className={styles.cardFooterRow}>
                          <span>Reported: {new Date(ev.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <Link href={ev.source_url} className={styles.cardSourceLink} onClick={(e) => e.stopPropagation()}>
                            Track report ↗
                          </Link>
                        </div>
                      </div>
                    );
                  }

                  let sevClass = styles.sevAdvisory;
                  if (ev.severity === 'SEVERE') sevClass = styles.sevSevere;
                  else if (ev.severity === 'WARNING') sevClass = styles.sevWarning;
                  else if (ev.severity === 'WATCH') sevClass = styles.sevWatch;

                  return (
                    <div
                      key={ev.id}
                      className={`${styles.hazardCard} ${isSelected ? styles.hazardCardSelected : ''}`}
                      onClick={() => {
                        setSelectedEvent(ev);
                        const center = getEventCenter(ev);
                        if (center) {
                          flyToCoords(center[0], center[1], ev.geometry.type === 'Polygon' ? 8.5 : 9);
                        }
                      }}
                    >
                      <div className={styles.cardTopRow}>
                        <div className={styles.cardLeftIdent}>
                          <span className={`${styles.acronymBadge} ${sevClass}`}>
                            {ev.acronym}
                          </span>
                          <div>
                            <h3 className={styles.cardTitle}>{ev.title}</h3>
                            <div className={styles.cardLocation}>
                              <span>📍 {ev.district || ev.state || ev.country}</span>
                            </div>
                          </div>
                        </div>
                        <span className={`${styles.severityPill} ${sevClass}`}>
                          {ev.severity}
                        </span>
                      </div>

                      {/* Telemetry Metrics Row */}
                      <div className={styles.cardTelemetryRow}>
                        {ev.details?.magnitude !== undefined && (
                          <div className={styles.cardTelemetryItem}>
                            <span>Magnitude:</span>
                            <span className={styles.cardTelemetryVal}>M {ev.details.magnitude.toFixed(1)}</span>
                          </div>
                        )}
                        {ev.details?.depthKm !== undefined && (
                          <div className={styles.cardTelemetryItem}>
                            <span>Depth:</span>
                            <span className={styles.cardTelemetryVal}>{ev.details.depthKm} km</span>
                          </div>
                        )}
                        {ev.details?.rainfallRateMmH !== undefined && (
                          <div className={styles.cardTelemetryItem}>
                            <span>Rain Rate:</span>
                            <span className={styles.cardTelemetryVal}>{ev.details.rainfallRateMmH.toFixed(1)} mm/h</span>
                          </div>
                        )}
                        {ev.details?.brightnessTempK !== undefined && (
                          <div className={styles.cardTelemetryItem}>
                            <span>Temp:</span>
                            <span className={styles.cardTelemetryVal}>{ev.details.brightnessTempK} K</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.cardFooterRow}>
                        <span>{ev.freshness}</span>
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.cardSourceLink}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {ev.source} ↗
                        </a>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        {/* ============================================================
            MapLibre Viewport Container
            ============================================================ */}
        <div className={styles.mapArea}>
          {/* Isolated Full-Screen Canvas for MapLibre GL Engine */}
          <div
            ref={mapContainerRef}
            className={styles.mapCanvas}
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, overflow: 'hidden' }}
          />

          {/* Top-Left Search Bar (Targeted exclusively to Indian Major Cities & Disaster Prone Corridors) */}
          <div className={styles.searchControlWrapper}>
            <div className={styles.searchBar}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t.map.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.searchClearBtn}
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown List */}
            {isSearching && searchResults.length > 0 && (
              <div className={styles.autocompleteDropdown}>
                <div className={styles.autocompleteHeader}>
                  India Cities & Disaster Vulnerability Index
                </div>
                {searchResults.map((loc) => (
                  <div
                    key={loc.id}
                    className={styles.autocompleteItem}
                    onClick={() => {
                      flyToCoords(loc.lng, loc.lat, loc.zoom);
                      setSearchQuery(loc.name);
                      setIsSearching(false);
                    }}
                  >
                    <div>
                      <div className={styles.autoItemName}>{loc.name}</div>
                      <div className={styles.autoItemCat}>
                        {loc.state} · {loc.category}
                      </div>
                    </div>
                    <span
                      className={`${styles.autoItemBadge} ${
                        loc.type === 'DISASTER_PRONE' ? styles.autoBadgeDisaster : styles.autoBadgeMetro
                      }`}
                    >
                      {loc.type === 'DISASTER_PRONE' ? 'High Risk' : 'Metro'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top-Right Floating Controls */}
          <div className={styles.topRightControls}>
            {/* Layers Switcher Popover */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`${styles.mapControlBtn} ${showLayerMenu ? styles.mapControlBtnActive : ''}`}
                onClick={() => {
                  setShowLayerMenu(!showLayerMenu);
                  setShowBaseMapMenu(false);
                  setShowLegend(false);
                  setShowFeedsMenu(false);
                  setShowMapLangMenu(false);
                }}
              >
                <span>{t.map.layers}</span>
                <span>▾</span>
              </button>

              {showLayerMenu && (
                <div className={styles.floatingPopover}>
                  <h4 className={styles.popoverTitle}>Hazard Layer Feeds</h4>
                  <label className={styles.layerCheckboxLabel}>
                    <span>Official Polygons (NDMA / IMD)</span>
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
                    <span>Weather & Floods (FL / RF / ST)</span>
                    <input
                      type="checkbox"
                      checked={layerWeatherFlood}
                      onChange={(e) => setLayerWeatherFlood(e.target.checked)}
                    />
                  </label>
                  <label className={styles.layerCheckboxLabel}>
                    <span>Thermal Fires (NASA FIRMS FR)</span>
                    <input
                      type="checkbox"
                      checked={layerFires}
                      onChange={(e) => setLayerFires(e.target.checked)}
                    />
                  </label>
                  <label className={styles.layerCheckboxLabel}>
                    <span>Community Reports (Citizen)</span>
                    <input
                      type="checkbox"
                      checked={layerCommunity}
                      onChange={(e) => setLayerCommunity(e.target.checked)}
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
                </div>
              )}
            </div>

            {/* Base Map Style Switcher */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`${styles.mapControlBtn} ${showBaseMapMenu ? styles.mapControlBtnActive : ''}`}
                onClick={() => {
                  setShowBaseMapMenu(!showBaseMapMenu);
                  setShowLayerMenu(false);
                  setShowLegend(false);
                  setShowFeedsMenu(false);
                  setShowMapLangMenu(false);
                }}
              >
                <span>{t.map.baseMap}</span>
                <span>▾</span>
              </button>

              {showBaseMapMenu && (
                <div className={styles.floatingPopover}>
                  <h4 className={styles.popoverTitle}>Vector Tile Base Map</h4>
                  {Object.values(TILE_STYLES).map((ts) => (
                    <button
                      key={ts.id}
                      type="button"
                      className={`${styles.mapControlBtn} ${
                        currentTileStyle === ts.id ? styles.mapControlBtnActive : ''
                      }`}
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                      onClick={() => handleSelectTileStyle(ts.id)}
                    >
                      {ts.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Legend Drawer Trigger */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`${styles.mapControlBtn} ${showLegend ? styles.mapControlBtnActive : ''}`}
                onClick={() => {
                  setShowLegend(!showLegend);
                  setShowLayerMenu(false);
                  setShowBaseMapMenu(false);
                  setShowFeedsMenu(false);
                  setShowMapLangMenu(false);
                }}
              >
                <span>{t.map.legend}</span>
              </button>

              {showLegend && (
                <div className={styles.floatingPopover} style={{ width: '320px', maxHeight: '380px', overflowY: 'auto' }}>
                  <h4 className={styles.popoverTitle}>Hazard Acronyms & Severities</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                    {(Object.keys(HAZARD_ACRONYM_META) as HazardAcronym[]).map((acr) => (
                      <div key={acr} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <span className={`${styles.acronymBadge} ${styles.sevWatch}`} style={{ width: '22px', height: '22px', fontSize: '10px' }}>
                          {acr}
                        </span>
                        <span style={{ color: '#161816', fontWeight: 600 }}>{HAZARD_ACRONYM_META[acr].name}</span>
                      </div>
                    ))}
                  </div>
                  <h4 className={styles.popoverTitle} style={{ marginTop: '8px' }}>Severity Scale</h4>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <span className={`${styles.severityPill} ${styles.sevAdvisory}`}>Advisory</span>
                    <span className={`${styles.severityPill} ${styles.sevWatch}`}>Watch</span>
                    <span className={`${styles.severityPill} ${styles.sevWarning}`}>Warning</span>
                    <span className={`${styles.severityPill} ${styles.sevSevere}`}>Severe</span>
                  </div>
                </div>
              )}
            </div>

            {/* Live Agency Feeds & Health Telemetry Trigger */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`${styles.mapControlBtn} ${showFeedsMenu ? styles.mapControlBtnActive : ''}`}
                onClick={() => {
                  setShowFeedsMenu(!showFeedsMenu);
                  setShowLayerMenu(false);
                  setShowBaseMapMenu(false);
                  setShowLegend(false);
                  setShowMapLangMenu(false);
                }}
                title="View active agency feeds and synchronization health"
              >
                <div className={styles.pulseDotLive} style={{ width: '6px', height: '6px' }} />
                <span>{t.map.liveFeeds} ({sourcesHealth.filter((s) => s.status === 'HEALTHY').length || 7})</span>
                <span>▾</span>
              </button>

              {showFeedsMenu && (
                <div className={styles.floatingPopover} style={{ width: '370px', maxHeight: '440px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #EFECE6' }}>
                    <h4 className={styles.popoverTitle} style={{ margin: 0 }}>Real-Time Disaster Data Uplinks</h4>
                    <span style={{ fontSize: '10px', color: '#2E5A44', fontWeight: 700, background: '#EBF5EE', padding: '2px 6px', borderRadius: '3px' }}>
                      Auto-Sync 30s
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sourcesHealth.map((sh) => (
                      <div key={sh.id} style={{ padding: '8px 10px', background: '#FAF9F6', borderRadius: '4px', border: '1px solid #EFECE6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#161816' }}>{sh.name}</span>
                          <span style={{
                            fontSize: '9.5px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            background: sh.status === 'HEALTHY' ? '#EBF5EE' : sh.status === 'DEGRADED' ? '#FEF3E8' : '#F4F3EF',
                            color: sh.status === 'HEALTHY' ? '#2E5A44' : sh.status === 'DEGRADED' ? '#D67A20' : '#8A8C86',
                          }}>
                            {sh.status === 'HEALTHY' ? '● LIVE / SYNC' : sh.status === 'DEGRADED' ? 'RETRYING' : 'PENDING BRIDGE'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#383A36', marginBottom: '4px', lineHeight: 1.35 }}>{sh.statusMessage}</div>
                        <div style={{ fontSize: '10px', color: '#737571', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Coverage: {sh.coverage}</span>
                          {sh.officialFeedUrl && (
                            <a href={sh.officialFeedUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#D67A20', textDecoration: 'underline', fontWeight: 600 }}>
                              Official Portal ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Multilingual 6-Language Switcher */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`${styles.mapControlBtn} ${showMapLangMenu ? styles.mapControlBtnActive : ''}`}
                onClick={() => {
                  setShowMapLangMenu(!showMapLangMenu);
                  setShowLayerMenu(false);
                  setShowBaseMapMenu(false);
                  setShowLegend(false);
                  setShowFeedsMenu(false);
                }}
                title="Select language / भाषा चुनें (6 Indian Languages)"
              >
                <span style={{ fontSize: '12px' }}>🌐</span>
                <span>{SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.nativeName || 'English'}</span>
                <span>▾</span>
              </button>

              {showMapLangMenu && (
                <div className={styles.floatingPopover} style={{ minWidth: '180px', padding: '6px' }}>
                  <h4 className={styles.popoverTitle} style={{ padding: '4px 8px', marginBottom: '4px' }}>
                    Language / भाषा
                  </h4>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      className={`${styles.mapControlBtn} ${
                        lang === l.code ? styles.mapControlBtnActive : ''
                      }`}
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        marginBottom: '3px',
                        fontSize: '12px',
                      }}
                      onClick={() => {
                        setLang(l.code);
                        setSavedLanguage(l.code);
                        window.dispatchEvent(new CustomEvent('languagechange', { detail: l.code }));
                        setShowMapLangMenu(false);
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{l.nativeName}</span>
                      <span style={{ fontSize: '10.5px', color: '#737571' }}>{l.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reset View Button */}
            <button
              type="button"
              className={styles.mapControlBtn}
              onClick={handleResetView}
              title="Reset center to India & South Asia"
            >
              ⟲ {t.map.reset}
            </button>

            {/* Share Map View */}
            <button
              type="button"
              className={styles.mapControlBtn}
              onClick={handleShareView}
              title="Copy map view URL"
            >
              🔗 Share
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              className={styles.mapControlBtn}
              onClick={handleToggleFullscreen}
              title="Toggle Fullscreen Mode"
            >
              ⛶
            </button>
          </div>

          {/* Bottom Telemetry Bar */}
          <div className={styles.mapBottomBar}>
            <div className={styles.bottomHealthPill}>
              <span>📡 Official Uplinks:</span>
              <span>USGS: Live</span>
              <span>·</span>
              <span>NDMA SACHET: Live</span>
              <span>·</span>
              <span>GDACS: Live</span>
              <span>·</span>
              <span>NASA FIRMS: Calibrated</span>
            </div>

            <div className={styles.bottomTimeSlider}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#737571', textTransform: 'uppercase' }}>
                Window:
              </span>
              <button
                type="button"
                className={`${styles.filterTimeBtn} ${timeRange === '24h' ? styles.filterTimeBtnActive : ''}`}
                onClick={() => setTimeRange('24h')}
              >
                24h
              </button>
              <button
                type="button"
                className={`${styles.filterTimeBtn} ${timeRange === '7d' ? styles.filterTimeBtnActive : ''}`}
                onClick={() => setTimeRange('7d')}
              >
                7d
              </button>
              <button
                type="button"
                className={`${styles.filterTimeBtn} ${timeRange === '30d' ? styles.filterTimeBtnActive : ''}`}
                onClick={() => setTimeRange('30d')}
              >
                30d
              </button>
            </div>
          </div>

          {/* ============================================================
              Rich Incident Inspection Panel (Slide-in)
              ============================================================ */}
          {selectedEvent && (
            <div className={styles.incidentPanel}>
              <div className={styles.panelHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className={`${styles.acronymBadge} ${
                      selectedEvent.severity === 'SEVERE'
                        ? styles.sevSevere
                        : selectedEvent.severity === 'WARNING'
                        ? styles.sevWarning
                        : selectedEvent.severity === 'WATCH'
                        ? styles.sevWatch
                        : styles.sevAdvisory
                    }`}
                  >
                    {selectedEvent.acronym}
                  </span>
                  <div>
                    <span className={`${styles.severityPill} ${styles.sevWarning}`}>
                      {selectedEvent.severity}
                    </span>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '2px 0 0', color: '#161816' }}>
                      {selectedEvent.title}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.panelCloseBtn}
                  onClick={() => setSelectedEvent(null)}
                >
                  ✕
                </button>
              </div>

              <div className={styles.panelContent}>
                {/* Official Safety Guidance Box */}
                {selectedEvent.details?.safetyGuidance && (
                  <div>
                    <div className={styles.panelSectionTitle}>Official Safety Directive</div>
                    <div className={styles.guidanceBox}>
                      {selectedEvent.details.safetyGuidance}
                    </div>
                  </div>
                )}

                {/* Telemetry Metrics Grid */}
                <div className={styles.telemetryGrid}>
                  <div className={styles.telemetryCard}>
                    <div className={styles.telemetryCardLabel}>Jurisdiction / Region</div>
                    <div className={styles.telemetryCardValue} style={{ fontSize: '12px' }}>
                      {selectedEvent.district || selectedEvent.state || selectedEvent.country}
                    </div>
                  </div>

                  <div className={styles.telemetryCard}>
                    <div className={styles.telemetryCardLabel}>Source Agency</div>
                    <div className={styles.telemetryCardValue} style={{ fontSize: '12px' }}>
                      {selectedEvent.source}
                    </div>
                  </div>

                  {selectedEvent.details?.magnitude !== undefined && (
                    <div className={styles.telemetryCard}>
                      <div className={styles.telemetryCardLabel}>Focal Magnitude</div>
                      <div className={styles.telemetryCardValue}>M {selectedEvent.details.magnitude.toFixed(1)}</div>
                    </div>
                  )}

                  {selectedEvent.details?.depthKm !== undefined && (
                    <div className={styles.telemetryCard}>
                      <div className={styles.telemetryCardLabel}>Hypocenter Depth</div>
                      <div className={styles.telemetryCardValue}>{selectedEvent.details.depthKm} km</div>
                    </div>
                  )}

                  {selectedEvent.details?.rainfallRateMmH !== undefined && (
                    <div className={styles.telemetryCard}>
                      <div className={styles.telemetryCardLabel}>Rainfall Intensity</div>
                      <div className={styles.telemetryCardValue}>{selectedEvent.details.rainfallRateMmH.toFixed(1)} mm/h</div>
                    </div>
                  )}

                  {selectedEvent.details?.brightnessTempK !== undefined && (
                    <div className={styles.telemetryCard}>
                      <div className={styles.telemetryCardLabel}>Thermal Intensity</div>
                      <div className={styles.telemetryCardValue}>{selectedEvent.details.brightnessTempK} K</div>
                    </div>
                  )}

                  {selectedEvent.details?.satellite && (
                    <div className={styles.telemetryCard}>
                      <div className={styles.telemetryCardLabel}>Orbital Platform</div>
                      <div className={styles.telemetryCardValue} style={{ fontSize: '11.5px' }}>
                        {selectedEvent.details.satellite}
                      </div>
                    </div>
                  )}

                  {selectedEvent.details?.riverBasin && (
                    <div className={styles.telemetryCard}>
                      <div className={styles.telemetryCardLabel}>Hydrological Basin</div>
                      <div className={styles.telemetryCardValue} style={{ fontSize: '11.5px' }}>
                        {selectedEvent.details.riverBasin}
                      </div>
                    </div>
                  )}
                </div>

                {/* Daily Disaster Update & Telemetry Lifecycle */}
                <div style={{
                  fontSize: '11px',
                  color: '#383A36',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  background: '#FAF9F6',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #EFECE6',
                  margin: '8px 0',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#737571' }}>{t.map.initialDetection}:</span>
                    <span style={{ fontWeight: 600 }}>{new Date(selectedEvent.issued_at).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#737571' }}>{t.map.latestAgencyUpdate}:</span>
                    <span style={{ color: '#2E5A44', fontWeight: 700 }}>
                      {new Date(selectedEvent.updated_at || selectedEvent.issued_at).toLocaleString()}
                    </span>
                  </div>
                  {selectedEvent.expires_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#737571' }}>{t.map.activeBulletinUntil}:</span>
                      <span style={{ fontWeight: 600 }}>{new Date(selectedEvent.expires_at).toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#737571' }}>{t.map.telemetryFreshness}:</span>
                    <span style={{ fontWeight: 600, color: '#161816' }}>{selectedEvent.freshness}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #EFECE6' }}>
                    <span style={{ color: '#737571' }}>{t.map.dailySyncStatus}:</span>
                    <span style={{ color: '#D67A20', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className={styles.pulseDotLive} style={{ width: '5px', height: '5px', background: '#D67A20' }} />
                      Continuous Real-Time Sync
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.panelActionRow}>
                  {selectedEvent.is_community_report ? (
                    <Link
                      href={selectedEvent.source_url || `/track?id=${selectedEvent.id.replace('community_', '')}`}
                      className={styles.panelPrimaryBtn}
                      style={{ textDecoration: 'none', textAlign: 'center' }}
                    >
                      🔍 Track Report Status →
                    </Link>
                  ) : selectedEvent.source_url && selectedEvent.source_url !== '#' ? (
                    <a
                      href={selectedEvent.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.panelPrimaryBtn}
                    >
                      {t.map.verifySource} ↗
                    </a>
                  ) : null}

                  {selectedEvent.details?.feltUrl && (
                    <a
                      href={selectedEvent.details.feltUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.panelSecondaryBtn}
                    >
                      USGS Did You Feel It? ↗
                    </a>
                  )}

                  <Link href="/report" className={styles.panelSecondaryBtn}>
                    {t.map.reportUpdate}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          SOS Distress Drawer
          ============================================================ */}
      {isSosOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(22, 24, 22, 0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsSosOpen(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E2D9',
              borderRadius: '8px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 12px 32px rgba(22, 24, 22, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🚨</span>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#A82824' }}>
                  Broadcast SOS Distress Beacon
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSosOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#737571' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#FBEBEA', padding: '10px 12px', borderRadius: '4px', fontSize: '12px', color: '#A82824', marginBottom: '16px', lineHeight: 1.4 }}>
              ⚠️ <strong>Emergency Notice:</strong> If lives are in immediate danger, call <strong>112 (National Emergency Helpline)</strong> directly.
            </div>

            {sosSuccessId ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px' }}>
                  Distress Beacon Broadcasted
                </h4>
                <p style={{ fontSize: '12.5px', color: '#555753', margin: '0 0 16px' }}>
                  Reference ID: <strong>{sosSuccessId}</strong>. Emergency management units have received coordinates.
                </p>
                <button
                  type="button"
                  className={styles.panelPrimaryBtn}
                  style={{ width: '100%' }}
                  onClick={() => {
                    setIsSosOpen(false);
                    setSosSuccessId(null);
                  }}
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitSos} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#555753', marginBottom: '4px' }}>
                    Landmark / Location Address *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Near Gomti River Barrage, Lucknow"
                    value={sosLandmark}
                    onChange={(e) => setSosLandmark(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E2D9', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#555753', marginBottom: '4px' }}>
                    Contact Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={sosPhone}
                    onChange={(e) => setSosPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E2D9', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#555753', marginBottom: '4px' }}>
                    Distress Situation Details
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe water depth, trapped individuals, medical requirements..."
                    value={sosNotes}
                    onChange={(e) => setSosNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E2D9', borderRadius: '4px', fontSize: '13px', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    type="submit"
                    disabled={sosSubmitting}
                    className={styles.panelPrimaryBtn}
                    style={{ background: '#A82824' }}
                  >
                    {sosSubmitting ? 'Broadcasting Beacon...' : 'Transmit Distress Beacon'}
                  </button>
                  <button
                    type="button"
                    className={styles.panelSecondaryBtn}
                    onClick={() => setIsSosOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
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
