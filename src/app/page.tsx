'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Alert, Report, HazardCategory, SosRequest } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import { Navbar } from '@/components/Navbar';
import { HeroIndiaVectorMap } from '@/components/HeroIndiaVectorMap';
import { DopplerRadarMapCard } from '@/components/DopplerRadarMapCard';
import { BridgeResponseVisual } from '@/components/BridgeResponseVisual';
import { useSmoothCounter, useInView, useSubtleParallax } from '@/hooks/useMotion';
import { translations, getSavedLanguage, type Language } from '@/lib/i18n';
import { getClientReports, subscribeToSync, isDemoReport } from '@/lib/clientSync';
import styles from './page.module.css';

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Active';
  try {
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return 'Active';
    const diff = Math.floor((Date.now() - time) / 1000);
    if (diff < 60) return 'Just now';
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'Active';
  }
}

export default function LandingPage() {
  const [lang, setLang] = useState<Language>('en');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [latestSos, setLatestSos] = useState<SosRequest | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Real-time Lucknow Telemetry for Doppler radar context
  const [liveLucknowData, setLiveLucknowData] = useState<{
    temperature?: number;
    weatherCondition?: string;
    precipitation?: number;
    windSpeed?: number;
    relativeHumidity?: number;
    cloudCover?: number;
    weatherCode?: number;
    threatLevel?: string;
    updatedAt?: string;
  } | null>(null);

  const [opsMode, setOpsMode] = useState<'sos' | 'radar'>('sos');

  const handlePingRadar = useCallback((type: 'sos' | 'radar') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('suraksha-radar-ping', { detail: { type } }));
    }
  }, []);

  // Subtle parallax for the hero telemetry deck (max 20px)
  const heroParallaxY = useSubtleParallax(0.025, 20);

  // Dynamically computed counters from live telemetry and actual reports (Section 4)
  const { ref: impactRef, isInView: impactInView } = useInView({ threshold: 0.2 });
  const realReportsCount = stats.totalReports ?? reports.length;
  const realDistrictsCount = reports.length > 0 ? new Set(reports.map((r) => r.landmark).filter(Boolean)).size : 0;
  const realHazardsResolved = reports.filter((r) => r.status === 'RESOLVED' || r.currentActionCategory === 'Hazard Resolved').length;
  const realSourcesHealthy = stats.sourcesHealthy ?? 45;
  const realSourcesTotal = stats.sourcesTotal ?? 45;

  const animReports = useSmoothCounter(realReportsCount, 1200, impactInView);
  const animDistricts = useSmoothCounter(realDistrictsCount, 1200, impactInView);
  const animHazards = useSmoothCounter(realHazardsResolved, 1200, impactInView);
  const animSources = useSmoothCounter(realSourcesHealthy, 1200, impactInView);

  // Active ground hazards currently reported and unaddressed
  const activeHazards = reports.filter(
    (r) => r.status !== 'DISMISSED' && r.status !== 'RESOLVED' && r.verificationStatus !== 'FLAGGED_FALSE_REPORT'
  );

  // Fetch real-time Lucknow weather conditions on mount
  useEffect(() => {
    async function fetchLucknowWeather() {
      try {
        const res = await fetch('/api/weather/live?lat=26.8467&lng=80.9462', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setLiveLucknowData(json.data);
          }
        }
      } catch (err) {
        console.warn('Lucknow weather telemetry sync note:', err);
      }
    }

    fetchLucknowWeather();
    const interval = setInterval(fetchLucknowWeather, 120000); // 2-minute refresh
    return () => clearInterval(interval);
  }, []);

  // Fetch live alerts, stats & real SOS from store with fast 3-second polling
  const fetchData = useCallback(async () => {
    try {
      const timestamp = Date.now();
      const [alertsRes, reportsRes, statsRes, sosRes] = await Promise.all([
        fetch(`/api/alerts?status=active&_t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/reports?limit=50&_t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/stats?_t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/sos?_t=${timestamp}`, { cache: 'no-store' }),
      ]);

      if (alertsRes.ok) {
        const d = await alertsRes.json();
        setAlerts(d.data || []);
      }
      if (reportsRes.ok) {
        const d = await reportsRes.json();
        const serverReps: Report[] = (d.data || []).filter((r: Report) => !isDemoReport(r));
        const clientReps: Report[] = getClientReports().filter((r: Report) => !isDemoReport(r));

        const mergedMap = new Map<string, Report>();
        for (const sr of serverReps) {
          mergedMap.set(sr.id.toLowerCase(), sr);
        }
        for (const cr of clientReps) {
          const existing = mergedMap.get(cr.id.toLowerCase());
          if (existing) {
            const crHasAction = cr.currentActionCategory && cr.currentActionCategory !== 'Pending Verification';
            const srHasAction = existing.currentActionCategory && existing.currentActionCategory !== 'Pending Verification';
            if (crHasAction && !srHasAction) {
              mergedMap.set(cr.id.toLowerCase(), { ...existing, ...cr });
            } else {
              mergedMap.set(cr.id.toLowerCase(), { ...cr, ...existing });
            }
          } else {
            mergedMap.set(cr.id.toLowerCase(), cr);
          }
        }

        const sorted = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setReports(sorted);
      }
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.data || {});
      }
      if (sosRes.ok) {
        const d = await sosRes.json();
        const list: SosRequest[] = d.data || [];
        const active = list.find((s) => s.status !== 'RESOLVED_SAFE') || list[0] || null;
        setLatestSos(active);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  // Tracking state for dedicated landing page tracker
  const [trackInput, setTrackInput] = useState('');
  const [activeTrackedId, setActiveTrackedId] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<{
    id: string;
    status: string;
    verificationStatus?: string;
    verificationRationale?: string;
    firstActionTaken?: string;
    currentActionCategory?: string;
    actionHistory?: Array<{
      id: string;
      action: string;
      actorName: string;
      notes?: string;
      timestamp: string;
    }>;
    stage: number;
    stages: Array<{
      name: string;
      completed: boolean;
      timestamp?: string;
    }>;
    category: string;
    severity: number;
    description?: string;
    landmark?: string;
    waterDepthFeet?: number;
    location?: { latitude: number; longitude: number; accuracy?: number };
    mediaUrl?: string;
    createdAt?: string;
    updatedAt?: string;
    corroborationCount: number;
    weatherSignal: string;
    reviewNote: string;
  } | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingSearched, setTrackingSearched] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const performTrack = useCallback(async (id: string, silent = false) => {
    const clean = id.trim();
    if (!clean) return;
    if (!silent) {
      setTrackingLoading(true);
      setTrackingError(null);
    }
    setTrackingSearched(true);
    try {
      const res = await fetch(`/api/reports/track?id=${encodeURIComponent(clean)}&_t=${Date.now()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTrackingData(json.data);
        setActiveTrackedId(json.data.id || clean);
        setTrackingError(null);
      } else {
        if (!silent) {
          setTrackingData(null);
          setTrackingError(json.error || `No active record found for "${clean}". Please verify your Report ID.`);
        }
      }
    } catch {
      if (!silent) {
        setTrackingError('Failed to connect to tracking network. Please check network connection.');
      }
    } finally {
      if (!silent) setTrackingLoading(false);
    }
  }, []);

  // Auto-track the newest report when reports arrive if user hasn't typed anything
  useEffect(() => {
    if (!activeTrackedId && reports.length > 0) {
      const first = reports[0];
      setTrackInput(first.id);
      performTrack(first.id, true);
    }
  }, [reports, activeTrackedId, performTrack]);

  // Live polling every 3 seconds for the currently tracked report (instant cross-device sync)
  useEffect(() => {
    if (!activeTrackedId) return;
    const interval = setInterval(() => {
      performTrack(activeTrackedId, true);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTrackedId, performTrack]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Zero-latency cross-tab event synchronization
  useEffect(() => {
    const unsubscribe = subscribeToSync((msg) => {
      if (msg.type === 'PURGE_ALL') {
        fetchData();
      } else if (msg.type === 'NEW_REPORT' && msg.report && !isDemoReport(msg.report)) {
        setReports((prev) => {
          const cleanId = msg.report!.id.toLowerCase();
          const exists = prev.some((r) => r.id.toLowerCase() === cleanId);
          if (exists) {
            return prev.map((r) => (r.id.toLowerCase() === cleanId ? { ...r, ...msg.report! } : r));
          }
          return [msg.report!, ...prev];
        });
      } else if (msg.type === 'REPORT_ACTION' && msg.report) {
        setReports((prev) => {
          const cleanId = msg.report!.id.toLowerCase();
          return prev.map((r) => (r.id.toLowerCase() === cleanId ? { ...r, ...msg.report! } : r));
        });
      }
    });
    return () => unsubscribe();
  }, [fetchData]);

  return (
    <div className={styles.page}>
      {/* 1. Universal Production Header */}
      <Navbar />

      {/* ============================================================
          SECTION 1: Asymmetrical Editorial Hero with Full-Bleed Atmosphere
          ============================================================ */}
      <section className={styles.hero}>
        {/* Full-Hero Authentic Vector GIS Cartography of India & Kinetic Mesh */}
        <HeroIndiaVectorMap />

        <div className={styles.container}>
          <div className={styles.heroGrid}>
            {/* Left Column: Editorial Typography & Directives */}
            <div className={styles.heroContent}>
              <h1 className={styles.headline}>
                Weather clarity.<br />
                <span className={styles.headlineAccent}>
                  When every<br />
                  minute matters.
                </span>
              </h1>

              <p className={styles.supportingText}>
                Verified citizen ground reports and Doppler radar intelligence for safer local decisions across India.
              </p>

              <div className={styles.ctaGroup}>
                <Link href="/map" className={styles.primaryPillCta} id="hero-primary-cta">
                  <span>View local risk</span>
                  <span className={styles.ctaArrow}>→</span>
                </Link>
                <Link href="/report" className={styles.secondaryPillCta} id="hero-report-cta">
                  <span>Report a hazard</span>
                  <span className={styles.ctaArrow}>+</span>
                </Link>
              </div>

              <div className={styles.heroTrustLine}>
                <span>🏛️ Official Integration: IMD · NDMA · CWC · INCOIS</span>
              </div>
            </div>

            {/* Right Column: Interactive Emergency Operations & Radar Deck */}
            <div
              className={styles.heroVisualWrapper}
              style={{ transform: `translateY(${heroParallaxY}px)`, willChange: 'transform' }}
            >
              <div className={styles.heroAtmosphereHud}>
                <div className={styles.heroOpsDeck}>
                  {/* Mode Selector Header */}
                  <div className={styles.opsDeckHeader}>
                    <div className={styles.opsDeckTabs}>
                      <button
                        type="button"
                        className={`${styles.opsTabBtn} ${opsMode === 'sos' ? styles.opsTabBtnActiveSos : ''}`}
                        onClick={() => {
                          setOpsMode('sos');
                          handlePingRadar('sos');
                        }}
                      >
                        <span>🚨 Priority 1 SOS</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.opsTabBtn} ${opsMode === 'radar' ? styles.opsTabBtnActiveRadar : ''}`}
                        onClick={() => {
                          setOpsMode('radar');
                          handlePingRadar('radar');
                        }}
                      >
                        <span>🛰️ Doppler Radar</span>
                      </button>
                    </div>

                    <div className={styles.opsLiveIndicator}>
                      <span className={opsMode === 'sos' ? styles.liveBeaconPulse : styles.liveRadarPulse} />
                      <span>{opsMode === 'sos' ? 'DISTRESS STREAM' : 'SENTINEL LIVE'}</span>
                    </div>
                  </div>

                  {/* Dynamic Mode Content */}
                  {opsMode === 'sos' ? (
                    <div className={styles.opsCardBody}>
                      <div className={styles.opsBadgeRow}>
                        <span className={latestSos ? styles.opsUrgentBadge : styles.opsStandbyBadge}>
                          <span>{latestSos ? '⚡ CRITICAL RESCUE SIGNAL' : 'STANDBY BEACON ACTIVE'}</span>
                        </span>
                        <span className={styles.opsTimestamp}>
                          {latestSos && latestSos.location
                            ? `GPS ${latestSos.location.latitude.toFixed(2)}°N, ${latestSos.location.longitude.toFixed(2)}°E`
                            : 'GPS 26.85°N, 80.94°E · SECTOR READY'}
                        </span>
                      </div>

                      <h3 className={styles.opsMainHeadline}>
                        {latestSos ? latestSos.landmark : 'Emergency Operations Standby'}
                      </h3>
                      <p className={styles.opsMainDescription}>
                        {latestSos
                          ? `${latestSos.hazardType.toUpperCase()} distress beacon active: ${latestSos.peopleCount} ${latestSos.peopleCount === 1 ? 'person' : 'persons'} reported${latestSos.hasMedicalEmergency ? ' • Medical emergency flagged' : ''}.${latestSos.notes ? ` "${latestSos.notes}"` : ''}`
                          : '0 active citizen distress signals in current sector. Rapid rescue response standby active across NDRF & SDRF operations hubs.'}
                      </p>

                      <div className={styles.opsTelemetryGrid}>
                        <div className={styles.opsTelemetryItem}>
                          <span className={styles.opsTelemetryKey}>Status</span>
                          <span className={styles.opsTelemetryVal} style={{ color: latestSos ? '#E53E3E' : '#4C8B71' }}>
                            {latestSos ? latestSos.status.replace(/_/g, ' ') : 'STANDBY READY'}
                          </span>
                        </div>
                        <div className={styles.opsTelemetryItem}>
                          <span className={styles.opsTelemetryKey}>Unit Assigned</span>
                          <span className={styles.opsTelemetryVal} style={{ color: '#4C8B71' }}>
                            {latestSos?.dispatchedUnit || 'NDRF / SDRF Standby'}
                          </span>
                        </div>
                        <div className={styles.opsTelemetryItem}>
                          <span className={styles.opsTelemetryKey}>{latestSos ? 'Reported' : 'Telemetry Grid'}</span>
                          <span className={styles.opsTelemetryVal}>
                            {latestSos ? formatRelativeTime(latestSos.createdAt) : '100% Online'}
                          </span>
                        </div>
                      </div>

                      <div className={styles.opsActionRow}>
                        <Link href="/sos" className={styles.opsPrimaryActionBtn}>
                          <span>🚨 Open SOS Hub</span>
                        </Link>
                        <button
                          type="button"
                          className={styles.opsSecondaryActionBtn}
                          onClick={() => handlePingRadar('sos')}
                          title="Broadcast tactical ping to radar grid"
                        >
                          <span>📡 Ping Grid</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.opsCardBody}>
                      <div className={styles.opsBadgeRow}>
                        <span className={styles.opsRadarBadge}>
                          <span>🛰️ OPEN-METEO DOPPLER GRID</span>
                        </span>
                        <span className={styles.opsTimestamp}>
                          {liveLucknowData?.temperature !== undefined ? `${liveLucknowData.temperature}°C` : 'SCANNING'}
                        </span>
                      </div>

                      <h3 className={styles.opsMainHeadline}>
                        {liveLucknowData?.weatherCondition
                          ? `${liveLucknowData.weatherCondition} Telemetry`
                          : 'Doppler Station Monitoring'}
                      </h3>
                      <p className={styles.opsMainDescription}>
                        {liveLucknowData
                          ? `Live meteorological station synthesis (Lucknow 26.85°N, 80.95°E). Threat level: ${liveLucknowData.threatLevel || 'NORMAL'}. Precipitation: ${liveLucknowData.precipitation ?? 0} mm/h.`
                          : 'Real-time multi-station synthesis across Indo-Gangetic basin and national radar network.'}
                      </p>

                      <div className={styles.opsTelemetryGrid}>
                        <div className={styles.opsTelemetryItem}>
                          <span className={styles.opsTelemetryKey}>Wind Speed</span>
                          <span className={styles.opsTelemetryVal}>
                            {liveLucknowData?.windSpeed !== undefined ? `💨 ${liveLucknowData.windSpeed} km/h` : '💨 Normal'}
                          </span>
                        </div>
                        <div className={styles.opsTelemetryItem}>
                          <span className={styles.opsTelemetryKey}>Condition</span>
                          <span className={styles.opsTelemetryVal}>
                            {liveLucknowData?.weatherCondition || 'Clear'}
                          </span>
                        </div>
                        <div className={styles.opsTelemetryItem}>
                          <span className={styles.opsTelemetryKey}>Humidity</span>
                          <span className={styles.opsTelemetryVal}>
                            {liveLucknowData?.relativeHumidity !== undefined ? `💧 ${liveLucknowData.relativeHumidity}%` : 'Normal'}
                          </span>
                        </div>
                      </div>

                      <div className={styles.opsActionRow}>
                        <Link href="/map" className={styles.opsPrimaryActionBtn} style={{ background: '#1F3440' }}>
                          <span>🗺️ Full Radar Map</span>
                        </Link>
                        <button
                          type="button"
                          className={styles.opsSecondaryActionBtn}
                          onClick={() => handlePingRadar('radar')}
                          title="Trigger full sweep wave"
                        >
                          <span>🛰️ Sweep Beam</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Deck Footer */}
                  <div className={styles.opsDeckFooter}>
                    <span className={styles.opsDeckFooterLeft}>
                      <span>🏛️ IMD NWFC + NDMA Active Relay</span>
                    </span>
                    <span className={styles.opsDeckFooterRight}>
                      Mesh Latency: 42ms
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Scroll to Explore Pill */}
        <Link href="#live-risk-map" className={styles.scrollExplorePill}>
          <span className={styles.scrollExploreDot} />
          <span>SCROLL TO EXPLORE</span>
          <span>↓</span>
        </Link>
      </section>

      {/* ============================================================
          SECTION 2: LIVE RISK MAP (Matching reference media_1789797936842.jpg)
          ============================================================ */}
      <div className={styles.sectionCardContainer} id="live-risk-map">
        <div className={styles.riskMapGrid}>
          {/* Left Column: Typography, Action, and Severity Indicators */}
          <div className={styles.riskMapTextCol}>
            <span className={styles.capsuleEyebrow} style={{ background: 'transparent', padding: 0, color: '#4C8DA2' }}>
              LIVE RISK MAP
            </span>
            <h2 className={styles.riskMapHeadline}>
              Real-time intelligence across India
            </h2>
            <p className={styles.riskMapSubtitle}>
              A unified view of weather, hazards and citizen reports to help communities stay prepared.
            </p>

            <Link href="/map" className={styles.whitePillBtn}>
              <span>Explore Live Map</span>
              <span>→</span>
            </Link>

            {/* Severity Legend */}
            <div className={styles.severityDotsRow}>
              <span className={styles.severityDotItem}>
                <span className={styles.dotLow} /> Low
              </span>
              <span className={styles.severityDotItem}>
                <span className={styles.dotModerate} /> Moderate
              </span>
              <span className={styles.severityDotItem}>
                <span className={styles.dotHigh} /> High
              </span>
              <span className={styles.severityDotItem}>
                <span className={styles.dotSevere} /> Severe
              </span>
            </div>
          </div>

          {/* Right Column: Doppler Satellite Radar Map with Alert Card & Controls */}
          <div className={styles.radarCardFrame}>
            <Image
              src="/doppler-radar-hd.jpg"
              alt="Real-time Satellite Doppler Radar Map of India"
              width={640}
              height={400}
              className={styles.radarImg}
              priority
              quality={95}
            />

            {/* Dynamic Alert Callout Tooltip */}
            <div className={styles.radarAlertCallout}>
              <div className={styles.radarAlertPill}>
                <span className={styles.radarAlertPulseDot} />
                <div className={styles.radarAlertInfo}>
                  <span className={styles.radarAlertTitle}>
                    {alerts.length > 0 ? alerts[0].headline : (liveLucknowData ? `${liveLucknowData.weatherCondition} Status` : 'Normal Catchment Status')}
                  </span>
                  <span className={styles.radarAlertLocation}>
                    {alerts.length > 0 ? (alerts[0].areaName || alerts[0].category.replace(/_/g, ' ')) : 'Lucknow Radar Catchment'}
                  </span>
                </div>
              </div>
              <div className={styles.radarAlertTail} />
            </div>

            {/* Floating Map Controls */}
            <div className={styles.radarMapControls}>
              <button type="button" className={styles.radarControlBtn} title="Layer View" aria-label="Toggle Layers">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
              </button>
              <button type="button" className={styles.radarControlBtn} title="GPS Recenter" aria-label="Recenter Location">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="7"></circle>
                  <line x1="12" y1="1" x2="12" y2="4"></line>
                  <line x1="12" y1="20" x2="12" y2="23"></line>
                  <line x1="1" y1="12" x2="4" y2="12"></line>
                  <line x1="20" y1="12" x2="23" y2="12"></line>
                </svg>
              </button>
              <div className={styles.radarControlDivider} />
              <button type="button" className={styles.radarControlBtn} title="Zoom In" aria-label="Zoom In">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <button type="button" className={styles.radarControlBtn} title="Zoom Out" aria-label="Zoom Out">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 3: FASTER RESPONSE (Matching reference media_1789797936842.jpg)
          ============================================================ */}
      <section className={styles.fasterResponseSection} id="faster-response">
        <div className={styles.fasterResponseGrid}>
          {/* Left Column: Flooded Bridge Visual with Concentric Expanding Waves & Status Badge */}
          <div className={styles.bridgeCardFrame}>
            <Image
              src="/flooded-bridge-hd.jpg"
              alt="Flooded Bridge Emergency Response Scene"
              width={640}
              height={420}
              className={styles.bridgeImg}
              priority
              quality={95}
            />

            {/* Centered Red SOS Signal with Concentric Waves and Help Is On The Way Capsule */}
            <div className={styles.bridgeSosCluster}>
              <div className={styles.bridgeSosButton}>
                <span>SOS</span>
                <div className={styles.bridgeSosWaveContainer}>
                  <span className={styles.bridgeRipple} />
                  <span className={styles.bridgeRipple} />
                  <span className={styles.bridgeRipple} />
                </div>
              </div>

              <div className={styles.bridgeStatusCapsule}>
                <div className={styles.bridgeStatusCheck}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div className={styles.bridgeStatusInfo}>
                  <span className={styles.bridgeStatusTitle}>Help is on the way</span>
                  <span className={styles.bridgeStatusDesc}>NDRF team dispatched</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3 Clean Action Steps */}
          <div>
            <span className={styles.capsuleEyebrow}>FASTER RESPONSE</span>
            <h2 className={styles.fasterResponseHeadline}>
              From alert to action
            </h2>
            <p className={styles.fasterResponseSubtitle}>
              Report hazards, get assistance and track response in real time — because every minute counts.
            </p>

            <div className={styles.stepsStack}>
              <div className={styles.stepItem}>
                <div className={styles.stepIconSquircle}>
                  <span>📋</span>
                </div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>Report in seconds</h3>
                  <p className={styles.stepDesc}>Share your location and details</p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepIconSquircle}>
                  <span>👥</span>
                </div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>Live coordination</h3>
                  <p className={styles.stepDesc}>Connected with authorities</p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepIconSquircle}>
                  <span>⏱</span>
                </div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>Track progress</h3>
                  <p className={styles.stepDesc}>See real-time updates</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4: OUR IMPACT (Matching reference media_1789797936842.jpg)
          ============================================================ */}
      <div ref={impactRef} className={styles.impactSectionCard} id="our-impact">
        <div className={styles.impactGridContainer}>
          {/* Left Column: Heading & Subtitle */}
          <div className={styles.impactTextCol}>
            <span className={styles.capsuleEyebrow} style={{ background: 'transparent', padding: 0, color: '#4C8DA2' }}>
              OUR IMPACT
            </span>
            <h2 className={styles.impactHeadline}>
              Stronger communities.<br />
              A safer tomorrow.
            </h2>
            <p className={styles.impactSubtitle}>
              Powered by people, data and technology.
            </p>
          </div>

          {/* Right Column: 4 Metric Cards in a Row */}
          <div className={styles.impactCardsRow}>
            <div className={styles.impactWhiteCard}>
              <div className={styles.impactCardIcon} style={{ background: '#EAF3F7', color: '#357288' }}>
                👥
              </div>
              <span className={styles.impactCardValue}>
                {impactInView ? animReports : realReportsCount}
              </span>
              <span className={styles.impactCardLabel}>Citizen Reports</span>
            </div>

            <div className={styles.impactWhiteCard}>
              <div className={styles.impactCardIcon} style={{ background: '#E8F5EE', color: '#4C8B71' }}>
                🏛️
              </div>
              <span className={styles.impactCardValue}>
                {impactInView ? animDistricts : realDistrictsCount}
              </span>
              <span className={styles.impactCardLabel}>Districts Active</span>
            </div>

            <div className={styles.impactWhiteCard}>
              <div className={styles.impactCardIcon} style={{ background: '#E6F4F3', color: '#2F857D' }}>
                🛡️
              </div>
              <span className={styles.impactCardValue}>
                {impactInView ? animHazards : realHazardsResolved}
              </span>
              <span className={styles.impactCardLabel}>Hazards Resolved</span>
            </div>

            <div className={styles.impactWhiteCard}>
              <div className={styles.impactCardIcon} style={{ background: '#FEF7EC', color: '#D97706' }}>
                🛰️
              </div>
              <span className={styles.impactCardValue}>
                {impactInView ? `${animSources}/${realSourcesTotal}` : `${realSourcesHealthy}/${realSourcesTotal}`}
              </span>
              <span className={styles.impactCardLabel}>Live Sensor Feeds</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 5: MISTY MOUNTAIN FINAL BANNER (Matching reference media_1789797936842.jpg)
          ============================================================ */}
      <section className={styles.mistyBannerSection}>
        <div className={styles.mistyBannerOverlay} />
        <div className={styles.mistyBannerInner}>
          {/* Left Column: Heading, Subtitle & Action Buttons */}
          <div>
            <h2 className={styles.mistyHeadline}>
              Be part of a safer, more prepared India.
            </h2>
            <p className={styles.mistySubtitle}>
              Report. Stay informed. Make a difference.
            </p>
            <div className={styles.mistyButtonGroup}>
              <Link href="/report" className={styles.darkPillBtn}>
                <span>Report a hazard</span>
                <span>→</span>
              </Link>
              <Link href="/map" className={styles.whitePillBtn}>
                <span>Explore platform</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Editorial Quote */}
          <div className={styles.mistyQuoteColumn}>
            <p className={styles.mistyQuote}>
              “Safer communities<br />build stronger nations.”
            </p>
            <span className={styles.mistyAuthor}>— Suraksha Setu</span>
          </div>
        </div>
      </section>
    </div>
  );
}
