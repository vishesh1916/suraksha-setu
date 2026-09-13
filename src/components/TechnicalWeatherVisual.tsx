'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './technicalVisual.module.css';

interface Props {
  className?: string;
  activeHazardsCount?: number;
  locationLabel?: string;
}

export function TechnicalWeatherVisual({
  className = '',
  activeHazardsCount = 0,
  locationLabel = 'LUCKNOW RADAR NODE · 26.85°N 80.95°E',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState<'reflectivity' | 'velocity' | 'hexRisk'>('reflectivity');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    // Fixed synthetic raindrops / echoes within radar coverage
    const echoes = Array.from({ length: 42 }, () => {
      const dist = 40 + Math.random() * 220;
      const th = Math.PI + Math.random() * Math.PI; // Semi-circle (bottom half / top hemisphere)
      return {
        r: dist,
        theta: th,
        intensity: Math.random(),
        size: 2 + Math.random() * 4,
      };
    });

    // Hexagon cells for H3 representation
    const hexes = [
      { x: -60, y: -80, size: 28, risk: 'warning' },
      { x: 20, y: -120, size: 32, risk: 'alert' },
      { x: 90, y: -60, size: 26, risk: 'nominal' },
      { x: -130, y: -50, size: 30, risk: 'nominal' },
      { x: -30, y: -160, size: 30, risk: 'warning' },
      { x: 70, y: -180, size: 28, risk: 'nominal' },
    ];

    const drawHex = (cx: number, cy: number, size: number, strokeColor: string, fillColor: string) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const hx = cx + size * Math.cos(a);
        const hy = cy + size * Math.sin(a);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Center origin: bottom center of the semi-circle radar
      const cx = width / 2;
      const cy = height - 40;
      const maxRadius = Math.min(cx - 30, cy - 30);

      // 1. Semi-circular background field
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius, Math.PI, 2 * Math.PI, false);
      ctx.closePath();
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#E5E2D9';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.clip();

      // 2. Subtle coordinate grid lines
      ctx.strokeStyle = '#F0EDE6';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Range concentric rings (50km, 100km, 150km, 200km)
      const ringSteps = [0.25, 0.5, 0.75, 1.0];
      ringSteps.forEach((fraction, idx) => {
        const r = maxRadius * fraction;
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI, false);
        ctx.strokeStyle = idx === 3 ? '#DDD8CD' : '#EAE6DC';
        ctx.lineWidth = idx === 3 ? 1.5 : 1;
        ctx.setLineDash(idx % 2 === 1 ? [4, 4] : []);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ring distance label
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#9B9D98';
        ctx.fillText(`${(idx + 1) * 50}km`, cx + r - 30, cy - 6);
      });

      // 4. Radial azimuth spokes
      const angles = [
        Math.PI,
        Math.PI * 1.1667, // 210°
        Math.PI * 1.3333, // 240°
        Math.PI * 1.5,    // 270° (North)
        Math.PI * 1.6667, // 300°
        Math.PI * 1.8333, // 330°
        Math.PI * 2,      // 360°
      ];
      angles.forEach((a) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + maxRadius * Math.cos(a), cy + maxRadius * Math.sin(a));
        ctx.strokeStyle = '#EAE6DC';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // 5. Isobar / Topographical contour lines
      ctx.strokeStyle = '#E2DDD2';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - maxRadius * 0.8, cy - 30);
      ctx.bezierCurveTo(cx - 120, cy - 140, cx - 20, cy - 90, cx + 110, cy - 160);
      ctx.bezierCurveTo(cx + 170, cy - 200, cx + 200, cy - 100, cx + maxRadius * 0.9, cy - 60);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - maxRadius * 0.7, cy - 70);
      ctx.bezierCurveTo(cx - 80, cy - 180, cx + 10, cy - 140, cx + 140, cy - 210);
      ctx.stroke();

      // 6. Uber H3 Hexagonal risk cells
      hexes.forEach((hex) => {
        const hx = cx + hex.x;
        const hy = cy + hex.y;
        let stroke = '#DDD8CD';
        let fill = 'rgba(239, 236, 230, 0.4)';
        if (hex.risk === 'alert') {
          stroke = '#D67A20';
          fill = 'rgba(214, 122, 32, 0.12)';
        } else if (hex.risk === 'warning') {
          stroke = '#E88A2F';
          fill = 'rgba(232, 138, 47, 0.08)';
        }
        drawHex(hx, hy, hex.size, stroke, fill);
      });

      // 7. Sweeping Radar Beam (semi-circle oscillation)
      angle = (angle + 0.015) % (Math.PI);
      const sweepAngle = Math.PI + angle; // Sweeping across top semi-circle from 180° to 360°

      const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, maxRadius);
      gradient.addColorStop(0, 'rgba(214, 122, 32, 0.25)');
      gradient.addColorStop(0.5, 'rgba(214, 122, 32, 0.08)');
      gradient.addColorStop(1, 'rgba(214, 122, 32, 0)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius, sweepAngle - 0.25, sweepAngle, false);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Sweep leading edge line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + maxRadius * Math.cos(sweepAngle), cy + maxRadius * Math.sin(sweepAngle));
      ctx.strokeStyle = '#D67A20';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // 8. Echoes / Rainfall intensity dots
      echoes.forEach((pt) => {
        const ex = cx + pt.r * Math.cos(pt.theta);
        const ey = cy + pt.r * Math.sin(pt.theta);

        // Calculate angular difference with sweep for illumination effect
        const diff = Math.abs(sweepAngle - pt.theta);
        const illuminated = diff < 0.35;

        ctx.beginPath();
        ctx.arc(ex, ey, pt.size * (illuminated ? 1.4 : 1), 0, Math.PI * 2);
        if (pt.intensity > 0.75) {
          ctx.fillStyle = illuminated ? '#D67A20' : 'rgba(214, 122, 32, 0.65)';
        } else if (pt.intensity > 0.45) {
          ctx.fillStyle = illuminated ? '#2E5A44' : 'rgba(46, 90, 68, 0.55)';
        } else {
          ctx.fillStyle = illuminated ? '#161816' : 'rgba(115, 117, 113, 0.45)';
        }
        ctx.fill();
      });

      // 9. Radar Center Pivot Station
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#161816';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#D67A20';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore(); // end clip

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Top Header Strip with Technical Coordinates & Status */}
      <div className={styles.visualHeader}>
        <div className={styles.stationBadge}>
          <span className={styles.pulseDot} />
          <span className={styles.stationTitle}>RADAR COMPOSITE // DUAL-POL S-BAND</span>
        </div>
        <div className={styles.channelTabs}>
          <button
            type="button"
            className={`${styles.channelBtn} ${activeTab === 'reflectivity' ? styles.channelBtnActive : ''}`}
            onClick={() => setActiveTab('reflectivity')}
          >
            Reflectivity (dBZ)
          </button>
          <button
            type="button"
            className={`${styles.channelBtn} ${activeTab === 'velocity' ? styles.channelBtnActive : ''}`}
            onClick={() => setActiveTab('velocity')}
          >
            Doppler Velocity
          </button>
          <button
            type="button"
            className={`${styles.channelBtn} ${activeTab === 'hexRisk' ? styles.channelBtnActive : ''}`}
            onClick={() => setActiveTab('hexRisk')}
          >
            H3 Ground Risk
          </button>
        </div>
      </div>

      {/* Main Canvas Visual */}
      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          width={640}
          height={400}
          className={styles.radarCanvas}
        />

        {/* Floating Telemetry Data Cards */}
        <div className={styles.telemetryOverlayTopLeft}>
          <div className={styles.telemetryTag}>AZIMUTH SWEEP</div>
          <div className={styles.telemetryVal}>0.5° Elevation</div>
          <div className={styles.telemetrySub}>Dual Polarization · 2.85 GHz</div>
        </div>

        <div className={styles.telemetryOverlayTopRight}>
          <div className={styles.telemetryTag}>GROUND CORRELATION</div>
          <div className={styles.telemetryVal}>
            {activeHazardsCount > 0 ? `${activeHazardsCount} Active Corroborated` : 'Baseline Nominal'}
          </div>
          <div className={styles.telemetrySub}>H3 Hex Spatial Index (Res 8)</div>
        </div>

        {/* Compass Cardinal Points */}
        <div className={styles.compassWest}>W · 270°</div>
        <div className={styles.compassNorth}>N · 360°</div>
        <div className={styles.compassEast}>E · 090°</div>
      </div>

      {/* Bottom Technical Readout Strip */}
      <div className={styles.visualFooter}>
        <div className={styles.readoutLeft}>
          <span className={styles.geoLabel}>{locationLabel}</span>
        </div>
        <div className={styles.readoutRight}>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#D67A20' }} />
            <span>Severe / Warning</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#2E5A44' }} />
            <span>Moderate Echo</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#737571' }} />
            <span>Light Rain</span>
          </div>
        </div>
      </div>
    </div>
  );
}
