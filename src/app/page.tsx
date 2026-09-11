'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Alert, Report } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import { Navbar } from '@/components/Navbar';
import styles from './page.module.css';

const LIVE_WATCH_ITEMS = [
  'Mumbai Central · Heavy rainfall watch · Updated 2 min ago',
  'Delhi NCR · Yamuna underpass squall advisory · Updated 4 min ago',
  'Chennai South · Velachery canal flood watch · Updated 1 min ago',
  'Guwahati Metro · Brahmaputra drainage alert · Updated 3 min ago',
  'Shimla Corridor · Dhalli cloudburst advisory · Updated 5 min ago',
];

export default function LandingPage() {
  const [tickerIndex, setTickerIndex] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const heroCanvasRef = useRef<HTMLCanvasElement>(null);

  // Scroll listener for weather transition
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Canvas weather animation loop
  useEffect(() => {
    const canvas = heroCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Weather particles: rain & moisture droplets
    const particles = Array.from({ length: 95 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: Math.random() * 8 + 4,
      speed: Math.random() * 2.5 + 1.8,
      opacity: Math.random() * 0.35 + 0.15,
      drift: (Math.random() - 0.5) * 0.6,
    }));

    let radarAngle = 0;
    let lightningTimer = 0;
    let lightningIntensity = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Scroll factor: 0 at top, up to 1.0 at 750px scroll
      const currentScroll = window.scrollY || 0;
      const scrollProgress = Math.min(1, Math.max(0, currentScroll / 750));

      // 1. Distant Sheet Lightning (occurs intermittently when scrolled down into storm)
      lightningTimer++;
      if (scrollProgress > 0.15 && lightningTimer > 240 && Math.random() < 0.02) {
        lightningIntensity = 0.22;
        lightningTimer = 0;
      }
      if (lightningIntensity > 0) {
        ctx.fillStyle = `rgba(186, 230, 253, ${lightningIntensity * 0.22})`;
        ctx.fillRect(0, 0, width, height);
        lightningIntensity *= 0.88;
      }

      // 2. High-Altitude Doppler Radar Center
      const radarCenterX = width * 0.68;
      const radarCenterY = height * 0.48;

      // Radar Range Rings (expand outward on scroll to simulate descent into ground reality)
      const baseRadius = Math.min(width, height) * 0.22;
      const zoomFactor = 1 + scrollProgress * 1.6;

      [0.4, 0.75, 1.15, 1.6].forEach((scale, idx) => {
        const r = baseRadius * scale * zoomFactor;
        if (r < Math.max(width, height)) {
          ctx.beginPath();
          ctx.arc(radarCenterX, radarCenterY, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.08 + idx * 0.03 + scrollProgress * 0.06})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Rotating Radar Sweep Beam & Phosphor Trail
      radarAngle += 0.016;
      const sweepRadius = baseRadius * 1.7 * zoomFactor;
      const trailAngle = 0.55;

      // Draw sweeping sector trail
      const sweepGradient = ctx.createRadialGradient(
        radarCenterX,
        radarCenterY,
        0,
        radarCenterX,
        radarCenterY,
        sweepRadius
      );
      sweepGradient.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
      sweepGradient.addColorStop(0.7, 'rgba(14, 165, 233, 0.08)');
      sweepGradient.addColorStop(1, 'transparent');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(radarCenterX, radarCenterY);
      ctx.arc(radarCenterX, radarCenterY, sweepRadius, radarAngle - trailAngle, radarAngle, false);
      ctx.closePath();
      ctx.fillStyle = sweepGradient;
      ctx.fill();

      // Sharp beam front edge line
      const beamEndX = radarCenterX + Math.cos(radarAngle) * sweepRadius;
      const beamEndY = radarCenterY + Math.sin(radarAngle) * sweepRadius;
      ctx.beginPath();
      ctx.moveTo(radarCenterX, radarCenterY);
      ctx.lineTo(beamEndX, beamEndY);
      ctx.strokeStyle = `rgba(217, 119, 6, ${0.4 + scrollProgress * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // 3. Dynamic Doppler Echo Cells (Mumbai, Delhi, Chennai, Bengaluru)
      const echoCells = [
        { offsetX: -60, offsetY: 40, dbz: 48 },
        { offsetX: 80, offsetY: -50, dbz: 42 },
        { offsetX: 30, offsetY: 90, dbz: 36 },
      ];

      echoCells.forEach((cell, i) => {
        const cellX = radarCenterX + cell.offsetX * zoomFactor;
        const cellY = radarCenterY + cell.offsetY * zoomFactor;
        const cellRadius = (16 + Math.sin(radarAngle * 2 + i) * 4) * (1 + scrollProgress * 0.5);

        const echoGrad = ctx.createRadialGradient(cellX, cellY, 0, cellX, cellY, cellRadius);
        if (cell.dbz >= 45) {
          echoGrad.addColorStop(0, `rgba(239, 68, 68, ${0.35 + scrollProgress * 0.3})`);
          echoGrad.addColorStop(0.7, `rgba(217, 119, 6, ${0.18 + scrollProgress * 0.2})`);
        } else {
          echoGrad.addColorStop(0, `rgba(16, 185, 129, ${0.3 + scrollProgress * 0.25})`);
          echoGrad.addColorStop(0.7, `rgba(56, 189, 248, ${0.12 + scrollProgress * 0.15})`);
        }
        echoGrad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(cellX, cellY, cellRadius, 0, Math.PI * 2);
        ctx.fillStyle = echoGrad;
        ctx.fill();
      });

      // 4. Rainfall & Moisture Particles (accelerates into vertical streaks on scroll down!)
      const speedMultiplier = 1 + scrollProgress * 3.8;
      const streakLengthMultiplier = 1 + scrollProgress * 2.6;

      particles.forEach((p) => {
        p.y += p.speed * speedMultiplier;
        p.x += p.drift;

        if (p.y > height) {
          p.y = -20;
          p.x = Math.random() * width;
        }
        if (p.x > width) p.x = 0;
        if (p.x < 0) p.x = width;

        const pLen = p.length * streakLengthMultiplier;
        const pAlpha = Math.min(0.85, p.opacity + scrollProgress * 0.35);

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.drift * 2, p.y + pLen);
        ctx.strokeStyle = `rgba(186, 230, 253, ${pAlpha})`;
        ctx.lineWidth = 1 + scrollProgress * 0.5;
        ctx.stroke();
      });

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Rotate live status strip
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % LIVE_WATCH_ITEMS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Fetch live alerts & stats from store
  const fetchData = useCallback(async () => {
    try {
      const [alertsRes, reportsRes, statsRes] = await Promise.all([
        fetch('/api/alerts?status=active'),
        fetch('/api/reports?limit=6'),
        fetch('/api/stats'),
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className={styles.page}>
      {/* ============================================================
          1. Editorial Top Navigation (Universal Production Header)
          ============================================================ */}
      <Navbar />

      {/* ============================================================
          2. Full-Screen 16:9 Desktop Hero
          ============================================================ */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroTelemetryLines} />
        <canvas ref={heroCanvasRef} className={styles.heroWeatherCanvas} />

        {/* Left Column Copy */}
        <div className={styles.heroContent}>
          {/* Rotating Live Status Strip */}
          <div className={styles.statusStrip}>
            <span className={styles.statusDot} />
            <span className={styles.statusText}>
              {LIVE_WATCH_ITEMS[tickerIndex]}
            </span>
          </div>

          {/* Large Editorial Headline */}
          <h1 className={styles.headline}>
            Weather clarity.<br />
            When every minute matters.
          </h1>

          {/* Supporting Text */}
          <p className={styles.supportingText}>
            Verified citizen reports and live weather intelligence for safer local decisions across India.
          </p>

          {/* Primary & Secondary CTAs */}
          <div className={styles.ctaGroup}>
            <Link href="/map" className={styles.primaryCta} id="hero-primary-cta">
              <span>View local risk</span>
              <span className={styles.ctaArrow}>→</span>
            </Link>
            <Link href="/report" className={styles.secondaryCta} id="hero-secondary-cta">
              <span>Report a hazard</span>
              <span className={styles.ctaArrow}>→</span>
            </Link>
          </div>
        </div>

        {/* ============================================================
            3. Operational Map Overlay (Lower-Right Hero Edge)
            ============================================================ */}
        <div className={styles.operationalOverlay} id="operational-map-overlay">
          <div className={styles.overlayHeader}>
            <span className={styles.overlayTag}>
              <span className={styles.overlayTagDot} />
              Verified local alert
            </span>
            <span className={styles.overlayCoords}>
              19°04′N, 72°52′E · H3-R8
            </span>
          </div>

          <div className={styles.overlayMapCanvas}>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 340 140"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="170" cy="70" r="110" stroke="rgba(56, 189, 248, 0.08)" strokeDasharray="3 3" />
              <circle cx="170" cy="70" r="75" stroke="rgba(56, 189, 248, 0.14)" strokeDasharray="4 4" />
              <circle cx="170" cy="70" r="45" stroke="rgba(217, 119, 6, 0.22)" />
              
              <path
                d="M30 15 Q70 45 110 55 T180 85 T260 115 T320 135"
                stroke="rgba(138, 153, 168, 0.22)"
                strokeWidth="1.2"
                fill="none"
              />

              <ellipse cx="175" cy="68" rx="60" ry="36" fill="rgba(56, 189, 248, 0.08)" />
              <ellipse cx="175" cy="68" rx="35" ry="22" fill="rgba(217, 119, 6, 0.16)" />

              {/* Highlighted H3 Hexagonal Cell */}
              <polygon
                points="175,44 198,57 198,83 175,96 152,83 152,57"
                fill="rgba(217, 119, 6, 0.24)"
                stroke="#D97706"
                strokeWidth="1.6"
              />

              <line x1="165" y1="70" x2="185" y2="70" stroke="#F7F6F2" strokeWidth="1" />
              <line x1="175" y1="60" x2="175" y2="80" stroke="#F7F6F2" strokeWidth="1" />
              <circle cx="175" cy="70" r="2.5" fill="#D97706" />

              <text x="14" y="24" fill="rgba(138, 153, 168, 0.6)" fontSize="9" fontFamily="monospace">
                REFLECTIVITY: 42 dBZ
              </text>
              <text x="248" y="24" fill="rgba(138, 153, 168, 0.6)" fontSize="9" fontFamily="monospace">
                RATE: 58 mm/h
              </text>
            </svg>
          </div>

          <div className={styles.overlayFooter}>
            <div className={styles.overlayLocationTitle}>
              Sion–Kurla Rail Underpass Corridor
            </div>
            <div className={styles.overlayTelemetry}>
              4 independent ground reports corroborated with IMD Doppler radar sweep.
            </div>
            <div className={styles.overlayMetaRow}>
              <span className={styles.overlayConfidence}>
                <span>✓</span> Confidence Index: 78%
              </span>
              <Link href="/map" className={styles.overlayLink}>
                Inspect sector →
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll Weather Indicator */}
        <div className={styles.scrollWeatherIndicator} style={{ opacity: scrollY > 160 ? 0 : 1 }}>
          <div className={styles.scrollPulseIcon}>
            <div className={styles.scrollPulseDot} />
          </div>
          <span>Scroll to descend through weather layers</span>
        </div>
      </section>

      {/* Floating Descent Weather Telemetry */}
      {scrollY > 280 && (
        <div className={styles.scrollTelemetryBanner}>
          <span className={styles.scrollTelemetryDot} />
          <span>Ground Descent Active · Live Reflectivity 45 dBZ · Street-Level Corroboration</span>
        </div>
      )}

      {/* ============================================================
          4. Live National Metrics Bar
          ============================================================ */}
      <section className={styles.metricsStrip}>
        <div className={styles.metricsContainer}>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon}>🚨</span>
            <div>
              <span className={styles.metricValue}>{stats.activeAlerts ?? alerts.length ?? 5}</span>
              <span className={styles.metricLabel}>Active National Alerts</span>
            </div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon}>📝</span>
            <div>
              <span className={styles.metricValue}>{stats.totalReports ?? reports.length ?? 12}</span>
              <span className={styles.metricLabel}>Ground Reports Today</span>
            </div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon}>🔍</span>
            <div>
              <span className={styles.metricValue}>{stats.pendingReview ?? 3}</span>
              <span className={styles.metricLabel}>Incidents Under Review</span>
            </div>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon}>📡</span>
            <div>
              <span className={styles.metricValue}>43 / 45</span>
              <span className={styles.metricLabel}>Doppler & AWS Online</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          5. Active National Alerts & Live Citizen Reports Feed
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
                <p style={{ color: '#8A99A8' }}>Loading verified alerts…</p>
              ) : alerts.length === 0 ? (
                <p style={{ color: '#8A99A8' }}>No active critical warnings published at this hour.</p>
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
                        <span>⏱ Just now · GPS Confirmed</span>
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
          6. Below the Hero — Warm Off-White Institutional Section
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
                Doppler & Sensor Correlation
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
                Monitoring 45 automatic weather stations, Doppler radar sweeps at Colaba, Delhi, Kolkata, and Chennai, with live citizen telemetry streams.
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
          7. Calm Institutional Footer
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
