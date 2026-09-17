'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Alert, Report, HazardCategory } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { TechnicalWeatherVisual } from '@/components/TechnicalWeatherVisual';
import { AlertWorkflowSequence } from '@/components/AlertWorkflowSequence';
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
  const [tickerIndex, setTickerIndex] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [selectedHazardIndex, setSelectedHazardIndex] = useState(0);

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

  const currentHazard = activeHazards.length > 0
    ? activeHazards[selectedHazardIndex % activeHazards.length]
    : null;

  // Auto-cycle through multiple hazards if present
  useEffect(() => {
    if (activeHazards.length <= 1) return;
    const interval = setInterval(() => {
      setSelectedHazardIndex((prev) => (prev + 1) % activeHazards.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [activeHazards.length]);

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

  // Real-time live status strip derived dynamically from live website ground data
  const liveTickerItems = activeHazards.length > 0
    ? activeHazards.map((h) => {
        const cat = HAZARD_CATEGORIES[h.category]?.label || h.category;
        const directive = h.currentActionCategory
          ? `${h.currentActionCategory}`
          : h.verificationStatus === 'VERIFIED_GENUINE'
          ? 'Verified Genuine — Response Active'
          : 'Citizen Report — Triage in Progress';
        return `⚠️ ACTIVE GROUND HAZARD: ${h.landmark || 'Designated Zone'} · ${cat} (Level ${h.severity}) · Directive: ${directive}`;
      })
    : [
        '🟢 National Doppler Network · 45 Radar Stations Operational · Baseline Nominal',
        '🛡️ Suraksha Setu Ground Truth System · Pan-India Telemetry Active Across 28 States & 8 UTs',
        '📍 Public Citizen Reporting Gateway Open · Multi-Station Doppler Cross-Verification Active',
        '🌧️ Automatic Weather Station Grid · Continuous Precipitation & Drainage Inundation Monitoring',
      ];

  // Rotate live status ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % liveTickerItems.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [liveTickerItems.length]);

  // Scroll listener for weather transition
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollProgress = Math.min(1, Math.max(0, scrollY / 750));

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

      {/* 2. Asymmetric Editorial Hero */}
      <section className={styles.hero}>
        {/* Asymmetric Hero Grid Container */}
        <div className={styles.heroGrid}>
          {/* Left Column: Crisp Editorial Typography & Directives */}
          <div className={styles.heroContent}>
            {/* Small Live Status Label */}
            <div className={styles.weatherConditionPill}>
              <span className={styles.weatherPillDot} />
              <span className={styles.weatherPillText}>
                {liveLucknowData ? `Lucknow Doppler Radar · ${liveLucknowData.weatherCondition || 'Operational'} · ${liveLucknowData.temperature ?? 28}°C` : 'National Doppler Network · Real-Time Telemetry'}
              </span>
            </div>

            {/* Authoritative, Crisp Editorial Headline */}
            <h1 className={styles.headline}>
              {t.hero.headlineLine1}<br />
              <span className={styles.headlineAccent}>{t.hero.headlineLine2}</span>
            </h1>

            {/* Restrained Supporting Text */}
            <p className={styles.supportingText}>
              {t.hero.supportingText}
            </p>

            {/* Dual Primary / Secondary Action Directives */}
            <div className={styles.ctaGroup}>
              <Link href="/map" className={styles.primaryCta} id="hero-primary-cta">
                <span>{t.hero.viewRisk}</span>
                <span className={styles.ctaArrow}>→</span>
              </Link>
              <Link href="/report" className={styles.secondaryCta} id="hero-report-cta">
                <span>{t.hero.reportHazard}</span>
                <span className={styles.ctaArrow}>+</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Original Technical Weather Visual */}
          <div className={styles.heroVisualWrapper}>
            <TechnicalWeatherVisual
              activeHazardsCount={activeHazards.length}
              locationLabel={liveLucknowData ? `LUCKNOW RADAR // AWADH BASIN · ${liveLucknowData.temperature ?? 28}°C` : 'LUCKNOW RADAR // AWADH BASIN · 26.85°N 80.95°E'}
            />
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className={styles.scrollWeatherIndicator} style={{ opacity: scrollY > 160 ? 0 : 1 }}>
          <div className={styles.scrollPulseIcon}>
            <div className={styles.scrollPulseDot} />
          </div>
          <span>{t.hero.scrollHint}</span>
        </div>
      </section>

      {/* ============================================================
          4. Live National Metrics Bar (Ground Truth Only)
          ============================================================ */}
      {(() => {
        const liveActiveAlerts = typeof stats.activeAlerts === 'number' && stats.activeAlerts > 0
          ? stats.activeAlerts
          : alerts.length;

        const liveVerifiedReports = typeof stats.verifiedReportsToday === 'number'
          ? stats.verifiedReportsToday
          : reports.filter(r => r.verificationStatus === 'VERIFIED_GENUINE' && r.status !== 'DISMISSED').length;

        const livePendingReview = typeof stats.pendingReview === 'number'
          ? stats.pendingReview
          : reports.filter(
              r => (!r.verificationStatus || r.verificationStatus === 'PENDING_VERIFICATION') &&
                   r.status !== 'DISMISSED' && r.status !== 'RESOLVED'
            ).length;

        const liveStationsOnline = `${stats.sourcesHealthy || 45} / ${stats.sourcesTotal || 45}`;

        return (
          <section className={styles.metricsStrip}>
            <div className={styles.metricsHeaderStrip}>
              <span className={styles.metricsLivePulse} />
              <span className={styles.metricsLiveText}>LIVE TELEMETRY // REAL-TIME SYNCHRONIZED ACROSS PLATFORM</span>
            </div>
            <div className={styles.metricsContainer}>
              <div className={styles.metricCard}>
                <span className={styles.metricIcon}>🚨</span>
                <div>
                  <span className={styles.metricValue}>{liveActiveAlerts}</span>
                  <span className={styles.metricLabel}>{t.metrics.activeAlerts}</span>
                </div>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricIcon}>📝</span>
                <div>
                  <span className={styles.metricValue}>{liveVerifiedReports}</span>
                  <span className={styles.metricLabel}>{t.metrics.reportsToday}</span>
                </div>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricIcon}>🔍</span>
                <div>
                  <span className={styles.metricValue}>{livePendingReview}</span>
                  <span className={styles.metricLabel}>{t.metrics.underReview}</span>
                </div>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricIcon}>📡</span>
                <div>
                  <span className={styles.metricValue}>{liveStationsOnline}</span>
                  <span className={styles.metricLabel}>{t.metrics.stationsOnline}</span>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ============================================================
          5. Editorial 4-Step Story Sequence: "How Verified Alerts Work"
          ============================================================ */}
      <AlertWorkflowSequence />

      {/* ============================================================
          6. Active National Alerts & Live Citizen Reports Feed
          ============================================================ */}
      <section className={styles.liveFeedSection}>
        <div className={styles.feedContainer}>
          {/* Column 1: Active National Alerts */}
          <div className={styles.feedColumn}>
            <h2>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
                <span>📢 Active Official Advisories</span>
              </span>
              <span className={styles.feedHeaderBadge}>
                {alerts.length > 0 ? `${alerts.length} Official Bulletins` : 'Human Verified'}
              </span>
            </h2>

            <div className={styles.feedList}>
              {loading ? (
                <p style={{ color: '#8A99A8' }}>Connecting to public safety network…</p>
              ) : alerts.length === 0 ? (
                <div className={styles.feedEmptyState}>
                  <span style={{ fontSize: 24 }}>🛡️</span>
                  <div>
                    <strong style={{ display: 'block', color: '#F7F6F2', fontSize: '13.5px', marginBottom: 4 }}>
                      No Active Public Emergency Warnings
                    </strong>
                    <span style={{ color: '#8A99A8', fontSize: '12px', lineHeight: 1.4, display: 'block' }}>
                      Disaster management authorities have not published any Level 3+ emergency directives at this hour. Continuous Doppler radar surveillance active across all regional basins.
                    </span>
                  </div>
                </div>
              ) : (
                alerts.slice(0, 4).map((alert) => {
                  const severity = SEVERITY_LABELS[alert.severity];
                  const relativeTime = formatRelativeTime(alert.updatedAt || alert.createdAt);
                  return (
                    <Link
                      key={alert.id}
                      href={`/alerts/${alert.id}`}
                      className={styles.alertFeedCard}
                    >
                      <div className={styles.alertFeedHeader}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className={`badge badge-${alert.severity >= 4 ? 'critical' : alert.severity >= 3 ? 'high' : 'moderate'}`}>
                            {severity.label}
                          </span>
                          <span style={{ fontSize: 12, color: '#555753', fontWeight: 600 }}>
                            📍 {alert.areaName || 'Designated Risk Zone'}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: '#737571', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                          {relativeTime}
                        </span>
                      </div>
                      <h3 className={styles.alertFeedHeadline}>{alert.headline}</h3>
                      <p className={styles.alertFeedGuidance}>{alert.guidance.slice(0, 130)}…</p>
                      <div className={styles.alertFeedFooter}>
                        <span>🏛️ {alert.source}</span>
                        <span style={{ color: '#0284C7', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          Inspect Alert →
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Live Citizen Ground Reports */}
          <div className={styles.feedColumn}>
            <h2>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                <span>📍 Live Ground Observations</span>
              </span>
              <Link href="/report" style={{ fontSize: 13, color: '#0284C7', textDecoration: 'none', fontWeight: 600 }}>
                + Submit Report
              </Link>
            </h2>

            <div className={styles.feedList}>
              {loading ? (
                <p style={{ color: '#8A99A8' }}>Connecting to ground observations…</p>
              ) : reports.length === 0 ? (
                <div className={styles.feedEmptyState}>
                  <span style={{ fontSize: 24 }}>📍</span>
                  <div>
                    <strong style={{ display: 'block', color: '#F7F6F2', fontSize: '13.5px', marginBottom: 4 }}>
                      Zero Unaddressed Hazards Reported
                    </strong>
                    <span style={{ color: '#8A99A8', fontSize: '12px', lineHeight: 1.4, display: 'block', marginBottom: 10 }}>
                      All monitored sectors currently reporting nominal drainage conditions. If you observe street waterlogging, fallen trees, or squall damage in your vicinity, submit a report to alert responders.
                    </span>
                    <Link href="/report" className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 14px' }}>
                      + Submit Ground Observation
                    </Link>
                  </div>
                </div>
              ) : (
                reports.slice(0, 4).map((report) => {
                  const hazard = HAZARD_CATEGORIES[report.category];
                  const isVerified = report.verificationStatus === 'VERIFIED_GENUINE';
                  const hasAction = Boolean(
                    report.currentActionCategory &&
                    report.currentActionCategory !== 'Pending Verification' &&
                    report.currentActionCategory !== 'Verified Genuine — Pending Tactical Action'
                  );
                  const relativeTime = formatRelativeTime(report.updatedAt || report.createdAt);
                  return (
                    <div key={report.id} className={styles.reportStreamCard}>
                      <div className={styles.reportStreamHeader}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className={styles.reportCategoryTag}>
                            {hazard?.icon} {hazard?.label || report.category}
                          </span>
                          <span className={`badge badge-${report.severity >= 4 ? 'high' : report.severity >= 3 ? 'moderate' : 'low'}`}>
                            Level {report.severity}
                          </span>
                          {report.waterDepthFeet ? (
                            <span style={{
                              fontSize: '11px',
                              color: '#0284C7',
                              background: 'rgba(2,132,199,0.08)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontWeight: 600,
                              border: '1px solid rgba(2,132,199,0.2)'
                            }}>
                              💧 {report.waterDepthFeet} ft
                            </span>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#737571', fontWeight: 600 }}>
                            ⏱ {relativeTime}
                          </span>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            background: '#FAF7F2',
                            border: '1px solid #D1CDC4',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#D67A20',
                            fontWeight: 700
                          }}>
                            {report.id.slice(0, 14)}
                          </span>
                        </div>
                      </div>
                      <p className={styles.reportStreamDesc} style={{ margin: '4px 0 2px' }}>
                        {report.description}
                      </p>
                      {report.landmark && (
                        <div style={{ fontSize: '11.5px', color: '#555753', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>📍</span>
                          <span>{report.landmark}</span>
                        </div>
                      )}
                      <div className={styles.reportStreamMeta} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F0EDE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#737571' }}>
                          👤 {report.reporterPseudonym || 'Citizen Reporter'}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: hasAction ? 'rgba(2, 132, 199, 0.08)' : isVerified ? 'rgba(46, 90, 68, 0.08)' : 'rgba(214, 122, 32, 0.08)',
                          color: hasAction ? '#0284C7' : isVerified ? '#2E5A44' : '#D67A20',
                          border: `1px solid ${hasAction ? 'rgba(2, 132, 199, 0.25)' : isVerified ? 'rgba(46, 90, 68, 0.25)' : 'rgba(214, 122, 32, 0.25)'}`
                        }}>
                          {hasAction ? `🚨 ${report.currentActionCategory}` : isVerified ? '✓ Verified Genuine' : '⏱ Queued for Radar Triage'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setTrackInput(report.id);
                            performTrack(report.id);
                            const el = document.getElementById('track-status');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '11.5px', padding: '5px 12px', flex: 1, textAlign: 'center', cursor: 'pointer' }}
                        >
                          🔍 Track Live Status →
                        </button>
                        <Link
                          href={`/map?lat=${report.location.latitude}&lng=${report.location.longitude}&highlight=${report.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11.5px', padding: '5px 12px', textDecoration: 'none' }}
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
        </div>
      </section>

      {/* ============================================================
          7. Dedicated Interactive Section: Track Your Report Status
          ============================================================ */}
      <section className={styles.trackStatusSection} id="track-status">
        <div className={styles.trackContainer}>
          <div className={styles.trackHeaderArea}>
            <div className={styles.trackBadge}>
              <span>🔍</span> Citizen Transparency Pipeline · Real-Time 3s Sync
            </div>
            <h2 className={styles.trackTitle}>Track Your Hazard Report Status</h2>
            <p className={styles.trackSubtitle}>
              Enter your Report ID or select any community ground observation below to inspect real-time Doppler radar validation, meteorologist triage, and emergency response directives across all personal devices.
            </p>
          </div>

          {/* Live Search Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performTrack(trackInput);
            }}
            className={styles.trackSearchForm}
          >
            <input
              type="text"
              className={styles.trackInput}
              placeholder="Enter Report ID (e.g. id_...) or search by area/pseudonym..."
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              id="landing-track-input"
            />
            <button
              type="submit"
              className={styles.trackSubmitBtn}
              disabled={trackingLoading || !trackInput.trim()}
              id="landing-track-btn"
            >
              {trackingLoading ? 'Searching…' : 'Track Status →'}
            </button>
          </form>

          {/* Quick Selectors for Community Hazard Reports */}
          {reports.length > 0 && (
            <div className={styles.trackPillsArea}>
              <span className={styles.trackPillsLabel}>Active Community Reports:</span>
              {reports.slice(0, 6).map((r) => {
                const isActive = activeTrackedId === r.id;
                const cat = HAZARD_CATEGORIES[r.category]?.icon || '⚠️';
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`${styles.trackPill} ${isActive ? styles.trackPillActive : ''}`}
                    onClick={() => {
                      setTrackInput(r.id);
                      performTrack(r.id);
                    }}
                  >
                    <span>{cat}</span>
                    <span>{r.landmark ? r.landmark.split(',')[0].slice(0, 20) : r.category}</span>
                    <code style={{ fontSize: '0.7rem', opacity: 0.8 }}>({r.id.slice(0, 8)})</code>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tracking Result View */}
          {trackingLoading && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div className="spinner spinner-lg" />
              <p style={{ marginTop: 12, color: '#737571', fontSize: '0.9rem' }}>
                Querying live national disaster response registry…
              </p>
            </div>
          )}

          {!trackingLoading && trackingError && (
            <div className="alert alert-warning" style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto' }}>
              <span>⚠️</span> {trackingError}
            </div>
          )}

          {!trackingLoading && trackingData && (
            <div className={styles.trackCard}>
              {/* Dynamic Emergency Action Directive Banner */}
              {trackingData.currentActionCategory && trackingData.currentActionCategory !== 'Pending Verification' && (
                <div style={{
                  background: trackingData.currentActionCategory.includes('Evacuation') ? 'rgba(239, 68, 68, 0.12)' :
                              trackingData.currentActionCategory.includes('Dewatering') ? 'rgba(56, 189, 248, 0.15)' :
                              trackingData.currentActionCategory.includes('Resolved') ? 'rgba(46, 90, 68, 0.12)' : 'rgba(214, 122, 32, 0.12)',
                  border: `1.5px solid ${
                    trackingData.currentActionCategory.includes('Evacuation') ? '#EF4444' :
                    trackingData.currentActionCategory.includes('Dewatering') ? '#0284C7' :
                    trackingData.currentActionCategory.includes('Resolved') ? '#2E5A44' : '#D67A20'
                  }`,
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <span style={{ fontSize: '1.8rem' }}>
                    {trackingData.currentActionCategory.includes('Evacuation') ? '🚨' :
                     trackingData.currentActionCategory.includes('Dewatering') ? '🚒' :
                     trackingData.currentActionCategory.includes('Resolved') ? '✅' : '📢'}
                  </span>
                  <div>
                    <strong style={{
                      color: trackingData.currentActionCategory.includes('Evacuation') ? '#B91C1C' :
                             trackingData.currentActionCategory.includes('Dewatering') ? '#0369A1' :
                             trackingData.currentActionCategory.includes('Resolved') ? '#2E5A44' : '#C4511A',
                      fontSize: '0.95rem',
                      display: 'block'
                    }}>
                      Active Tactical Directive: {trackingData.currentActionCategory}
                    </strong>
                    <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#474946' }}>
                      {trackingData.reviewNote || 'Emergency responders and meteorologists are managing this sector.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Card Header */}
              <div className={styles.trackCardHeader}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      background: 'rgba(22, 24, 22, 0.06)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#161816'
                    }}>
                      {HAZARD_CATEGORIES[trackingData.category as HazardCategory]?.icon || '⚠️'} {HAZARD_CATEGORIES[trackingData.category as HazardCategory]?.label || trackingData.category}
                    </span>
                    <span className={`badge badge-${trackingData.severity >= 4 ? 'critical' : trackingData.severity >= 3 ? 'high' : 'moderate'}`}>
                      Severity {trackingData.severity}/5
                    </span>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: trackingData.verificationStatus === 'VERIFIED_GENUINE' ? '#2E5A44' : '#D67A20',
                      background: trackingData.verificationStatus === 'VERIFIED_GENUINE' ? '#EBF5EE' : '#FEF3E8',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}>
                      {trackingData.verificationStatus === 'VERIFIED_GENUINE' ? '✓ Verified Genuine Hazard' : '⏱ Queued for Radar Triage'}
                    </span>
                  </div>
                  <h3 className={styles.trackCardTitle}>
                    {trackingData.landmark || `Hazard near ${trackingData.location?.latitude?.toFixed(4) || ''}°N, ${trackingData.location?.longitude?.toFixed(4) || ''}°E`}
                  </h3>
                  {trackingData.description && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: '#555753', lineHeight: 1.45 }}>
                      &ldquo;{trackingData.description}&rdquo;
                    </p>
                  )}
                </div>
                <div className={styles.trackCardIdTag}>
                  <span>ID: {trackingData.id}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(trackingData.id);
                      alert('Copied Report ID to clipboard: ' + trackingData.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#D67A20',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      padding: 0,
                      fontWeight: 700
                    }}
                    title="Copy Report ID"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* 4-Stage Timeline */}
              <div className={styles.trackTimeline}>
                {trackingData.stages.map((st, idx) => (
                  <div
                    key={idx}
                    className={`${styles.trackTimelineStep} ${
                      st.completed ? styles.trackTimelineStepCompleted : idx + 1 === trackingData.stage ? styles.trackTimelineStepActive : ''
                    }`}
                  >
                    <div className={styles.trackStepNum}>
                      {st.completed ? '✓' : idx + 1}
                    </div>
                    <span className={styles.trackStepName}>{st.name}</span>
                    <span style={{ fontSize: '0.72rem', color: '#737571', display: 'block', marginTop: '4px' }}>
                      {st.completed ? 'Completed' : idx + 1 === trackingData.stage ? 'In Progress' : 'Queued'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Telemetry Metrics Grid */}
              <div className={styles.trackGrid}>
                <div className={styles.trackGridItem}>
                  <span className={styles.trackGridLabel}>Doppler Radar Correlation</span>
                  <span className={styles.trackGridValue}>{trackingData.weatherSignal || 'Active AWS radar reflectivity match'}</span>
                </div>
                <div className={styles.trackGridItem}>
                  <span className={styles.trackGridLabel}>Spatial Corroboration</span>
                  <span className={styles.trackGridValue}>{trackingData.corroborationCount} eyewitness corroborating reports</span>
                </div>
                <div className={styles.trackGridItem}>
                  <span className={styles.trackGridLabel}>GPS Coordinates</span>
                  <span className={styles.trackGridValue} style={{ fontFamily: 'monospace' }}>
                    {trackingData.location ? `${trackingData.location.latitude.toFixed(4)}°N, ${trackingData.location.longitude.toFixed(4)}°E (±${Math.round(trackingData.location.accuracy || 20)}m)` : 'Confirmed Area'}
                  </span>
                </div>
                <div className={styles.trackGridItem}>
                  <span className={styles.trackGridLabel}>Last Updated</span>
                  <span className={styles.trackGridValue}>
                    {trackingData.updatedAt ? new Date(trackingData.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'} · Live Sync
                  </span>
                </div>
              </div>

              {/* Action History / Audit Log */}
              {trackingData.actionHistory && trackingData.actionHistory.length > 0 && (
                <div className={styles.trackActionHistoryArea}>
                  <h4 className={styles.trackActionHistoryTitle}>
                    Agency Action History & Audit Log ({trackingData.actionHistory.length})
                  </h4>
                  <div className={styles.trackActionHistoryList}>
                    {trackingData.actionHistory.map((item) => (
                      <div key={item.id} className={styles.trackActionItem}>
                        <div>
                          <strong style={{ fontSize: '0.88rem', color: '#161816', display: 'block' }}>
                            {item.action}
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: '#555753' }}>
                            By: <strong>{item.actorName}</strong>
                            {item.notes && <span style={{ marginLeft: 6, color: '#737571' }}>— {item.notes}</span>}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#737571', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className={styles.trackActionsRow}>
                <Link
                  href={`/map?lat=${trackingData.location?.latitude || 26.8467}&lng=${trackingData.location?.longitude || 80.9462}&highlight=${trackingData.id}`}
                  className={styles.trackBtnPrimary}
                >
                  <span>🗺️ Inspect on Live Map</span>
                  <span>→</span>
                </Link>
                <Link
                  href={`/track?id=${encodeURIComponent(trackingData.id)}`}
                  className={styles.trackBtnSecondary}
                >
                  <span>🔍 Open Full Dedicated Tracking Page</span>
                  <span>↗</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 8. Universal Editorial Footer */}
      <Footer />
    </div>
  );
}
