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
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    // Fixed synthetic raindrops / echoes within radar coverage for Reflectivity mode
    const echoes = Array.from({ length: 48 }, () => {
      const dist = 35 + Math.random() * 225;
      const th = Math.PI + Math.random() * Math.PI; // Semi-circle
      return {
        r: dist,
        theta: th,
        intensity: Math.random(),
        size: 2.5 + Math.random() * 4.5,
      };
    });

    // Doppler radial velocity points (inflow vs outflow)
    const velocityVectors = Array.from({ length: 50 }, () => {
      const dist = 40 + Math.random() * 215;
      const th = Math.PI + Math.random() * Math.PI;
      // Radially split: angles closer to PI (west) vs PI*2 (east)
      const isInflow = th < Math.PI * 1.55;
      return {
        r: dist,
        theta: th,
        speed: 14 + Math.random() * 22, // m/s
        isInflow,
        length: 8 + Math.random() * 10,
        flowOffset: Math.random() * Math.PI * 2,
      };
    });

    // Hexagon cells for H3 representation
    const hexes = [
      { x: -70, y: -85, size: 32, risk: 'warning', label: '8860a...', tag: '1.4ft Water' },
      { x: 15, y: -125, size: 36, risk: 'alert', label: '8860b...', tag: '3.8ft Flooded' },
      { x: 95, y: -65, size: 28, risk: 'nominal', label: '8860c...', tag: 'Nominal' },
      { x: -140, y: -55, size: 30, risk: 'nominal', label: '8860d...', tag: 'Nominal' },
      { x: -35, y: -165, size: 34, risk: 'warning', label: '8860e...', tag: 'Clogged Drain' },
      { x: 75, y: -175, size: 30, risk: 'nominal', label: '8860f...', tag: 'Clear' },
      { x: -95, y: -135, size: 30, risk: 'alert', label: '8860g...', tag: 'Road Block' },
    ];

    const drawHex = (
      cx: number,
      cy: number,
      size: number,
      strokeColor: string,
      fillColor: string,
      label?: string,
      tag?: string
    ) => {
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
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (label && tag) {
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, cy - 3);
        ctx.font = 'bold 7.5px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(tag, cx, cy + 8);
        ctx.textAlign = 'left';
      }
    };

    const render = () => {
      const mode = activeTabRef.current;
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
      ctx.fillStyle = mode === 'velocity' ? '#F8FBFC' : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#DCEEF2';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.clip();

      // 2. Subtle coordinate grid lines
      ctx.strokeStyle = 'rgba(76, 141, 162, 0.08)';
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
      ctx.strokeStyle = '#EAE4D8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - maxRadius * 0.8, cy - 30);
      ctx.bezierCurveTo(cx - 120, cy - 140, cx - 20, cy - 90, cx + 110, cy - 160);
      ctx.bezierCurveTo(cx + 170, cy - 200, cx + 200, cy - 100, cx + maxRadius * 0.9, cy - 60);
      ctx.stroke();

      // Sweeping Radar Beam (semi-circle oscillation)
      angle = (angle + 0.016) % Math.PI;
      const sweepAngle = Math.PI + angle;

      const beamGradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, maxRadius);
      const sweepColor = mode === 'velocity' ? 'rgba(46, 90, 68, ' : 'rgba(214, 122, 32, ';
      beamGradient.addColorStop(0, `${sweepColor}0.25)`);
      beamGradient.addColorStop(0.5, `${sweepColor}0.08)`);
      beamGradient.addColorStop(1, `${sweepColor}0)`);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius, sweepAngle - 0.28, sweepAngle, false);
      ctx.closePath();
      ctx.fillStyle = beamGradient;
      ctx.fill();

      // Sweep leading edge line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + maxRadius * Math.cos(sweepAngle), cy + maxRadius * Math.sin(sweepAngle));
      ctx.strokeStyle = mode === 'velocity' ? '#4C8B71' : '#4C8DA2';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // --- CHANNEL SPECIFIC RENDERING ---

      if (mode === 'reflectivity') {
        // High-contrast multi-tier reflectivity dBZ precipitation clusters
        echoes.forEach((pt) => {
          const ex = cx + pt.r * Math.cos(pt.theta);
          const ey = cy + pt.r * Math.sin(pt.theta);
          const diff = Math.abs(sweepAngle - pt.theta);
          const illuminated = diff < 0.35;

          ctx.beginPath();
          ctx.arc(ex, ey, pt.size * (illuminated ? 1.5 : 1.1), 0, Math.PI * 2);

          if (pt.intensity > 0.72) {
            // Severe cloudburst / thunderstorm core (>50 dBZ)
            ctx.fillStyle = illuminated ? '#4C8DA2' : 'rgba(76, 141, 162, 0.75)';
          } else if (pt.intensity > 0.4) {
            // Moderate precipitation echo (35-50 dBZ)
            ctx.fillStyle = illuminated ? '#4C8B71' : 'rgba(76, 139, 113, 0.65)';
          } else {
            // Light rain (<35 dBZ)
            ctx.fillStyle = illuminated ? '#60717B' : 'rgba(96, 113, 123, 0.45)';
          }
          ctx.fill();

          // Outer halo for high-intensity storm cells
          if (pt.intensity > 0.78) {
            ctx.beginPath();
            ctx.arc(ex, ey, pt.size * 2.2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(76, 141, 162, 0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });

        // Subtle faint background hexes to show grid coverage
        hexes.slice(0, 3).forEach((h) => {
          drawHex(cx + h.x, cy + h.y, h.size, 'rgba(200, 227, 234, 0.6)', 'rgba(220, 238, 242, 0.2)');
        });

      } else if (mode === 'velocity') {
        // Dual-Doppler Radial Velocity mode: Inflow (-Vr) vs Outflow (+Vr) & Zero-Isodop
        const zeroIsodopAngle = Math.PI * 1.55; // 279°

        // Draw Zero-Isodop Shear Line (where radial velocity is 0)
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([5, 4]);
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + maxRadius * Math.cos(zeroIsodopAngle),
          cy + maxRadius * Math.sin(zeroIsodopAngle)
        );
        ctx.strokeStyle = '#8FA2AD';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        // Label Zero Isodop
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#60717B';
        ctx.fillText('ZERO-ISODOP (0 m/s)', cx - 15, cy - maxRadius * 0.75);
        ctx.restore();

        // Inflow sector label (-V_r towards radar)
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#4C8B71';
        ctx.fillText('INFLOW (-V_r)', cx - 110, cy - 40);

        // Outflow sector label (+V_r away from radar)
        ctx.fillStyle = '#4C8DA2';
        ctx.fillText('OUTFLOW (+V_r)', cx + 45, cy - 40);

        // Draw velocity vectors with radial flow animation
        velocityVectors.forEach((v) => {
          const flowShift = Math.sin(angle * 3 + v.flowOffset) * 4;
          const currentR = v.r + (v.isInflow ? -flowShift : flowShift);
          const vx = cx + currentR * Math.cos(v.theta);
          const vy = cy + currentR * Math.sin(v.theta);

          const dir = v.isInflow ? -1 : 1; // -1 inward, +1 outward
          const tipX = vx + dir * v.length * Math.cos(v.theta);
          const tipY = vy + dir * v.length * Math.sin(v.theta);

          const col = v.isInflow ? '#4C8B71' : '#4C8DA2';

          ctx.beginPath();
          ctx.moveTo(vx, vy);
          ctx.lineTo(tipX, tipY);
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Arrow head
          ctx.beginPath();
          ctx.arc(tipX, tipY, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();
        });

      } else if (mode === 'hexRisk') {
        // Uber H3 Discrete Global Hexagonal Risk Cells
        // Background radar echo context (faint)
        echoes.forEach((pt) => {
          const ex = cx + pt.r * Math.cos(pt.theta);
          const ey = cy + pt.r * Math.sin(pt.theta);
          ctx.beginPath();
          ctx.arc(ex, ey, 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(143, 162, 173, 0.4)';
          ctx.fill();
        });

        // Prominent H3 cells with glowing borders, risk fills, and report tags
        hexes.forEach((hex) => {
          const hx = cx + hex.x;
          const hy = cy + hex.y;
          let stroke = '#4C8B71';
          let fill = 'rgba(76, 139, 113, 0.12)';

          if (hex.risk === 'alert') {
            stroke = '#D76D63';
            fill = 'rgba(215, 109, 99, 0.2)';
          } else if (hex.risk === 'warning') {
            stroke = '#D7AA63';
            fill = 'rgba(215, 170, 99, 0.2)';
          }

          drawHex(hx, hy, hex.size, stroke, fill, hex.label, hex.tag);
        });
      }

      // 9. Radar Center Pivot Station
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#1F3440';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.strokeStyle = mode === 'velocity' ? '#4C8B71' : '#4C8DA2';
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
            title="Precipitation Echo Power (dBZ)"
          >
            Reflectivity (dBZ)
          </button>
          <button
            type="button"
            className={`${styles.channelBtn} ${activeTab === 'velocity' ? styles.channelBtnActive : ''}`}
            onClick={() => setActiveTab('velocity')}
            title="Doppler Radial Wind Velocity (m/s)"
          >
            Doppler Velocity
          </button>
          <button
            type="button"
            className={`${styles.channelBtn} ${activeTab === 'hexRisk' ? styles.channelBtnActive : ''}`}
            onClick={() => setActiveTab('hexRisk')}
            title="Uber H3 Discrete Hexagonal Spatial Grid"
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

        {/* Dynamic Floating Telemetry Data Cards based on Active Channel */}
        {activeTab === 'reflectivity' && (
          <>
            <div className={styles.telemetryOverlayTopLeft}>
              <div className={styles.telemetryTag}>RADAR REFLECTIVITY (Z)</div>
              <div className={styles.telemetryVal}>54.2 dBZ Core Detected</div>
              <div className={styles.telemetrySub}>Dual-Pol S-Band · 0.5° Elevation</div>
            </div>

            <div className={styles.telemetryOverlayTopRight}>
              <div className={styles.telemetryTag}>SURFACE PRECIP RATE</div>
              <div className={styles.telemetryVal}>62 mm/hr Cloudburst</div>
              <div className={styles.telemetrySub}>Marshall-Palmer Z-R Calibrated</div>
            </div>
          </>
        )}

        {activeTab === 'velocity' && (
          <>
            <div className={styles.telemetryOverlayTopLeft}>
              <div className={styles.telemetryTag}>RADIAL VELOCITY (V_r)</div>
              <div className={styles.telemetryVal}>Inflow -28 · Outflow +34 m/s</div>
              <div className={styles.telemetrySub}>Zero-Isodop Shear Axis: 215° SW</div>
            </div>

            <div className={styles.telemetryOverlayTopRight}>
              <div className={styles.telemetryTag}>DOPPLER WIND SHEAR</div>
              <div className={styles.telemetryVal}>Squall Front / Downdraft</div>
              <div className={styles.telemetrySub}>Low-Level Microburst Detection</div>
            </div>
          </>
        )}

        {activeTab === 'hexRisk' && (
          <>
            <div className={styles.telemetryOverlayTopLeft}>
              <div className={styles.telemetryTag}>H3 SPATIAL INDEX</div>
              <div className={styles.telemetryVal}>Resolution 8 (~400m Cells)</div>
              <div className={styles.telemetrySub}>Uber Discrete Hexagonal Grid</div>
            </div>

            <div className={styles.telemetryOverlayTopRight}>
              <div className={styles.telemetryTag}>GROUND CORRELATION</div>
              <div className={styles.telemetryVal}>
                {activeHazardsCount > 0 ? `${activeHazardsCount} Corroborated Reports` : '3 High-Risk Hex Clusters'}
              </div>
              <div className={styles.telemetrySub}>Citizen Reports + Radar Confluence</div>
            </div>
          </>
        )}

        {/* Compass Cardinal Points */}
        <div className={styles.compassWest}>W · 270°</div>
        <div className={styles.compassNorth}>N · 360°</div>
        <div className={styles.compassEast}>E · 090°</div>
      </div>

      {/* Dynamic Bottom Technical Readout Strip based on Active Channel */}
      <div className={styles.visualFooter}>
        <div className={styles.readoutLeft}>
          <span className={styles.geoLabel}>{locationLabel}</span>
        </div>
        <div className={styles.readoutRight}>
          {activeTab === 'reflectivity' && (
            <>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#4C8DA2' }} />
                <span>Severe (&gt;50 dBZ)</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#4C8B71' }} />
                <span>Moderate (35–50 dBZ)</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#8FA2AD' }} />
                <span>Light (&lt;35 dBZ)</span>
              </div>
            </>
          )}

          {activeTab === 'velocity' && (
            <>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#4C8B71' }} />
                <span>Inflow (-V_r Inbound)</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#4C8DA2' }} />
                <span>Outflow (+V_r Outbound)</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#8FA2AD' }} />
                <span>Zero-Isodop (0 m/s)</span>
              </div>
            </>
          )}

          {activeTab === 'hexRisk' && (
            <>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#D76D63' }} />
                <span>Critical Flooded Hex</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#D7AA63' }} />
                <span>Waterlogging Warning</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#4C8B71' }} />
                <span>Nominal Baseline</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
