'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Alert, Report, HazardCategory } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { TechnicalWeatherVisual } from '@/components/TechnicalWeatherVisual';
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
    updatedAt?: string;
  } | null>(null);

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

  // Fetch live alerts & stats from store with fast 3-second polling
  const fetchData = useCallback(async () => {
    try {
      const timestamp = Date.now();
      const [alertsRes, reportsRes, statsRes] = await Promise.all([
        fetch(`/api/alerts?status=active&_t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/reports?limit=50&_t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/stats?_t=${timestamp}`, { cache: 'no-store' }),
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
          SECTION 1: Asymmetrical Editorial Hero (Split Layout)
          ============================================================ */}
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            {/* Left Column: Editorial Typography & Directives */}
            <div className={styles.heroContent}>
              <div className={styles.liveTelemetryPill}>
                <span className={styles.liveTelemetryDot} />
                <span className={styles.liveTelemetryText}>
                  {liveLucknowData
                    ? `National Doppler Network · ${liveLucknowData.weatherCondition || 'Operational'} · ${liveLucknowData.temperature ?? 28}°C`
                    : 'National Doppler Network · 45 Radar Stations Operational'}
                </span>
              </div>

              <h1 className={styles.headline}>
                {t.hero.headlineLine1}<br />
                <span className={styles.headlineAccent}>{t.hero.headlineLine2}</span>
              </h1>

              <p className={styles.supportingText}>
                {t.hero.supportingText}
              </p>

              <div className={styles.ctaGroup}>
                <Link href="/map" className={styles.primaryPillCta} id="hero-primary-cta">
                  <span>{t.hero.viewRisk}</span>
                  <span className={styles.ctaArrow}>→</span>
                </Link>
                <Link href="/report" className={styles.secondaryPillCta} id="hero-report-cta">
                  <span>{t.hero.reportHazard}</span>
                  <span className={styles.ctaArrow}>+</span>
                </Link>
              </div>

              <div className={styles.heroTrustLine}>
                <span>🏛️ Official Integration: IMD · NDMA · CWC · INCOIS</span>
              </div>
            </div>

            {/* Right Column: Framed Platform Visual with Floating Elements */}
            <div className={styles.heroVisualWrapper}>
              <div className={styles.framedPlatformCard}>
                <div className={styles.framedWindowBar}>
                  <div className={styles.framedWindowDots}>
                    <span className={styles.windowDot} />
                    <span className={styles.windowDot} />
                    <span className={styles.windowDot} />
                  </div>
                  <span className={styles.framedWindowLabel}>
                    {liveLucknowData ? `LUCKNOW RADAR // AWADH BASIN · ${liveLucknowData.temperature ?? 28}°C` : 'LUCKNOW RADAR // AWADH BASIN · 26.85°N 80.95°E'}
                  </span>
                </div>

                <TechnicalWeatherVisual
                  activeHazardsCount={activeHazards.length}
                  locationLabel={liveLucknowData ? `LUCKNOW RADAR // AWADH BASIN · ${liveLucknowData.temperature ?? 28}°C` : 'LUCKNOW RADAR // AWADH BASIN · 26.85°N 80.95°E'}
                />

                <div className={styles.floatingChipLeft}>
                  <span>📍 45 Doppler Nodes Active</span>
                </div>

                <div className={styles.floatingChipRight}>
                  <span>🛡️ 100% Verified Directives</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2: Real-time Safety Intelligence (Alternating Block A: Text Left, Visual Right)
          ============================================================ */}
      <section className={styles.alternatingSection}>
        <div className={styles.container}>
          <div className={styles.blockGrid}>
            {/* Text Column */}
            <div className={styles.editorialTextCol}>
              <span className={styles.eyebrowTag}>01 // OFFICIAL ADVISORIES</span>
              <h2 className={styles.editorialHeadline}>
                Directives verified by human meteorologists, not algorithms.
              </h2>
              <p className={styles.editorialBody}>
                During extreme monsoon spells and sudden storm surges, automated broadcasts and unverified social rumours cause panic. Suraksha Setu aggregates bulletins directly from India Meteorological Department (IMD), National Disaster Management Authority (NDMA), and Central Water Commission (CWC) — authenticating each before public broadcast.
              </p>
              <div className={styles.authorityBadgesRow}>
                <span className={styles.authorityBadge}>🏛️ IMD NWFC</span>
                <span className={styles.authorityBadge}>🌊 Central Water Commission</span>
                <span className={styles.authorityBadge}>🛡️ NDMA India</span>
                <span className={styles.authorityBadge}>🌊 INCOIS Coastal</span>
              </div>
              <Link href="/map" className={styles.editorialActionLink}>
                <span>Explore Active Bulletins on Live Map</span>
                <span>→</span>
              </Link>
            </div>

            {/* Visual Column: Active Advisories Surface Card */}
            <div className={styles.editorialCard}>
              <div className={styles.cardHeaderRow}>
                <h3 className={styles.cardHeaderTitle}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D76D63', display: 'inline-block' }} />
                  Active Official Advisories
                </h3>
                <span className={styles.cardHeaderBadge}>
                  {alerts.length > 0 ? `${alerts.length} Official Bulletins` : 'Human Verified'}
                </span>
              </div>

              <div className={styles.feedList}>
                {loading ? (
                  <p style={{ color: '#8FA2AD', fontSize: '13px' }}>Connecting to public safety network…</p>
                ) : alerts.length === 0 ? (
                  <p style={{ color: '#8FA2AD', fontSize: '13px' }}>No active emergency directives at this hour.</p>
                ) : (
                  alerts.slice(0, 3).map((alert) => {
                    const severity = SEVERITY_LABELS[alert.severity];
                    const relativeTime = formatRelativeTime(alert.updatedAt || alert.createdAt);
                    return (
                      <Link key={alert.id} href={`/alerts/${alert.id}`} className={styles.alertItemCard}>
                        <div className={styles.alertItemTop}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span className={`badge badge-${alert.severity >= 4 ? 'critical' : alert.severity >= 3 ? 'high' : 'moderate'}`}>
                              {severity.label}
                            </span>
                            <span style={{ fontSize: 12, color: '#60717B', fontWeight: 600 }}>
                              📍 {alert.areaName || 'Designated Risk Zone'}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: '#8FA2AD', fontWeight: 600 }}>
                            ⏱ {relativeTime}
                          </span>
                        </div>
                        <h4 className={styles.alertItemHeadline}>{alert.headline}</h4>
                        <p className={styles.alertItemGuidance}>{alert.guidance.slice(0, 120)}…</p>
                        <div className={styles.alertItemFooter}>
                          <span>🏛️ {alert.source}</span>
                          <span style={{ color: '#4C8DA2', fontWeight: 600 }}>Inspect Alert →</span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3: Live Incident Monitoring (Alternating Block B: Visual Left, Text Right)
          ============================================================ */}
      <section className={styles.alternatingSectionTinted}>
        <div className={styles.container}>
          <div className={styles.blockGridReversed}>
            {/* Visual Column: Live Ground Observations Surface Card */}
            <div className={styles.editorialCard}>
              <div className={styles.cardHeaderRow}>
                <h3 className={styles.cardHeaderTitle}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4C8B71', display: 'inline-block' }} />
                  Live Ground Observations
                </h3>
                <Link href="/report" style={{ fontSize: 12.5, color: '#4C8DA2', textDecoration: 'none', fontWeight: 700 }}>
                  + Submit Report
                </Link>
              </div>

              <div className={styles.feedList}>
                {loading ? (
                  <p style={{ color: '#8FA2AD', fontSize: '13px' }}>Connecting to ground observations…</p>
                ) : reports.length === 0 ? (
                  <p style={{ color: '#8FA2AD', fontSize: '13px' }}>Zero unaddressed ground hazards reported.</p>
                ) : (
                  reports.slice(0, 3).map((report) => {
                    const hazard = HAZARD_CATEGORIES[report.category];
                    const isVerified = report.verificationStatus === 'VERIFIED_GENUINE';
                    const hasAction = Boolean(
                      report.currentActionCategory &&
                      report.currentActionCategory !== 'Pending Verification' &&
                      report.currentActionCategory !== 'Verified Genuine — Pending Tactical Action'
                    );
                    const relativeTime = formatRelativeTime(report.updatedAt || report.createdAt);
                    return (
                      <div key={report.id} className={styles.reportItemCard}>
                        <div className={styles.reportItemHeader}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className={styles.reportCategoryText}>
                              {hazard?.icon} {hazard?.label || report.category}
                            </span>
                            <span className={`badge badge-${report.severity >= 4 ? 'high' : report.severity >= 3 ? 'moderate' : 'low'}`}>
                              Level {report.severity}
                            </span>
                            {report.waterDepthFeet ? (
                              <span className={styles.waterDepthTag}>
                                💧 {report.waterDepthFeet} ft
                              </span>
                            ) : null}
                          </div>
                          <span style={{ fontSize: 11, color: '#8FA2AD', fontWeight: 600 }}>
                            ⏱ {relativeTime}
                          </span>
                        </div>
                        <p className={styles.reportItemDesc}>{report.description}</p>
                        {report.landmark && (
                          <div className={styles.reportItemLandmark}>
                            <span>📍</span>
                            <span>{report.landmark}</span>
                          </div>
                        )}
                        <div className={styles.reportItemMeta}>
                          <span style={{ fontSize: '11px', color: '#8FA2AD' }}>
                            👤 {report.reporterPseudonym || 'Citizen Reporter'}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            background: hasAction ? 'rgba(76, 141, 162, 0.1)' : isVerified ? 'rgba(76, 139, 113, 0.1)' : 'rgba(215, 170, 99, 0.12)',
                            color: hasAction ? '#4C8DA2' : isVerified ? '#4C8B71' : '#D7AA63',
                            border: `1px solid ${hasAction ? 'rgba(76, 141, 162, 0.25)' : isVerified ? 'rgba(76, 139, 113, 0.25)' : 'rgba(215, 170, 99, 0.25)'}`
                          }}>
                            {hasAction ? `🚨 ${report.currentActionCategory}` : isVerified ? '✓ Verified Genuine' : '⏱ Queued for Radar Triage'}
                          </span>
                        </div>
                        <div className={styles.reportActionsRow}>
                          <button
                            type="button"
                            onClick={() => {
                              setTrackInput(report.id);
                              performTrack(report.id);
                              const el = document.getElementById('editorial-tracker');
                              el?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '11px', padding: '5px 12px', flex: 1, borderRadius: '9999px', cursor: 'pointer' }}
                          >
                            🔍 Track Live Status →
                          </button>
                          <Link
                            href={`/map?lat=${report.location.latitude}&lng=${report.location.longitude}&highlight=${report.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '9999px', textDecoration: 'none' }}
                          >
                            🗺️ Map
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Text Column */}
            <div className={styles.editorialTextCol}>
              <span className={styles.eyebrowTag}>02 // CROWD-SOURCED GROUND TRUTH</span>
              <h2 className={styles.editorialHeadline}>
                Hyperlocal observations from citizens on the ground.
              </h2>
              <p className={styles.editorialBody}>
                When an urban underpass floods or a coastal seawall is breached, eyewitnesses provide the earliest spatial evidence. Geotagged citizen reports are mapped into discrete H3 hexagonal partitions, clustered spatially, and cross-referenced with rain gauges to verify depth and risk severity.
              </p>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Link href="/report" className={styles.primaryPillCta}>
                  <span>Report a Hazard</span>
                  <span className={styles.ctaArrow}>+</span>
                </Link>
                <Link href="/map" className={styles.editorialActionLink}>
                  <span>Open Live Map View →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4: Emergency Reporting & Live Tracker (Alternating Block C: Text Left, Visual Right)
          ============================================================ */}
      <section className={styles.alternatingSection} id="editorial-tracker">
        <div className={styles.container}>
          <div className={styles.blockGrid}>
            {/* Text Column */}
            <div className={styles.editorialTextCol}>
              <span className={styles.eyebrowTag}>03 // TRANSPARENT REPORTING & SOS</span>
              <h2 className={styles.editorialHeadline}>
                Report in 60 seconds. Track tactical response in real time.
              </h2>
              <p className={styles.editorialBody}>
                Zero mandatory signup required. Capture standing water, fallen powerlines, or squall damage with automatic photo compression (&lt;150KB) and offline queuing. Follow municipal dewatering and rescue units as they mobilize. For life-threatening emergencies, trigger direct SOS dispatch.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <Link href="/report" className={styles.primaryPillCta}>
                  <span>Submit Ground Report</span>
                  <span className={styles.ctaArrow}>+</span>
                </Link>
                <Link href="/sos" className={styles.emergencySosPill}>
                  <span>🚨 Emergency SOS</span>
                  <span className={styles.ctaArrow}>→</span>
                </Link>
              </div>
            </div>

            {/* Visual Column: Interactive Report Status Tracker */}
            <div className={styles.editorialCard}>
              <div className={styles.cardHeaderRow}>
                <h3 className={styles.cardHeaderTitle}>
                  <span>🔍</span>
                  Citizen Transparency Tracker
                </h3>
                <span className={styles.cardHeaderBadge}>Real-Time Telemetry</span>
              </div>

              <div className={styles.trackerBox}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    performTrack(trackInput);
                  }}
                  className={styles.trackerInputRow}
                >
                  <input
                    type="text"
                    value={trackInput}
                    onChange={(e) => setTrackInput(e.target.value)}
                    placeholder="Enter Report ID (e.g. rep_del_pragati_01)"
                    className={styles.trackerInput}
                  />
                  <button type="submit" disabled={trackingLoading} className={styles.trackerSubmitBtn}>
                    {trackingLoading ? 'Checking…' : 'Track'}
                  </button>
                </form>

                {/* Quick Select Pill Buttons */}
                <div className={styles.trackerPillsRow}>
                  <span style={{ fontSize: '11px', color: '#8FA2AD', fontWeight: 600 }}>Quick Inspect:</span>
                  {reports.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setTrackInput(r.id);
                        performTrack(r.id);
                      }}
                      className={styles.trackerPillTag}
                    >
                      {r.id.slice(0, 14)}
                    </button>
                  ))}
                </div>

                {/* Tracking Result Card */}
                {trackingData && (
                  <div className={styles.trackerResultCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8FA2AD', fontWeight: 600 }}>ACTIVE HAZARD DOSSIER</div>
                        <strong style={{ fontSize: '14px', color: '#1F3440' }}>
                          {HAZARD_CATEGORIES[trackingData.category as HazardCategory]?.label || trackingData.category} (Level {trackingData.severity})
                        </strong>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        background: 'rgba(76, 139, 113, 0.1)',
                        color: '#4C8B71',
                        border: '1px solid rgba(76, 139, 113, 0.25)'
                      }}>
                        {trackingData.currentActionCategory || 'Under Active Triage'}
                      </span>
                    </div>

                    {/* 4-Stage Stepper */}
                    <div className={styles.trackerStagesStepper}>
                      {(trackingData.stages || [
                        { name: '1. Ingested', completed: true },
                        { name: '2. Doppler Radar', completed: trackingData.stage >= 2 },
                        { name: '3. Human Verified', completed: trackingData.stage >= 3 },
                        { name: '4. Action Taken', completed: trackingData.stage >= 4 },
                      ]).map((stg, idx) => {
                        const isDone = stg.completed;
                        return (
                          <div key={idx} className={styles.trackerStageItem}>
                            <span className={`${styles.trackerStageDot} ${isDone ? styles.trackerStageDotActive : ''}`}>
                              {isDone ? '✓' : idx + 1}
                            </span>
                            <span className={`${styles.trackerStageName} ${isDone ? styles.trackerStageNameActive : ''}`}>
                              {stg.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {trackingData.landmark && (
                      <div style={{ fontSize: '12px', color: '#60717B' }}>
                        📍 <strong>Landmark:</strong> {trackingData.landmark}
                      </div>
                    )}

                    {trackingData.verificationRationale && (
                      <div style={{ fontSize: '11.5px', color: '#60717B', background: '#FFFFFF', padding: '8px 12px', borderRadius: '10px', border: '1px solid #C8E3EA' }}>
                        📡 <strong>Doppler Reviewer Note:</strong> {trackingData.verificationRationale}
                      </div>
                    )}
                  </div>
                )}

                {trackingError && (
                  <p style={{ color: '#D76D63', fontSize: '12px', margin: 0 }}>{trackingError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5: Community Protection Features (4-Card Magazine Grid)
          ============================================================ */}
      <section className={styles.alternatingSectionTinted}>
        <div className={styles.container}>
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <span className={styles.eyebrowTag}>04 // PROTECTION ARCHITECTURE</span>
            <h2 className={styles.editorialHeadline}>
              Engineered for high-stakes monsoon resilience.
            </h2>
            <p className={styles.editorialBody} style={{ margin: '0 auto' }}>
              Every layer of the platform is designed to eliminate false alarms and deliver actionable clarity when municipal infrastructure is strained.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIconWrap}>📡</div>
              <h3 className={styles.featureCardTitle}>Doppler Multi-Station Triangulation</h3>
              <p className={styles.featureCardDesc}>
                Dual-polarization S-band sweeps monitor cloud top reflectivity across 45 national radar stations, distinguishing genuine cloudbursts from light rainfall before issuing emergency directives.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconWrap}>🛡️</div>
              <h3 className={styles.featureCardTitle}>False Alarm & Panic Filtering</h3>
              <p className={styles.featureCardDesc}>
                Spatial clustering algorithms group adjacent H3 hexagonal cells and cross-validate crowd observations with nearby automated weather stations to eliminate duplicate or fraudulent submissions.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconWrap}>🌐</div>
              <h3 className={styles.featureCardTitle}>Multilingual CAP 1.2 Standards</h3>
              <p className={styles.featureCardDesc}>
                Adheres strictly to the ITU-T X.1303 Common Alerting Protocol, broadcasting actionable advisories across 6 Indian languages so every community receives clear, immediate life-safety guidance.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconWrap}>⚡</div>
              <h3 className={styles.featureCardTitle}>Offline-First Telemetry</h3>
              <p className={styles.featureCardDesc}>
                Full client-side storage buffering guarantees that hazard observations taken during heavy cellular network blackouts are retained safely on-device and synchronized instantly upon reconnection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 6: Analytics & National Readiness (Editorial Spread)
          ============================================================ */}
      <section className={styles.alternatingSection}>
        <div className={styles.container}>
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <span className={styles.eyebrowTag}>05 // NATIONAL READINESS</span>
            <h2 className={styles.editorialHeadline}>
              Public safety operational readiness at a glance.
            </h2>
            <p className={styles.editorialBody} style={{ margin: '0 auto' }}>
              Continuous multi-hazard surveillance operating 24 hours a day across 28 States and 8 Union Territories.
            </p>
          </div>

          <div className={styles.analyticsSpread}>
            <div className={styles.metricTile}>
              <span className={styles.metricBigNumber}>45</span>
              <span className={styles.metricTileLabel}>Doppler Radar Stations Monitored</span>
            </div>
            <div className={styles.metricTile}>
              <span className={styles.metricBigNumber}>&lt; 90s</span>
              <span className={styles.metricTileLabel}>Median Verification Turnaround</span>
            </div>
            <div className={styles.metricTile}>
              <span className={styles.metricBigNumber}>100%</span>
              <span className={styles.metricTileLabel}>Human-in-the-Loop Validated Directives</span>
            </div>
            <div className={styles.metricTile}>
              <span className={styles.metricBigNumber}>Zero</span>
              <span className={styles.metricTileLabel}>Personal Identity Data Exposed</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 7: Trust, Governance & Privacy (Editorial Spread)
          ============================================================ */}
      <section className={styles.alternatingSectionTinted}>
        <div className={styles.container}>
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <span className={styles.eyebrowTag}>06 // TRUST & GOVERNANCE</span>
            <h2 className={styles.editorialHeadline}>
              Built on institutional trust and scientific integrity.
            </h2>
          </div>

          <div className={styles.trustSpreadCard}>
            <div className={styles.trustCol}>
              <h3 className={styles.trustColTitle}>
                <span>🏛️</span>
                Institutional Alignment
              </h3>
              <p className={styles.trustColText}>
                Suraksha Setu synthesizes real-time feeds from the India Meteorological Department (IMD), National Disaster Management Authority (NDMA), Central Water Commission (CWC), and INCOIS. Every advisory meets rigorous government standards, ensuring responders and citizens act on authoritative, calibrated data.
              </p>
            </div>

            <div className={styles.trustCol}>
              <h3 className={styles.trustColTitle}>
                <span>🔒</span>
                Cryptographic Audit & Privacy
              </h3>
              <p className={styles.trustColText}>
                Citizen privacy is preserved by architecture: phone numbers and exact home coordinates are never made public, with locations generalized into spatial hexagons. Duty officer directives and reviewer authorizations are sealed with tamper-evident audit timestamps for public accountability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 8: Final Storytelling Banner / Call to Action (Reference Match)
          ============================================================ */}
      <section className={styles.finalCtaSection}>
        <div className={styles.finalCtaContainer}>
          <span className={styles.finalCtaBadge}>PAN-INDIA PUBLIC SAFETY NETWORK</span>
          <h2 className={styles.finalCtaTitle}>
            Weather clarity built for the safety of every citizen.
          </h2>
          <p className={styles.finalCtaSubtitle}>
            Whether reporting street waterlogging in your neighbourhood or coordinating municipal emergency response units, Suraksha Setu provides verified, human-confirmed intelligence when every minute matters.
          </p>
          <div className={styles.finalCtaButtonGroup}>
            <Link href="/report" className={styles.primaryPillCta}>
              <span>Report Local Hazard</span>
              <span className={styles.ctaArrow}>+</span>
            </Link>
            <Link href="/authorities" className={styles.secondaryWhitePillCta}>
              <span>Authority Operations Console</span>
              <span className={styles.ctaArrow}>→</span>
            </Link>
            <Link href="/map" className={styles.editorialActionLink}>
              <span>Explore National Risk Map →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 9. Universal Production Footer */}
      <Footer />
    </div>
  );
}
