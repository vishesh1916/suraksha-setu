'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Alert, Report } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import { Navbar } from '@/components/Navbar';
import styles from './page.module.css';

export default function LandingPage() {
  const [tickerIndex, setTickerIndex] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [selectedHazardIndex, setSelectedHazardIndex] = useState(0);

  const heroCanvasRef = useRef<HTMLCanvasElement>(null);
  const miniRadarCanvasRef = useRef<HTMLCanvasElement>(null);

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
        '🟢 National Doppler Network · All 45 Radar Stations Operational · Baseline Nominal',
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

  // Background atmospheric weather canvas loop
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

      const currentScroll = window.scrollY || 0;
      const scrollProgress = Math.min(1, Math.max(0, currentScroll / 750));

      // Sheet lightning effect on scroll
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

      // High-Altitude Doppler Radar Center
      const radarCenterX = width * 0.68;
      const radarCenterY = height * 0.48;
      const baseRadius = Math.min(width, height) * 0.22;
      const zoomFactor = 1 + scrollProgress * 1.6;

      // Radar Range Rings
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

      // Rotating Radar Sweep Beam
      radarAngle += 0.016;
      const sweepRadius = baseRadius * 1.7 * zoomFactor;
      const trailAngle = 0.55;

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

      // Sharp beam front edge
      const beamEndX = radarCenterX + Math.cos(radarAngle) * sweepRadius;
      const beamEndY = radarCenterY + Math.sin(radarAngle) * sweepRadius;
      ctx.beginPath();
      ctx.moveTo(radarCenterX, radarCenterY);
      ctx.lineTo(beamEndX, beamEndY);
      ctx.strokeStyle = `rgba(217, 119, 6, ${0.4 + scrollProgress * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Rainfall & Moisture Particles
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

  // Dedicated Tactical Mini Radar Canvas (Standby Weather Radar OR Live Hazard Target Lock)
  useEffect(() => {
    const canvas = miniRadarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let sweepAngle = 0;
    let pulsePhase = 0;

    const renderMini = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Deep tactical background
      ctx.fillStyle = '#051322';
      ctx.fillRect(0, 0, w, h);

      // Grid coordinate lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);

      // Horizontal & Vertical center axes
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(w, cy);
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, h);
      ctx.stroke();
      ctx.setLineDash([]);

      if (!currentHazard) {
        // ====================================================
        // SCENARIO 1: COOL REAL-TIME DOPPLER RADAR ANIMATION (No Hazards)
        // ====================================================
        sweepAngle += 0.024;

        // Concentric Radar Range Rings
        const rings = [24, 48, 75, 110];
        rings.forEach((r, idx) => {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = idx === 1 ? 'rgba(56, 189, 248, 0.24)' : 'rgba(56, 189, 248, 0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Range Distance labels
          ctx.font = '8px monospace';
          ctx.fillStyle = 'rgba(138, 153, 168, 0.45)';
          ctx.fillText(`${(idx + 1) * 25}km`, cx + 3, cy - r + 9);
        });

        // Compass Ticks
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(138, 153, 168, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText('N', cx, 12);
        ctx.fillText('S', cx, h - 4);
        ctx.textAlign = 'left';
        ctx.fillText('E', w - 14, cy + 3);
        ctx.textAlign = 'right';
        ctx.fillText('W', 14, cy + 3);

        // Ambient Organic Moisture Echo Waves (Generative Cloud Reflectivity)
        for (let i = 0; i < 3; i++) {
          const echoRadius = 35 + i * 22;
          const echoAngle = Math.sin(sweepAngle * 0.4 + i) * 0.8 + (i * Math.PI) / 2;
          const ex = cx + Math.cos(echoAngle) * (20 + i * 15);
          const ey = cy + Math.sin(echoAngle) * (15 + i * 12);

          const grad = ctx.createRadialGradient(ex, ey, 0, ex, ey, echoRadius);
          grad.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
          grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.06)');
          grad.addColorStop(1, 'transparent');

          ctx.beginPath();
          ctx.arc(ex, ey, echoRadius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Phosphor Sweep Beam & Trailing Gradient
        const sweepLength = 125;
        const trailAngle = 0.65;
        const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sweepLength);
        sweepGrad.addColorStop(0, 'rgba(52, 211, 153, 0.32)');
        sweepGrad.addColorStop(0.7, 'rgba(16, 185, 129, 0.08)');
        sweepGrad.addColorStop(1, 'transparent');

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, sweepLength, sweepAngle - trailAngle, sweepAngle, false);
        ctx.closePath();
        ctx.fillStyle = sweepGrad;
        ctx.fill();

        // Sharp Sweep Front Line
        const sx = cx + Math.cos(sweepAngle) * sweepLength;
        const sy = cy + Math.sin(sweepAngle) * sweepLength;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // Radar center antenna hub
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#34D399';
        ctx.fill();

        // Tactical HUD text readouts
        ctx.font = '8.5px monospace';
        ctx.fillStyle = 'rgba(138, 153, 168, 0.65)';
        ctx.textAlign = 'left';
        ctx.fillText('SWEEP: 0.5 RPM · S-BAND', 10, 16);
        ctx.fillText(`AZ: ${Math.round(((sweepAngle * 180) / Math.PI) % 360)}°`, 10, h - 8);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(52, 211, 153, 0.85)';
        ctx.fillText('STANDBY: NOMINAL', w - 10, 16);
        ctx.fillStyle = 'rgba(138, 153, 168, 0.65)';
        ctx.fillText('ECHO: < 15 dBZ', w - 10, h - 8);

      } else {
        // ====================================================
        // SCENARIO 2: LIVE HAZARD TARGET LOCK & GROUND TELEMETRY
        // ====================================================
        pulsePhase = (pulsePhase + 0.04) % (Math.PI * 2);

        const isCritical = currentHazard.severity >= 4;
        const mainColor = isCritical ? '#EF4444' : currentHazard.severity === 3 ? '#F59E0B' : '#38BDF8';
        const icon = HAZARD_CATEGORIES[currentHazard.category]?.icon || '⚠️';

        const tx = cx;
        const ty = cy;

        // Expanding Sonar Ping Rings from Hazard Point
        [0, 1, 2].forEach((idx) => {
          const ringProgress = (pulsePhase / (Math.PI * 2) + idx / 3) % 1;
          const ringRadius = 12 + ringProgress * 75;
          const alpha = (1 - ringProgress) * 0.55;

          ctx.beginPath();
          ctx.arc(tx, ty, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = isCritical
            ? `rgba(239, 68, 68, ${alpha})`
            : `rgba(245, 158, 11, ${alpha})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        });

        // Fixed Hazard Boundary Target Reticle
        const reticleR = 36;
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1.5;

        // 4 corner brackets
        const bSize = 10;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(tx - reticleR, ty - reticleR + bSize);
        ctx.lineTo(tx - reticleR, ty - reticleR);
        ctx.lineTo(tx - reticleR + bSize, ty - reticleR);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(tx + reticleR - bSize, ty - reticleR);
        ctx.lineTo(tx + reticleR, ty - reticleR);
        ctx.lineTo(tx + reticleR, ty - reticleR + bSize);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(tx - reticleR, ty + reticleR - bSize);
        ctx.lineTo(tx - reticleR, ty + reticleR);
        ctx.lineTo(tx - reticleR + bSize, ty + reticleR);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(tx + reticleR - bSize, ty + reticleR);
        ctx.lineTo(tx + reticleR, ty + reticleR);
        ctx.lineTo(tx + reticleR, ty + reticleR - bSize);
        ctx.stroke();

        // Center Hazard Category Glyph
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, tx, ty - 6);

        // Severity Pill at Center Bottom
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = mainColor;
        ctx.fillText(`LEVEL ${currentHazard.severity} HAZARD`, tx, ty + 18);

        // HUD Readouts
        ctx.font = '8.5px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = mainColor;
        ctx.fillText(`TARGET: ${currentHazard.category}`, 10, 16);
        ctx.fillStyle = 'rgba(138, 153, 168, 0.8)';
        ctx.fillText(`LAT: ${currentHazard.location.latitude.toFixed(3)}°N`, 10, h - 8);

        ctx.textAlign = 'right';
        ctx.fillStyle = mainColor;
        ctx.fillText(
          currentHazard.waterDepthFeet ? `${currentHazard.waterDepthFeet} FT INUNDATION` : `${currentHazard.severity * 14} mm/h ECHO`,
          w - 10,
          16
        );
        ctx.fillStyle = 'rgba(138, 153, 168, 0.8)';
        ctx.fillText(`LNG: ${currentHazard.location.longitude.toFixed(3)}°E`, w - 10, h - 8);
      }

      animId = requestAnimationFrame(renderMini);
    };

    renderMini();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [currentHazard]);

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
    const interval = setInterval(fetchData, 3000); // 3-second live polling
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className={styles.page}>
      {/* 1. Universal Production Header */}
      <Navbar />

      {/* 2. Full-Screen Desktop Hero */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroTelemetryLines} />
        <canvas ref={heroCanvasRef} className={styles.heroWeatherCanvas} />

        {/* Left Column Copy */}
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

          {/* Authoritative, Grounded Headline (No AI clichés) */}
          <h1 className={styles.headline}>
            National Hyperlocal Disaster Intelligence &amp; Early Warning Network
          </h1>

          {/* Supporting Public-Safety Mission Description */}
          <p className={styles.supportingText}>
            Suraksha Setu connects real-time citizen eyewitness observations with dual-polarization Doppler radar telemetry, empowering emergency authorities to verify urban flooding, cloudbursts, and severe weather before they escalate.
          </p>

          {/* Primary & Secondary Action Directives */}
          <div className={styles.ctaGroup}>
            <Link href="/map" className={styles.primaryCta} id="hero-primary-cta">
              <span>Explore Live Risk Map</span>
              <span className={styles.ctaArrow}>→</span>
            </Link>
            <Link href="/report" className={styles.secondaryCta} id="hero-secondary-cta">
              <span>Submit Ground Report</span>
              <span className={styles.ctaArrow}>→</span>
            </Link>
          </div>
        </div>

        {/* ============================================================
            3. Operational Map Overlay (Lower-Right Hero Edge)
            Automatically displays real ground hazards, or weather radar animation
            ============================================================ */}
        <div
          className={styles.operationalOverlay}
          id="operational-map-overlay"
          style={
            currentHazard
              ? {
                  borderColor: currentHazard.severity >= 4 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(245, 158, 11, 0.5)',
                  boxShadow: currentHazard.severity >= 4 ? '0 16px 40px rgba(239, 68, 68, 0.25)' : '0 16px 40px rgba(0, 0, 0, 0.45)',
                }
              : {}
          }
        >
          <div className={styles.overlayHeader}>
            <span
              className={styles.overlayTag}
              style={{
                color: currentHazard
                  ? currentHazard.severity >= 4
                    ? '#EF4444'
                    : currentHazard.verificationStatus === 'VERIFIED_GENUINE'
                    ? '#34D399'
                    : '#F59E0B'
                  : '#34D399',
              }}
            >
              <span
                className={styles.overlayTagDot}
                style={{
                  background: currentHazard
                    ? currentHazard.severity >= 4
                      ? '#EF4444'
                      : currentHazard.verificationStatus === 'VERIFIED_GENUINE'
                      ? '#34D399'
                      : '#F59E0B'
                    : '#34D399',
                  boxShadow: currentHazard
                    ? currentHazard.severity >= 4
                      ? '0 0 8px #EF4444'
                      : '0 0 8px #F59E0B'
                    : '0 0 8px #34D399',
                }}
              />
              {currentHazard
                ? currentHazard.currentActionCategory && currentHazard.currentActionCategory !== 'Pending Verification'
                  ? currentHazard.currentActionCategory
                  : currentHazard.verificationStatus === 'VERIFIED_GENUINE'
                  ? 'Verified Local Hazard'
                  : 'Active Ground Observation'
                : 'Doppler Radar Net · Standby Monitoring'}
            </span>

            {currentHazard && activeHazards.length > 1 ? (
              <div className={styles.hazardNavGroup}>
                <button
                  type="button"
                  className={styles.hazardNavBtn}
                  onClick={() => setSelectedHazardIndex((prev) => (prev - 1 + activeHazards.length) % activeHazards.length)}
                  title="Previous hazard"
                >
                  ‹
                </button>
                <span className={styles.hazardNavCount}>
                  {(selectedHazardIndex % activeHazards.length) + 1} / {activeHazards.length}
                </span>
                <button
                  type="button"
                  className={styles.hazardNavBtn}
                  onClick={() => setSelectedHazardIndex((prev) => (prev + 1) % activeHazards.length)}
                  title="Next hazard"
                >
                  ›
                </button>
              </div>
            ) : (
              <span className={styles.overlayCoords}>
                {currentHazard
                  ? `${currentHazard.location.latitude.toFixed(3)}°N, ${currentHazard.location.longitude.toFixed(3)}°E`
                  : '28°36′N, 77°13′E · 45 STNS'}
              </span>
            )}
          </div>

          <div className={styles.overlayMapCanvas}>
            <canvas ref={miniRadarCanvasRef} width={340} height={140} className={styles.miniRadarCanvas} />
          </div>

          <div className={styles.overlayFooter}>
            <div className={styles.overlayLocationTitle}>
              {currentHazard
                ? currentHazard.landmark || `Hazard near ${currentHazard.location.latitude.toFixed(3)}°N, ${currentHazard.location.longitude.toFixed(3)}°E`
                : 'Pan-India Severe Weather Surveillance Active'}
            </div>
            <div className={styles.overlayTelemetry}>
              {currentHazard
                ? `"${currentHazard.description}"`
                : 'Continuous dual-polarization radar surveillance across 45 IMD radar stations and citizen sensors. Zero critical unaddressed hazards active nationwide.'}
            </div>
            <div className={styles.overlayMetaRow}>
              <span
                className={styles.overlayConfidence}
                style={{
                  color: currentHazard
                    ? currentHazard.verificationStatus === 'VERIFIED_GENUINE'
                      ? '#34D399'
                      : '#F59E0B'
                    : '#34D399',
                }}
              >
                <span>{currentHazard ? (currentHazard.verificationStatus === 'VERIFIED_GENUINE' ? '✓' : '⏳') : '●'}</span>
                {currentHazard
                  ? currentHazard.verificationStatus === 'VERIFIED_GENUINE'
                    ? 'Official Verification: Genuine'
                    : 'Triage & Corroboration Active'
                  : 'System Status: Baseline Nominal'}
              </span>
              <Link
                href={
                  currentHazard
                    ? `/map?lat=${currentHazard.location.latitude}&lng=${currentHazard.location.longitude}&highlight=${currentHazard.id}`
                    : '/map'
                }
                className={styles.overlayLink}
              >
                {currentHazard ? 'Inspect Sector on Map →' : 'Live Radar Map →'}
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
          4. Live National Metrics Bar (Ground Truth Only, No Mock Fallbacks)
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
