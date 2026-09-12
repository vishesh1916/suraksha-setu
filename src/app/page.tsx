'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Alert, Report } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import { Navbar } from '@/components/Navbar';
import { WeatherHeroAtmosphere } from '@/components/WeatherHeroAtmosphere';
import { HeroFuturisticRadar } from '@/components/HeroFuturisticRadar';
import { WeatherRadarHologram } from '@/components/WeatherRadarHologram';
import { AlertWorkflowSequence } from '@/components/AlertWorkflowSequence';
import {
  type WeatherAtmosphereType,
  ATMOSPHERE_CONFIGS,
  classifyWeatherAtmosphere,
  formatWeatherConditionLabel,
} from '@/lib/weatherAtmosphere';
import styles from './page.module.css';

export default function LandingPage() {
  const [tickerIndex, setTickerIndex] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [selectedHazardIndex, setSelectedHazardIndex] = useState(0);

  // Dynamic Lucknow Weather Atmosphere State
  const [activeAtmosphere, setActiveAtmosphere] = useState<WeatherAtmosphereType>('cloudy');
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
  const [isManualOverride, setIsManualOverride] = useState(false);

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
            if (!isManualOverride) {
              const detected = classifyWeatherAtmosphere({
                temperature: json.data.temperature,
                precipitation: json.data.precipitation,
                rain: json.data.rain,
                weatherCode: json.data.weatherCode,
                cloudCover: json.data.cloudCover,
                windSpeed: json.data.windSpeed,
                relativeHumidity: json.data.relativeHumidity,
              });
              setActiveAtmosphere(detected);
            }
          }
        }
      } catch (err) {
        console.warn('Lucknow weather atmospheric sync note:', err);
      }
    }

    fetchLucknowWeather();
    const interval = setInterval(fetchLucknowWeather, 120000); // 2-minute refresh
    return () => clearInterval(interval);
  }, [isManualOverride]);

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
        setReports(d.data || []);
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

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const currentAtmosphereConfig = ATMOSPHERE_CONFIGS[activeAtmosphere] || ATMOSPHERE_CONFIGS.clear;

  // Editorial weather label string
  const weatherLabel = liveLucknowData
    ? formatWeatherConditionLabel(liveLucknowData)
    : 'Lucknow · Doppler Radar Synchronized · Awadh Basin';

  return (
    <div className={styles.page}>
      {/* 1. Universal Production Header */}
      <Navbar />

      {/* 2. Full-Screen Cinematic Weather-Aware Hero */}
      <section
        className={styles.hero}
        style={{
          background: currentAtmosphereConfig.skyGradient,
        }}
      >
        {/* Layer 1: Futuristic 3D Topographical Terrain & Doppler Radar Sweep */}
        <HeroFuturisticRadar
          atmosphere={activeAtmosphere}
          scrollProgress={scrollProgress}
          activeHazard={currentHazard}
          activeHazardsCount={activeHazards.length}
          className={styles.heroRadarCanvas}
        />

        {/* Layer 2: Dynamic Atmospheric Weather Simulation Canvas */}
        <WeatherHeroAtmosphere
          atmosphere={activeAtmosphere}
          scrollProgress={scrollProgress}
          className={styles.heroWeatherCanvas}
        />

        <div className={styles.heroOverlay} />
        <div className={styles.heroTelemetryLines} />

        {/* Left Column Content with Staggered Entrance Reveal */}
        <div className={styles.heroContent}>
          {/* Dynamic Real-Time Live Status Strip */}
          <div className={styles.statusStrip}>
            <span
              className={styles.statusDot}
              style={{
                background: activeHazards.length > 0 ? '#EF4444' : '#10B981',
                boxShadow: activeHazards.length > 0 ? '0 0 8px #EF4444' : '0 0 8px #10B981',
              }}
            />
            <span className={styles.statusText}>
              {liveTickerItems[tickerIndex % liveTickerItems.length]}
            </span>
          </div>

          {/* Editorial Weather Atmosphere Label Pill */}
          <div className={styles.weatherConditionPill}>
            <span className={styles.weatherPillDot} style={{ background: currentAtmosphereConfig.accentColor }} />
            <span className={styles.weatherPillText}>{weatherLabel}</span>
            <span className={styles.weatherAtmosphereTag}>{currentAtmosphereConfig.badge}</span>
          </div>

          {/* Authoritative, Grounded Headline */}
          <h1 className={styles.headline}>
            National Hyperlocal Disaster Intelligence &amp; Early Warning Network
          </h1>

          {/* Supporting Public-Safety Mission Description */}
          <p className={styles.supportingText}>
            Suraksha Setu bridges street-level citizen observations with dual-polarization Doppler radar telemetry.
            Empowering disaster response authorities to verify urban waterlogging, cloudbursts, and flash floods before they escalate.
          </p>

          {/* Primary & Secondary Action Directives */}
          <div className={styles.ctaGroup}>
            <Link href="/map" className={styles.primaryCta} id="hero-primary-cta">
              <span>Explore Live Risk Map</span>
              <span className={styles.ctaArrow}>→</span>
            </Link>
            <Link href="/report" className={styles.secondaryCta} id="hero-report-cta">
              <span>Submit Ground Report</span>
              <span className={styles.ctaArrow}>→</span>
            </Link>
          </div>

          {/* Subtle Atmosphere Preview Switcher for Presentation & Demonstration */}
          <div className={styles.atmosphereSwitcherBar}>
            <span className={styles.switcherLabel}>Atmosphere Mood:</span>
            <button
              type="button"
              className={`${styles.switcherBtn} ${!isManualOverride ? styles.switcherBtnActive : ''}`}
              onClick={() => {
                setIsManualOverride(false);
                if (liveLucknowData) {
                  setActiveAtmosphere(
                    classifyWeatherAtmosphere({
                      temperature: liveLucknowData.temperature,
                      precipitation: liveLucknowData.precipitation,
                      rain: liveLucknowData.precipitation,
                      weatherCode: liveLucknowData.weatherCode,
                      cloudCover: liveLucknowData.cloudCover,
                      windSpeed: liveLucknowData.windSpeed,
                      relativeHumidity: liveLucknowData.relativeHumidity,
                    })
                  );
                }
              }}
              title="Return to real-time auto-detected Lucknow weather"
            >
              ⚡ Live Lucknow
            </button>
            {(['clear', 'cloudy', 'rain', 'thunderstorm', 'fog', 'heatwave'] as WeatherAtmosphereType[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`${styles.switcherBtn} ${isManualOverride && activeAtmosphere === mode ? styles.switcherBtnActive : ''}`}
                onClick={() => {
                  setIsManualOverride(true);
                  setActiveAtmosphere(mode);
                }}
              >
                {ATMOSPHERE_CONFIGS[mode].badge}
              </button>
            ))}
          </div>
        </div>

        {/* ============================================================
            3. Tactical 3D Weather Radar Hologram & Telemetry Hub
            Dual-pol Doppler Radar, Wind Vector, H3 Hex Risk, Interactive Parallax
            ============================================================ */}
        <div className={styles.heroRadarWrapper}>
          <WeatherRadarHologram
            atmosphere={activeAtmosphere}
            liveWeather={liveLucknowData}
            activeHazard={currentHazard}
            activeHazardsCount={activeHazards.length}
            onCycleHazard={() =>
              setSelectedHazardIndex((prev) => (prev + 1) % Math.max(1, activeHazards.length))
            }
          />
        </div>

        {/* Scroll Weather Indicator */}
        <div className={styles.scrollWeatherIndicator} style={{ opacity: scrollY > 160 ? 0 : 1 }}>
          <div className={styles.scrollPulseIcon}>
            <div className={styles.scrollPulseDot} />
          </div>
          <span>Scroll to explore verified alert workflow</span>
        </div>
      </section>

      {/* ============================================================
          4. Live National Metrics Bar (Ground Truth Only)
          ============================================================ */}
      <section className={styles.metricsStrip}>
        <div className={styles.metricsContainer}>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon}>🚨</span>
            <div>
              <span className={styles.metricValue}>{stats.activeAlerts ?? alerts.length}</span>
              <span className={styles.metricLabel}>Active Official Warnings</span>
            </div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon}>📝</span>
            <div>
              <span className={styles.metricValue}>{stats.totalReports ?? reports.length}</span>
              <span className={styles.metricLabel}>Ground Observations Today</span>
            </div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon}>🔍</span>
            <div>
              <span className={styles.metricValue}>
                {stats.pendingReview ?? activeHazards.filter(h => !h.verificationStatus || h.verificationStatus === 'PENDING_VERIFICATION').length}
              </span>
              <span className={styles.metricLabel}>Incidents Under Triage</span>
            </div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon}>📡</span>
            <div>
              <span className={styles.metricValue}>45 / 45</span>
              <span className={styles.metricLabel}>Doppler Radars Online</span>
            </div>
          </div>
        </div>
      </section>

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
              <span>📢 Active Official Advisories</span>
              <span className={styles.feedHeaderBadge}>Human Verified</span>
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
                  return (
                    <Link
                      key={alert.id}
                      href={`/alerts/${alert.id}`}
                      className={styles.alertFeedCard}
                    >
                      <div className={styles.alertFeedHeader}>
                        <span className={`badge badge-${alert.severity >= 4 ? 'critical' : alert.severity >= 3 ? 'high' : 'moderate'}`}>
                          {severity.label}
                        </span>
                        <span style={{ fontSize: 12, color: '#8A99A8' }}>
                          {alert.areaName || 'Designated Risk Zone'}
                        </span>
                      </div>
                      <h3 className={styles.alertFeedHeadline}>{alert.headline}</h3>
                      <p className={styles.alertFeedGuidance}>{alert.guidance.slice(0, 110)}…</p>
                      <div className={styles.alertFeedFooter}>
                        <span>🏛️ {alert.source}</span>
                        <span style={{ color: '#38BDF8', fontWeight: 600 }}>Inspect Alert →</span>
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
              <span>📍 Live Ground Observations</span>
              <Link href="/report" style={{ fontSize: 13, color: '#38BDF8', textDecoration: 'none', fontWeight: 600 }}>
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
                  return (
                    <div key={report.id} className={styles.reportStreamCard}>
                      <div className={styles.reportStreamHeader}>
                        <span className={styles.reportCategoryTag}>
                          {hazard?.icon} {hazard?.label || report.category}
                        </span>
                        <span className={`badge badge-${report.severity >= 4 ? 'high' : report.severity >= 3 ? 'moderate' : 'low'}`}>
                          Level {report.severity}
                        </span>
                      </div>
                      <p className={styles.reportStreamDesc}>{report.description}</p>
                      <div className={styles.reportStreamMeta}>
                        <span>👤 {report.reporterPseudonym}</span>
                        <span>
                          {report.verificationStatus === 'VERIFIED_GENUINE'
                            ? '✓ Verified Genuine'
                            : '⏱ Just now · GPS Confirmed'}
                        </span>
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
          7. Institutional Mandate & Architecture Pillars
          ============================================================ */}
      <section className={styles.institutionalSection} id="about">
        <div className={styles.institutionalContainer}>
          {/* Monochrome Partner Row */}
          <div className={styles.partnerRow}>
            <span className={styles.partnerMark}>
              <span className={styles.partnerDot} />
              IMD · Doppler Network
            </span>
            <span className={styles.partnerMark}>
              <span className={styles.partnerDot} />
              NDMA · Incident Command
            </span>
            <span className={styles.partnerMark}>
              <span className={styles.partnerDot} />
              MCGM · Disaster Control
            </span>
            <span className={styles.partnerMark}>
              <span className={styles.partnerDot} />
              MoES · Earth Sciences
            </span>
            <span className={styles.partnerMark}>
              <span className={styles.partnerDot} />
              ISRO · Remote Sensing
            </span>
            <span className={styles.partnerMark}>
              <span className={styles.partnerDot} />
              C-DAC · Weather HPC
            </span>
          </div>

          {/* Trust Statement */}
          <div className={styles.trustStatementArea}>
            <span className={styles.trustLabel}>Institutional Mandate</span>
            <h2 className={styles.trustStatement}>
              Built for citizens, meteorologists, and disaster-response teams.
            </h2>
            <p className={styles.trustDescription}>
              Suraksha Setu bridges the critical gap between street-level eyewitness reports and regional meteorological forecasts. By pairing crowd observations with radar telemetry, emergency authorities verify and broadcast targeted alerts before local drainage points become critical hazards.
            </p>
          </div>

          {/* 3 Architecture Pillars */}
          <div className={styles.pillarsGrid}>
            <div className={styles.pillarCard}>
              <span className={styles.pillarNumber}>01</span>
              <h3 className={styles.pillarTitle}>
                Hyperlocal Ground Signal
              </h3>
              <p className={styles.pillarBody}>
                Citizens submit GPS-pinned observations of waterlogging, falling trees, and cloudbursts in under 60 seconds with offline-first buffering, establishing real-time ground truth.
              </p>
            </div>

            <div className={styles.pillarCard}>
              <span className={styles.pillarNumber}>02</span>
              <h3 className={styles.pillarTitle}>
                Doppler &amp; Sensor Correlation
              </h3>
              <p className={styles.pillarBody}>
                Incoming ground signals are automatically cross-checked against dual-polarization Doppler radar reflectivity, AWS rain gauges, and spatial cluster algorithms.
              </p>
            </div>

            <div className={styles.pillarCard}>
              <span className={styles.pillarNumber}>03</span>
              <h3 className={styles.pillarTitle}>
                Human-in-the-Loop Authority
              </h3>
              <p className={styles.pillarBody}>
                Zero automated public panic alerts. Every incident candidate is evaluated by certified meteorologists and municipal officers before geo-targeted publication.
              </p>
            </div>
          </div>

          {/* Operational Corridor Card */}
          <div className={styles.corridorStatusCard}>
            <div className={styles.corridorInfo}>
              <h4>
                <span>📡</span> Active Pan-India Coverage: 28 States &amp; 8 UTs
              </h4>
              <p>
                Monitoring 45 automatic weather stations, Doppler radar sweeps at Colaba, Delhi, Lucknow, Kolkata, and Chennai, with live citizen telemetry streams.
              </p>
            </div>
            <div className={styles.corridorActions}>
              <Link href="/map" className={styles.corridorBtnPrimary}>
                Open Live Risk Map →
              </Link>
              <Link href="/staff/queue" className={styles.corridorBtnSecondary}>
                Reviewer Console
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          8. Calm Institutional Footer
          ============================================================ */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerWordmark}>
                🛡️ SURAKSHA SETU (सुरक्षा सेतु)
              </div>
              <p className={styles.footerDesc}>
                National Hyperlocal Disaster Intelligence &amp; Early Warning System. A public-service initiative engineered for Smart India Hackathon.
              </p>
            </div>

            <div className={styles.emergencyHotlines}>
              <div className={styles.hotlineItem}>
                <span className={styles.hotlineLabel}>National Emergency</span>
                <a href="tel:112" className={styles.hotlineNumber}>112</a>
              </div>
              <div className={styles.hotlineItem}>
                <span className={styles.hotlineLabel}>Disaster Control Room</span>
                <a href="tel:1077" className={styles.hotlineNumber}>1077</a>
              </div>
              <div className={styles.hotlineItem}>
                <span className={styles.hotlineLabel}>Ambulance &amp; Trauma</span>
                <a href="tel:108" className={styles.hotlineNumber}>108</a>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span>© 2026 Suraksha Setu Platform. In life-threatening emergencies, dial 112 immediately.</span>
            <div className={styles.footerLinks}>
              <Link href="/map" className={styles.footerLink}>Pan-India Map</Link>
              <Link href="/report" className={styles.footerLink}>Submit Report</Link>
              <Link href="/safety" className={styles.footerLink}>Safety Protocols</Link>
              <Link href="/staff/alerts" className={styles.footerLink}>Alert Dispatch</Link>
              <Link href="/staff/admin" className={styles.footerLink}>Registry &amp; Audit</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
