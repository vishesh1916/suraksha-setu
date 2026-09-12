'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import type { WeatherAtmosphereType } from '@/lib/weatherAtmosphere';
import { ATMOSPHERE_CONFIGS, LUCKNOW_COORDINATES } from '@/lib/weatherAtmosphere';
import type { Report } from '@/types';
import { HAZARD_CATEGORIES } from '@/types';
import styles from './weatherRadarHologram.module.css';

type RadarDisplayMode = 'reflectivity' | 'velocity' | 'triage';

interface WeatherRadarHologramProps {
  atmosphere: WeatherAtmosphereType;
  liveWeather?: {
    temperature?: number;
    weatherCondition?: string;
    precipitation?: number;
    windSpeed?: number;
    relativeHumidity?: number;
    cloudCover?: number;
    weatherCode?: number;
    updatedAt?: string;
  } | null;
  activeHazard?: Report | null;
  activeHazardsCount?: number;
  onCycleHazard?: () => void;
  className?: string;
}

export function WeatherRadarHologram({
  atmosphere,
  liveWeather,
  activeHazard,
  activeHazardsCount = 0,
  onCycleHazard,
  className,
}: WeatherRadarHologramProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Radar Interactive Modes
  const [radarMode, setRadarMode] = useState<RadarDisplayMode>('reflectivity');

  // Parallax Tilt State
  const [cardTransform, setCardTransform] = useState('perspective(1200px) rotateX(0deg) rotateY(0deg)');
  const [glareStyle, setGlareStyle] = useState({ opacity: 0, background: '' });

  // Sonar Acoustic Waves triggered by user clicks
  interface SonarWave {
    x: number;
    y: number;
    r: number;
    maxR: number;
    alpha: number;
  }
  const sonarWavesRef = useRef<SonarWave[]>([]);

  // 3D Parallax Tilt Handler
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

    setCardTransform(`perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(6px)`);

    const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI) + 90;
    setGlareStyle({
      opacity: 0.16,
      background: `linear-gradient(${angle}deg, rgba(255, 255, 255, 0.45) 0%, transparent 60%)`,
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    setCardTransform('perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
    setGlareStyle({ opacity: 0, background: '' });
  }, []);

  // Acoustic Sonar Ping on Scope Click
  const handleScopeClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    sonarWavesRef.current.push({
      x,
      y,
      r: 4,
      maxR: 160,
      alpha: 0.9,
    });
  }, []);

  // Doppler Radar Simulation Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isVisible = true;
    let sweepAngle = 0;
    let pulsePhase = 0;

    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Weather condition parameters
    const precip = liveWeather?.precipitation ?? (atmosphere === 'thunderstorm' ? 35 : atmosphere === 'rain' ? 14 : 0);
    const windKmh = liveWeather?.windSpeed ?? 14;
    const humidity = liveWeather?.relativeHumidity ?? 68;

    // Fixed procedural storm cells centered around Lucknow
    const stormCells = [
      { dist: 42, angle: 1.1, size: 28, dbz: atmosphere === 'thunderstorm' ? 52 : 36 },
      { dist: 70, angle: 2.8, size: 34, dbz: atmosphere === 'thunderstorm' ? 48 : 28 },
      { dist: 85, angle: 4.3, size: 22, dbz: atmosphere === 'thunderstorm' ? 44 : 22 },
    ];

    const render = () => {
      if (!isVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxRadarR = Math.min(cx, cy) - 12;

      ctx.clearRect(0, 0, w, h);

      // Deep Scope Phosphor Gradient
      const scopeBg = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadarR);
      scopeBg.addColorStop(0, '#04121e');
      scopeBg.addColorStop(0.7, '#020b13');
      scopeBg.addColorStop(1, '#01060a');
      ctx.fillStyle = scopeBg;
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadarR, 0, Math.PI * 2);
      ctx.fill();

      // ========================================================
      // 1. RADAR GRID, AXES & RANGE RINGS (25, 50, 75, 100 km)
      // ========================================================
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadarR, 0, Math.PI * 2);
      ctx.clip();

      // Crosshairs
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - maxRadarR, cy);
      ctx.lineTo(cx + maxRadarR, cy);
      ctx.moveTo(cx, cy - maxRadarR);
      ctx.lineTo(cx, cy + maxRadarR);
      ctx.stroke();

      // Diagonal azimuth radials (45°, 135°, 225°, 315°)
      for (let a = 0; a < 4; a++) {
        const rad = (Math.PI / 4) + (a * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(rad) * maxRadarR, cy + Math.sin(rad) * maxRadarR);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Concentric Range Rings
      const ringSteps = [0.25, 0.5, 0.75, 1.0];
      ringSteps.forEach((step, idx) => {
        const r = maxRadarR * step;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = idx === 1 ? 'rgba(56, 189, 248, 0.28)' : 'rgba(56, 189, 248, 0.13)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Distance Typography
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.fillText(`${(idx + 1) * 25}km`, cx + 3, cy - r + 9);
      });

      // ========================================================
      // 2. ACTIVE RADAR DISPLAY MODE
      // ========================================================
      sweepAngle = (sweepAngle + 0.026) % (Math.PI * 2);
      pulsePhase = (pulsePhase + 0.05) % (Math.PI * 2);

      if (radarMode === 'reflectivity') {
        // ——— REFLECTIVITY (dBZ): Dual-pol precipitation returns ———
        stormCells.forEach((cell, i) => {
          const driftAngle = cell.angle + Math.sin(sweepAngle * 0.3 + i) * 0.12;
          const ex = cx + Math.cos(driftAngle) * (cell.dist * (maxRadarR / 100));
          const ey = cy + Math.sin(driftAngle) * (cell.dist * (maxRadarR / 100));

          // Multi-tiered dBZ reflectivity contour
          const cellGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, cell.size);
          if (atmosphere === 'thunderstorm') {
            cellGrad.addColorStop(0, 'rgba(239, 68, 68, 0.75)'); // >50 dBZ (Crimson Severe)
            cellGrad.addColorStop(0.35, 'rgba(245, 158, 11, 0.65)'); // 40-50 dBZ (Amber Heavy)
            cellGrad.addColorStop(0.7, 'rgba(16, 185, 129, 0.35)'); // 25-40 dBZ (Green Moderate)
            cellGrad.addColorStop(1, 'transparent');
          } else if (atmosphere === 'rain') {
            cellGrad.addColorStop(0, 'rgba(245, 158, 11, 0.5)'); // 35-45 dBZ
            cellGrad.addColorStop(0.45, 'rgba(16, 185, 129, 0.4)'); // 25-35 dBZ
            cellGrad.addColorStop(0.85, 'rgba(56, 189, 248, 0.18)'); // 15-25 dBZ
            cellGrad.addColorStop(1, 'transparent');
          } else if (atmosphere === 'fog') {
            cellGrad.addColorStop(0, 'rgba(165, 180, 252, 0.35)'); // Stratiform Mist
            cellGrad.addColorStop(0.7, 'rgba(148, 163, 184, 0.12)');
            cellGrad.addColorStop(1, 'transparent');
          } else {
            // Clear or Cloudy: Ambient clear-air / cloud attenuation
            cellGrad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
            cellGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.05)');
            cellGrad.addColorStop(1, 'transparent');
          }

          ctx.beginPath();
          ctx.arc(ex, ey, cell.size, 0, Math.PI * 2);
          ctx.fillStyle = cellGrad;
          ctx.fill();
        });

      } else if (radarMode === 'velocity') {
        // ——— RADIAL VELOCITY (m/s): Doppler Inflow vs Outflow ———
        // Inbound wind = Cool Emerald / Cyan, Outbound wind = Amber / Warm Red
        const isodopAngle = Math.PI * 0.35; // zero-isodop line
        const velGrad = ctx.createLinearGradient(
          cx + Math.cos(isodopAngle) * maxRadarR,
          cy + Math.sin(isodopAngle) * maxRadarR,
          cx - Math.cos(isodopAngle) * maxRadarR,
          cy - Math.sin(isodopAngle) * maxRadarR
        );
        velGrad.addColorStop(0, 'rgba(16, 185, 129, 0.28)'); // Inflow (-18 m/s)
        velGrad.addColorStop(0.48, 'rgba(148, 163, 184, 0.04)'); // Zero-isodop boundary
        velGrad.addColorStop(0.52, 'rgba(148, 163, 184, 0.04)');
        velGrad.addColorStop(1, 'rgba(239, 68, 68, 0.28)'); // Outflow (+18 m/s)

        ctx.beginPath();
        ctx.arc(cx, cy, maxRadarR - 2, 0, Math.PI * 2);
        ctx.fillStyle = velGrad;
        ctx.fill();

        // Zero-Isodop line
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(isodopAngle + Math.PI / 2) * maxRadarR, cy - Math.sin(isodopAngle + Math.PI / 2) * maxRadarR);
        ctx.lineTo(cx + Math.cos(isodopAngle + Math.PI / 2) * maxRadarR, cy + Math.sin(isodopAngle + Math.PI / 2) * maxRadarR);
        ctx.stroke();
        ctx.setLineDash([]);

      } else if (radarMode === 'triage') {
        // ——— STORM TRIAGE: Automated Convective Cell Tracking Centroids & Motion Vectors ———
        stormCells.forEach((cell, idx) => {
          const ex = cx + Math.cos(cell.angle) * (cell.dist * (maxRadarR / 100));
          const ey = cy + Math.sin(cell.angle) * (cell.dist * (maxRadarR / 100));

          // Motion projection vector arrow
          const heading = cell.angle + 0.8;
          const vecLen = 38;
          const targetX = ex + Math.cos(heading) * vecLen;
          const targetY = ey + Math.sin(heading) * vecLen;

          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();

          // Centroid Box
          ctx.strokeStyle = '#38BDF8';
          ctx.strokeRect(ex - 7, ey - 7, 14, 14);

          // Centroid Label
          ctx.font = '8px monospace';
          ctx.fillStyle = '#38BDF8';
          ctx.fillText(`C-${idx + 1} (${cell.dbz} dBZ)`, ex + 9, ey + 3);
        });
      }

      // ========================================================
      // 3. 360° ROTATING PHOSPHOR SWEEP BEAM & TRAIL
      // ========================================================
      const trailAngle = 0.72; // Phosphor persistence arc width
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadarR);
      sweepGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      sweepGrad.addColorStop(0.65, 'rgba(56, 189, 248, 0.12)');
      sweepGrad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadarR, sweepAngle - trailAngle, sweepAngle, false);
      ctx.closePath();
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // Sharp Leading Radar Beam Line
      const bx = cx + Math.cos(sweepAngle) * maxRadarR;
      const by = cy + Math.sin(sweepAngle) * maxRadarR;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // ========================================================
      // 4. ACTIVE HAZARD TARGET LOCK RETICLE (If report selected)
      // ========================================================
      if (activeHazard) {
        // Convert Lat/Lng delta to polar coordinate
        const latDelta = (activeHazard.location.latitude - LUCKNOW_COORDINATES.lat) * 111; // ~km
        const lngDelta = (activeHazard.location.longitude - LUCKNOW_COORDINATES.lng) * 98; // ~km
        const distKm = Math.min(95, Math.hypot(latDelta, lngDelta));
        const hazardBearing = Math.atan2(lngDelta, latDelta); // 0 = North

        const hx = cx + Math.sin(hazardBearing) * (distKm * (maxRadarR / 100));
        const hy = cy - Math.cos(hazardBearing) * (distKm * (maxRadarR / 100));

        const isCritical = activeHazard.severity >= 4;
        const targetColor = isCritical ? '#EF4444' : '#F59E0B';

        // Expanding Sonar Ping Rings
        [0, 1].forEach((idx) => {
          const ringProg = (pulsePhase / (Math.PI * 2) + idx / 2) % 1;
          const ringR = 8 + ringProg * 38;
          ctx.beginPath();
          ctx.arc(hx, hy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = isCritical
            ? `rgba(239, 68, 68, ${(1 - ringProg) * 0.6})`
            : `rgba(245, 158, 11, ${(1 - ringProg) * 0.6})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });

        // Corner Brackets
        const b = 8;
        const s = 14;
        ctx.strokeStyle = targetColor;
        ctx.lineWidth = 1.5;
        // TL
        ctx.beginPath();
        ctx.moveTo(hx - s, hy - s + b);
        ctx.lineTo(hx - s, hy - s);
        ctx.lineTo(hx - s + b, hy - s);
        ctx.stroke();
        // TR
        ctx.beginPath();
        ctx.moveTo(hx + s - b, hy - s);
        ctx.lineTo(hx + s, hy - s);
        ctx.lineTo(hx + s, hy - s + b);
        ctx.stroke();
        // BL
        ctx.beginPath();
        ctx.moveTo(hx - s, hy + s - b);
        ctx.lineTo(hx - s, hy + s);
        ctx.lineTo(hx - s + b, hy + s);
        ctx.stroke();
        // BR
        ctx.beginPath();
        ctx.moveTo(hx + s - b, hy + s);
        ctx.lineTo(hx + s, hy + s);
        ctx.lineTo(hx + s, hy + s - b);
        ctx.stroke();

        // Target Glyph
        ctx.font = '10px monospace';
        ctx.fillStyle = targetColor;
        ctx.fillText(`LVL ${activeHazard.severity}`, hx + s + 3, hy + 3);
      }

      // ========================================================
      // 5. USER ACOUSTIC SONAR SHOCKWAVES
      // ========================================================
      for (let i = sonarWavesRef.current.length - 1; i >= 0; i--) {
        const wave = sonarWavesRef.current[i];
        wave.r += 3.2;
        wave.alpha *= 0.94;

        if (wave.alpha < 0.02 || wave.r > wave.maxR) {
          sonarWavesRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${wave.alpha})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      ctx.restore(); // end clip

      // ========================================================
      // 6. SCOPE BORDER RING & CARDINAL BEARING TICKS
      // ========================================================
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadarR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cardinal Labels
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', cx, cy - maxRadarR - 6);
      ctx.fillText('S', cx, cy + maxRadarR + 6);
      ctx.fillText('E', cx + maxRadarR + 6, cy);
      ctx.fillText('W', cx - maxRadarR - 6, cy);

      // Antenna Center Hub
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#38BDF8';
      ctx.fill();

      // Azimuth and RPM telemetry
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.fillText(`AZ: ${Math.round(((sweepAngle * 180) / Math.PI) % 360).toString().padStart(3, '0')}°`, 8, 14);
      ctx.fillText(`EL: 0.5° S-BAND`, 8, h - 8);

      ctx.textAlign = 'right';
      ctx.fillStyle = radarMode === 'reflectivity' ? '#34D399' : '#38BDF8';
      ctx.fillText(radarMode.toUpperCase(), w - 8, 14);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.fillText(`${precip > 0 ? `${precip} mm/h` : '0 mm/h'}`, w - 8, h - 8);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [atmosphere, liveWeather, activeHazard, radarMode]);

  // Derived Telemetry Values
  const baroPressure = (
    1013.25 -
    (atmosphere === 'thunderstorm' ? 10.4 : atmosphere === 'rain' ? 5.2 : atmosphere === 'fog' ? 1.5 : 0)
  ).toFixed(1);

  const peakDbz = atmosphere === 'thunderstorm' ? '54.2' : atmosphere === 'rain' ? '38.6' : '14.2';
  const windDirLabel = '068° ENE';
  const windSpeedKmh = liveWeather?.windSpeed ?? 18;

  return (
    <div
      className={`${styles.radarCardContainer} ${className || ''}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div
        ref={cardRef}
        className={styles.radarCard}
        style={{ transform: cardTransform }}
      >
        {/* Specular glare reflection */}
        <div
          className={styles.cardGlare}
          style={glareStyle}
        />

        {/* Card Header */}
        <div className={styles.cardHeader}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerBadgeRow}>
              <span
                className={`${styles.radarStatusDot} ${activeHazard ? styles.radarStatusDotHazard : ''}`}
              />
              <span
                className={`${styles.radarBadgeText} ${activeHazard ? styles.radarBadgeTextHazard : ''}`}
              >
                {activeHazard ? 'Hazard Target Acquisition' : 'Doppler Radar Network'}
              </span>
            </div>
            <span className={styles.radarSubTitle}>
              {activeHazard ? 'Ground Observation Cross-Verification' : 'Pan-India 45-Station Doppler Grid'}
            </span>
          </div>
          <span className={styles.stationCoordsBadge} title="Lucknow IMD Doppler Station">
            26°51′N · 80°56′E
          </span>
        </div>

        {/* Tactical Radar Scope Viewport */}
        <div
          className={styles.scopeContainer}
          onClick={handleScopeClick}
          title="Click to emit acoustic sonar ping"
        >
          <div className={styles.scopeReticleTL} />
          <div className={styles.scopeReticleTR} />
          <div className={styles.scopeReticleBL} />
          <div className={styles.scopeReticleBR} />

          <canvas
            ref={canvasRef}
            width={380}
            height={230}
            className={styles.radarCanvas}
          />

          <span className={styles.sonarClickHint}>Click scope to ping</span>
        </div>

        {/* Mode Switcher Tabs */}
        <div className={styles.modeSwitcherRow}>
          <button
            type="button"
            className={`${styles.modeBtn} ${radarMode === 'reflectivity' ? styles.modeBtnActive : ''}`}
            onClick={() => setRadarMode('reflectivity')}
          >
            Reflectivity (dBZ)
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${radarMode === 'velocity' ? styles.modeBtnActive : ''}`}
            onClick={() => setRadarMode('velocity')}
          >
            Radial Velocity (m/s)
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${radarMode === 'triage' ? styles.modeBtnActive : ''}`}
            onClick={() => setRadarMode('triage')}
          >
            Storm Triage
          </button>
        </div>

        {/* Micro-Telemetry Grid */}
        <div className={styles.telemetryGrid}>
          <div className={styles.telemetryCell}>
            <div className={styles.telemetryLabel}>
              <span>Barometer</span>
              <span>QNH</span>
            </div>
            <div className={styles.telemetryValueRow}>
              <span className={styles.telemetryValue}>{baroPressure}</span>
              <span className={styles.telemetryUnit}>hPa</span>
            </div>
            <span
              className={
                atmosphere === 'thunderstorm'
                  ? styles.telemetrySubDanger
                  : atmosphere === 'rain'
                  ? styles.telemetrySubAmber
                  : styles.telemetrySub
              }
            >
              {atmosphere === 'thunderstorm'
                ? 'Rapid Fall -1.8 hPa/h'
                : atmosphere === 'rain'
                ? 'Falling -0.6 hPa/h'
                : 'Steady (Anticyclonic)'}
            </span>
          </div>

          <div className={styles.telemetryCell}>
            <div className={styles.telemetryLabel}>
              <span>Peak Echo</span>
              <span>S-Band</span>
            </div>
            <div className={styles.telemetryValueRow}>
              <span className={styles.telemetryValue}>{peakDbz}</span>
              <span className={styles.telemetryUnit}>dBZ</span>
            </div>
            <span
              className={
                parseFloat(peakDbz) >= 45
                  ? styles.telemetrySubDanger
                  : parseFloat(peakDbz) >= 30
                  ? styles.telemetrySubAmber
                  : styles.telemetrySub
              }
            >
              {parseFloat(peakDbz) >= 45
                ? 'Convective Core (Severe)'
                : parseFloat(peakDbz) >= 30
                ? 'Precipitation Band'
                : 'Clear-Air Baseline'}
            </span>
          </div>

          <div className={styles.telemetryCell}>
            <div className={styles.telemetryLabel}>
              <span>Wind Vector</span>
              <span>Vector</span>
            </div>
            <div className={styles.telemetryValueRow}>
              <span className={styles.telemetryValue}>{windSpeedKmh}</span>
              <span className={styles.telemetryUnit}>km/h</span>
            </div>
            <span className={styles.telemetrySub}>Bearing {windDirLabel}</span>
          </div>

          <div className={styles.telemetryCell}>
            <div className={styles.telemetryLabel}>
              <span>H3 Resolution</span>
              <span>Spatial</span>
            </div>
            <div className={styles.telemetryValueRow}>
              <span className={styles.telemetryValue}>Res 8</span>
              <span className={styles.telemetryUnit}>0.7 km²</span>
            </div>
            <span className={styles.telemetrySub}>45 Radar Stations Pinned</span>
          </div>
        </div>

        {/* Hazard Target Lock Card (If ground report is active) */}
        {activeHazard && (
          <div className={styles.hazardTargetCard}>
            <div className={styles.hazardTargetHeader}>
              <div className={styles.hazardTargetTitle}>
                <span>⚠️ Target Locked:</span>
                <span>{HAZARD_CATEGORIES[activeHazard.category]?.label || activeHazard.category}</span>
              </div>
              <span className={styles.hazardTargetSeverity}>
                LEVEL {activeHazard.severity}
              </span>
            </div>
            <p className={styles.hazardTargetBody}>
              {activeHazard.landmark
                ? `${activeHazard.landmark} — ${activeHazard.description}`
                : activeHazard.description}
            </p>
            <div className={styles.hazardTargetFooter}>
              <span>
                {activeHazard.waterDepthFeet
                  ? `${activeHazard.waterDepthFeet} ft Waterlogging Depth`
                  : `${activeHazard.location.latitude.toFixed(3)}°N, ${activeHazard.location.longitude.toFixed(3)}°E`}
              </span>
              <Link
                href={`/map?lat=${activeHazard.location.latitude}&lng=${activeHazard.location.longitude}&highlight=${activeHazard.id}`}
                className={styles.hazardTargetLink}
              >
                <span>Engage on Live Map</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
