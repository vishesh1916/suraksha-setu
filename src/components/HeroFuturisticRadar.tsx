'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { WeatherAtmosphereType } from '@/lib/weatherAtmosphere';
import type { Report } from '@/types';

interface HeroFuturisticRadarProps {
  atmosphere: WeatherAtmosphereType;
  scrollProgress?: number;
  activeHazard?: Report | null;
  activeHazardsCount?: number;
  className?: string;
}

interface SonarPulse {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}

interface TerrainVertex {
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  elevation: number;
}

export function HeroFuturisticRadar({
  atmosphere,
  scrollProgress = 0,
  activeHazard,
  activeHazardsCount = 0,
  className,
}: HeroFuturisticRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sonarPulsesRef = useRef<SonarPulse[]>([]);
  const mouseRef = useRef({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  // Handle click to trigger tactical sonar acoustic ping
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    sonarPulsesRef.current.push({
      x: clickX,
      y: clickY,
      r: 4,
      maxR: 280,
      alpha: 0.95,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Accessibility check: respects reduced motion preferences
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animFrameId: number;
    let isVisible = true;

    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.width = rect.width * dpr;
      height = canvas.height = rect.height * dpr;
    };

    resize();
    window.addEventListener('resize', resize);

    // Mouse Parallax Event Listeners
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseRef.current.targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = 0;
      mouseRef.current.targetY = 0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // ========================================================
    // 3D TOPOGRAPHICAL TERRAIN ELEVATION MESH INITIALIZATION
    // Represents Awadh River Basin & Regional Mountain / Ridge Topography
    // ========================================================
    const terrainCols = 44;
    const terrainRows = 32;
    const colSpacing = 34;
    const rowSpacing = 30;

    // Procedural Elevation Heightmap function for realistic terrain ridges and river basin
    const getTerrainHeight = (col: number, row: number, time: number): number => {
      const u = col / terrainCols;
      const v = row / terrainRows;

      // Primary regional river basin depression (Gomti River Basin corridor)
      const riverCenter = 0.52;
      const riverValley = -45 * Math.exp(-Math.pow((u - riverCenter) * 4.2, 2));

      // Eastern ridge elevation
      const eastRidge = Math.sin(u * Math.PI * 1.8 + 0.6) * 38 * Math.pow(v, 1.2);

      // Western plateau topography
      const westHills = Math.cos(u * Math.PI * 2.2 - 0.4) * 28 * Math.pow(v, 1.1);

      // Micro-topography ripples (dynamic living atmospheric terrain wave)
      const microWaves =
        Math.sin(col * 0.45 + time * 0.4) * 5.5 +
        Math.cos(row * 0.55 + time * 0.3) * 4.0;

      return riverValley + eastRidge + westHills + microWaves;
    };

    // Pre-allocate mesh vertices
    const terrainMesh: TerrainVertex[][] = [];
    for (let r = 0; r < terrainRows; r++) {
      terrainMesh[r] = [];
      for (let c = 0; c < terrainCols; c++) {
        const worldX = (c - terrainCols / 2) * colSpacing;
        const worldZ = (r - terrainRows / 2) * rowSpacing + 280;
        terrainMesh[r][c] = {
          col: c,
          row: r,
          worldX,
          worldY: 0,
          worldZ,
          elevation: 0,
        };
      }
    }

    // Procedural Doppler storm cells (reflectivity dBZ clusters)
    const stormCells = [
      { distFactor: 0.38, angle: 1.2, radius: 48, baseDbz: 46 },
      { distFactor: 0.65, angle: 2.7, radius: 64, baseDbz: 54 },
      { distFactor: 0.82, angle: 4.4, radius: 36, baseDbz: 38 },
      { distFactor: 0.48, angle: 5.6, radius: 42, baseDbz: 32 },
    ];

    let sweepAngle = 0;
    let clockTime = 0;

    // Main Render Animation Loop
    const render = () => {
      if (!isVisible) {
        animFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const cssWidth = width / dpr;
      const cssHeight = height / dpr;

      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Smooth mouse interpolation for 3D camera parallax
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      // Update sweep rotation and procedural time
      const sweepSpeed = prefersReducedMotion ? 0.006 : 0.018;
      sweepAngle = (sweepAngle + sweepSpeed) % (Math.PI * 2);
      clockTime += 0.015;

      // Radar Position: Center-Right on desktop (68% width), Centered on Mobile
      const isMobile = cssWidth < 860;
      const radarCenterX = isMobile ? cssWidth * 0.5 : cssWidth * 0.70;
      const radarCenterY = isMobile ? cssHeight * 0.44 : cssHeight * 0.50;
      const baseRadius = Math.min(cssWidth, cssHeight) * (isMobile ? 0.38 : 0.34);
      const radarRadius = Math.max(160, Math.min(320, baseRadius));

      // Camera Parameters for 3D Topographical Perspective
      const fov = 380;
      const camPitch = 0.48 + mouseY * 0.12;
      const camYaw = mouseX * 0.14;
      const cosPitch = Math.cos(camPitch);
      const sinPitch = Math.sin(camPitch);
      const cosYaw = Math.cos(camYaw);
      const sinYaw = Math.sin(camYaw);

      // ========================================================
      // LAYER 1: 3D TOPOGRAPHICAL TERRAIN ELEVATION MESH AT THE BACK
      // ========================================================
      const projectedTerrain: { x: number; y: number; elevation: number; ill: number }[][] = [];

      for (let r = 0; r < terrainRows; r++) {
        projectedTerrain[r] = [];
        for (let c = 0; c < terrainCols; c++) {
          const v = terrainMesh[r][c];
          const elev = getTerrainHeight(c, r, clockTime);
          v.elevation = elev;

          // 3D Perspective Rotation Matrix
          const wx = v.worldX;
          const wz = v.worldZ;
          const wy = -elev - 35; // negative is up in screen space

          // Yaw rotation (horizontal parallax)
          const rx = wx * cosYaw - wz * sinYaw;
          const rz = wx * sinYaw + wz * cosYaw;

          // Pitch rotation (vertical angle tilt)
          const ry = wy * cosPitch - rz * sinPitch;
          const finalZ = wy * sinPitch + rz * cosPitch + 420;

          const scale = fov / Math.max(finalZ, 20);
          const px = radarCenterX + rx * scale;
          const py = radarCenterY + ry * scale + 60; // offset slightly below radar center

          // Calculate Dynamic Illumination from Radar Sweep Beam
          const dx = px - radarCenterX;
          const dy = py - radarCenterY;
          const angleToRadar = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
          const angleDiff = (sweepAngle - angleToRadar + Math.PI * 2) % (Math.PI * 2);

          // Illumination decays across 55° phosphor trail
          const trailAngle = 0.95;
          let ill = 0;
          if (angleDiff < trailAngle) {
            ill = Math.pow(1 - angleDiff / trailAngle, 1.8);
          }

          projectedTerrain[r][c] = {
            x: px,
            y: py,
            elevation: elev,
            ill,
          };
        }
      }

      // Draw Topographical Elevation Contour Slices (Iso-elevation rows)
      ctx.save();
      for (let r = 0; r < terrainRows; r++) {
        const rowDepthAlpha = Math.min(1, Math.max(0.12, (r / terrainRows) * 0.9));

        ctx.beginPath();
        for (let c = 0; c < terrainCols; c++) {
          const pt = projectedTerrain[r][c];
          if (c === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }

        // Base contour line color based on elevation
        const midElev = projectedTerrain[r][Math.floor(terrainCols / 2)].elevation;
        let baseStrokeColor = 'rgba(56, 189, 248, 0.12)';
        if (midElev > 20) {
          baseStrokeColor = `rgba(245, 158, 11, ${0.16 * rowDepthAlpha})`; // High ridge amber
        } else if (midElev < -15) {
          baseStrokeColor = `rgba(2, 132, 199, ${0.18 * rowDepthAlpha})`; // River valley cyan
        } else {
          baseStrokeColor = `rgba(52, 211, 153, ${0.14 * rowDepthAlpha})`; // Plain emerald
        }

        ctx.strokeStyle = baseStrokeColor;
        ctx.lineWidth = r % 4 === 0 ? 1.4 : 0.8;
        ctx.stroke();

        // High-Phosphor Laser Scanline Overlay on Illuminated Vertices
        for (let c = 0; c < terrainCols - 1; c++) {
          const p1 = projectedTerrain[r][c];
          const p2 = projectedTerrain[r][c + 1];
          const avgIll = (p1.ill + p2.ill) * 0.5;

          if (avgIll > 0.05) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${avgIll * 0.75})`;
            ctx.lineWidth = 1.2 + avgIll * 1.5;
            ctx.stroke();

            // Glowing vertex dot for terrain crests
            if (p1.ill > 0.4 && (c % 2 === 0 || p1.elevation > 15)) {
              ctx.beginPath();
              ctx.arc(p1.x, p1.y, 1.5 + p1.ill * 1.8, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(248, 250, 252, ${p1.ill * 0.9})`;
              ctx.shadowColor = '#38BDF8';
              ctx.shadowBlur = 8 * p1.ill;
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }
        }
      }

      // Draw Longitudinal Grid Lines (Connecting columns from back to front)
      for (let c = 0; c < terrainCols; c += 3) {
        ctx.beginPath();
        for (let r = 0; r < terrainRows; r++) {
          const pt = projectedTerrain[r][c];
          if (r === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      // Topographical Elevation Annotation Callouts
      const labelIndices = [
        { r: 24, c: 8, label: '▲ Gomti Valley Basin (-14m)' },
        { r: 18, c: 32, label: '▲ Awadh Ridge (+186m)' },
        { r: 10, c: 20, label: '◈ Central Plains DEM' },
      ];

      labelIndices.forEach(({ r, c, label }) => {
        if (projectedTerrain[r] && projectedTerrain[r][c]) {
          const pt = projectedTerrain[r][c];
          if (pt.x > 40 && pt.x < cssWidth - 40 && pt.y > 60 && pt.y < cssHeight - 40) {
            ctx.font = '9px monospace';
            ctx.fillStyle = pt.ill > 0.2 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(148, 163, 184, 0.35)';
            ctx.fillText(label, pt.x + 8, pt.y - 4);

            // Small reticle tick
            ctx.strokeStyle = pt.ill > 0.2 ? 'rgba(56, 189, 248, 0.8)' : 'rgba(148, 163, 184, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pt.x - 3, pt.y);
            ctx.lineTo(pt.x + 3, pt.y);
            ctx.moveTo(pt.x, pt.y - 3);
            ctx.lineTo(pt.x, pt.y + 3);
            ctx.stroke();
          }
        }
      });
      ctx.restore();

      // ========================================================
      // LAYER 2: FUTURISTIC DOPPLER RADAR HUD (RINGS, COMPASS & BEAM)
      // ========================================================
      ctx.save();

      // Deep Phosphor Scope Backdrop with Vignette
      const scopeGrad = ctx.createRadialGradient(
        radarCenterX,
        radarCenterY,
        0,
        radarCenterX,
        radarCenterY,
        radarRadius * 1.05
      );
      scopeGrad.addColorStop(0, 'rgba(4, 18, 30, 0.35)');
      scopeGrad.addColorStop(0.65, 'rgba(2, 11, 19, 0.45)');
      scopeGrad.addColorStop(0.95, 'rgba(1, 6, 10, 0.65)');
      scopeGrad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(radarCenterX, radarCenterY, radarRadius * 1.05, 0, Math.PI * 2);
      ctx.fillStyle = scopeGrad;
      ctx.fill();

      // Concentric Range Rings (25km, 50km, 100km, 150km, 200km, 250km)
      const ringScales = [0.2, 0.4, 0.6, 0.8, 1.0];
      const ringDistances = ['50 KM', '100 KM', '150 KM', '200 KM', '250 KM'];

      ringScales.forEach((scale, idx) => {
        const r = radarRadius * scale;
        ctx.beginPath();
        ctx.arc(radarCenterX, radarCenterY, r, 0, Math.PI * 2);

        if (idx === 1 || idx === 3) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.26)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
        } else if (idx === 4) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
          ctx.lineWidth = 0.8;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Distance Monospace Typography
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
        ctx.fillText(ringDistances[idx], radarCenterX + 6, radarCenterY - r + 11);
      });

      // Azimuth Crosshair Axes (N-S, E-W)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 0.9;
      ctx.setLineDash([2, 5]);

      ctx.beginPath();
      ctx.moveTo(radarCenterX - radarRadius, radarCenterY);
      ctx.lineTo(radarCenterX + radarRadius, radarCenterY);
      ctx.moveTo(radarCenterX, radarCenterY - radarRadius);
      ctx.lineTo(radarCenterX + radarRadius, radarCenterY);
      ctx.stroke();

      // Diagonal Azimuth Radials (045°, 135°, 225°, 315°)
      for (let a = 0; a < 4; a++) {
        const rad = Math.PI / 4 + (a * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(radarCenterX, radarCenterY);
        ctx.lineTo(
          radarCenterX + Math.cos(rad) * radarRadius,
          radarCenterY + Math.sin(rad) * radarRadius
        );
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Outer Azimuth Compass Dial Ring (360° Graduation Ticks & Labels)
      const dialRadius = radarRadius + 14;
      ctx.beginPath();
      ctx.arc(radarCenterX, radarCenterY, dialRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 360 Degree Ticks (Every 5° minor, every 15° major, labeled every 30°)
      for (let deg = 0; deg < 360; deg += 5) {
        const rad = (deg - 90) * (Math.PI / 180);
        const isMajor = deg % 15 === 0;
        const isCardinal = deg % 90 === 0;
        const tickLen = isCardinal ? 10 : isMajor ? 6 : 3;

        const x1 = radarCenterX + Math.cos(rad) * dialRadius;
        const y1 = radarCenterY + Math.sin(rad) * dialRadius;
        const x2 = radarCenterX + Math.cos(rad) * (dialRadius + tickLen);
        const y2 = radarCenterY + Math.sin(rad) * (dialRadius + tickLen);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isCardinal
          ? '#F59E0B'
          : isMajor
          ? 'rgba(56, 189, 248, 0.55)'
          : 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = isCardinal ? 1.5 : 0.8;
        ctx.stroke();

        // Compass Cardinal & Degree Labels
        if (deg % 30 === 0) {
          const textRadius = dialRadius + 18;
          const tx = radarCenterX + Math.cos(rad) * textRadius;
          const ty = radarCenterY + Math.sin(rad) * textRadius;

          let label = `${deg.toString().padStart(3, '0')}°`;
          if (deg === 0) label = 'N 000°';
          else if (deg === 90) label = 'E 090°';
          else if (deg === 180) label = 'S 180°';
          else if (deg === 270) label = 'W 270°';

          ctx.font = isCardinal ? 'bold 9px monospace' : '8px monospace';
          ctx.fillStyle = isCardinal ? '#F59E0B' : 'rgba(148, 163, 184, 0.6)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, tx, ty);
        }
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // ========================================================
      // DOPPLER PRECIPITATION REFLECTIVITY ECHOES (dBZ CLUSTERS)
      // ========================================================
      stormCells.forEach((cell, idx) => {
        const cellDist = radarRadius * cell.distFactor;
        const cellAngle = cell.angle + Math.sin(clockTime * 0.2 + idx) * 0.1;
        const cx = radarCenterX + Math.cos(cellAngle) * cellDist;
        const cy = radarCenterY + Math.sin(cellAngle) * cellDist;

        // Check if radar sweep currently illuminates this cell
        const diff = (sweepAngle - cellAngle + Math.PI * 2) % (Math.PI * 2);
        const cellIll = diff < 0.7 ? Math.pow(1 - diff / 0.7, 1.5) : 0;

        const cellGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell.radius);
        if (atmosphere === 'thunderstorm') {
          cellGrad.addColorStop(0, `rgba(239, 68, 68, ${0.45 + cellIll * 0.4})`); // >50 dBZ Severe
          cellGrad.addColorStop(0.4, `rgba(245, 158, 11, ${0.35 + cellIll * 0.35})`);
          cellGrad.addColorStop(0.75, `rgba(16, 185, 129, ${0.2 + cellIll * 0.25})`);
          cellGrad.addColorStop(1, 'transparent');
        } else if (atmosphere === 'rain') {
          cellGrad.addColorStop(0, `rgba(245, 158, 11, ${0.35 + cellIll * 0.35})`);
          cellGrad.addColorStop(0.45, `rgba(16, 185, 129, ${0.28 + cellIll * 0.28})`);
          cellGrad.addColorStop(0.8, `rgba(56, 189, 248, ${0.15 + cellIll * 0.2})`);
          cellGrad.addColorStop(1, 'transparent');
        } else {
          // Ambient stratiform clutter
          cellGrad.addColorStop(0, `rgba(56, 189, 248, ${0.2 + cellIll * 0.3})`);
          cellGrad.addColorStop(0.6, `rgba(56, 189, 248, ${0.08 + cellIll * 0.15})`);
          cellGrad.addColorStop(1, 'transparent');
        }

        ctx.beginPath();
        ctx.arc(cx, cy, cell.radius, 0, Math.PI * 2);
        ctx.fillStyle = cellGrad;
        ctx.fill();

        // Tactical centroid box when illuminated
        if (cellIll > 0.25) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - 6, cy - 6, 12, 12);

          ctx.font = '8px monospace';
          ctx.fillStyle = '#38BDF8';
          ctx.fillText(`C-${idx + 1} · ${cell.baseDbz} dBZ`, cx + 9, cy + 3);
        }
      });

      // ========================================================
      // 360° ROTATING DUAL-POLARIZATION RADAR SWEEP BEAM
      // ========================================================
      const trailAngle = 0.65; // ~37° trailing phosphor decay
      const sweepGrad = ctx.createRadialGradient(
        radarCenterX,
        radarCenterY,
        0,
        radarCenterX,
        radarCenterY,
        radarRadius
      );
      sweepGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      sweepGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.12)');
      sweepGrad.addColorStop(0.85, 'rgba(16, 185, 129, 0.05)');
      sweepGrad.addColorStop(1, 'transparent');

      // Phosphor trail wedge
      ctx.beginPath();
      ctx.moveTo(radarCenterX, radarCenterY);
      ctx.arc(radarCenterX, radarCenterY, radarRadius, sweepAngle - trailAngle, sweepAngle, false);
      ctx.closePath();
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // Razor-sharp leading edge laser beam
      const beamEndX = radarCenterX + Math.cos(sweepAngle) * (radarRadius + 12);
      const beamEndY = radarCenterY + Math.sin(sweepAngle) * (radarRadius + 12);

      ctx.beginPath();
      ctx.moveTo(radarCenterX, radarCenterY);
      ctx.lineTo(beamEndX, beamEndY);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Antenna Central Hub
      ctx.beginPath();
      ctx.arc(radarCenterX, radarCenterY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#34D399';
      ctx.shadowColor = '#34D399';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(radarCenterX, radarCenterY, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // ========================================================
      // ACTIVE GROUND HAZARD LOCK RETICLE (If report is active)
      // ========================================================
      if (activeHazard) {
        const hazardAngle = 2.15;
        const hazardDist = radarRadius * 0.52;
        const hx = radarCenterX + Math.cos(hazardAngle) * hazardDist;
        const hy = radarCenterY + Math.sin(hazardAngle) * hazardDist;

        // Pulsating reticle target
        const pulse = (Math.sin(clockTime * 4) + 1) * 0.5;
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.4;

        // Bracket corners
        const bSize = 8 + pulse * 3;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(hx - bSize, hy - bSize / 2);
        ctx.lineTo(hx - bSize, hy - bSize);
        ctx.lineTo(hx - bSize / 2, hy - bSize);
        // Top-right
        ctx.moveTo(hx + bSize / 2, hy - bSize);
        ctx.lineTo(hx + bSize, hy - bSize);
        ctx.lineTo(hx + bSize, hy - bSize / 2);
        // Bottom-left
        ctx.moveTo(hx - bSize, hy + bSize / 2);
        ctx.lineTo(hx - bSize, hy + bSize);
        ctx.lineTo(hx - bSize / 2, hy + bSize);
        // Bottom-right
        ctx.moveTo(hx + bSize / 2, hy + bSize);
        ctx.lineTo(hx + bSize, hy + bSize);
        ctx.lineTo(hx + bSize, hy + bSize / 2);
        ctx.stroke();

        ctx.font = 'bold 8.5px monospace';
        ctx.fillStyle = '#EF4444';
        ctx.fillText(`TARGET LOCK: ${activeHazard.category}`, hx + bSize + 4, hy - 2);
        ctx.font = '8px monospace';
        ctx.fillStyle = '#FCA5A5';
        ctx.fillText(`LVL ${activeHazard.severity} · ${(activeHazard.landmark || 'Sector').split(',')[0]}`, hx + bSize + 4, hy + 9);
      }

      // ========================================================
      // TACTICAL SONAR ACOUSTIC EXPANSION PINGS
      // Triggered by user clicks anywhere on the radar canvas
      // ========================================================
      for (let i = sonarPulsesRef.current.length - 1; i >= 0; i--) {
        const pulse = sonarPulsesRef.current[i];
        pulse.r += 3.2;
        pulse.alpha *= 0.95;

        if (pulse.alpha < 0.02 || pulse.r > pulse.maxR) {
          sonarPulsesRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, pulse.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${pulse.alpha * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ========================================================
      // TACTICAL HUD TELEMETRY FRAMING OVERLAYS
      // Corner Brackets and Authentically Engineered Meteorological Metadata
      // ========================================================
      const hudBoxPadding = radarRadius + 38;
      const xLeft = radarCenterX - hudBoxPadding;
      const xRight = radarCenterX + hudBoxPadding;
      const yTop = radarCenterY - hudBoxPadding;
      const yBottom = radarCenterY + hudBoxPadding;

      // Draw corner brackets
      const bracketLen = 16;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.2;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(xLeft, yTop + bracketLen);
      ctx.lineTo(xLeft, yTop);
      ctx.lineTo(xLeft + bracketLen, yTop);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(xRight - bracketLen, yTop);
      ctx.lineTo(xRight, yTop);
      ctx.lineTo(xRight, yTop + bracketLen);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(xLeft, yBottom - bracketLen);
      ctx.lineTo(xLeft, yBottom);
      ctx.lineTo(xLeft + bracketLen, yBottom);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(xRight - bracketLen, yBottom);
      ctx.lineTo(xRight, yBottom);
      ctx.lineTo(xRight, yBottom - bracketLen);
      ctx.stroke();

      // Technical Telemetry Typography
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.fillText('STATION: DWR-LUCKNOW S-BAND // 2.85 GHz', xLeft + 6, yTop - 6);

      ctx.textAlign = 'right';
      ctx.fillText('PPI 360° CONT // EL: 0.5° // RNG: 250KM', xRight - 6, yTop - 6);

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
      ctx.fillText('3D TERRAIN: AWADH BASIN DIGITAL ELEVATION MODEL', xLeft + 6, yBottom + 14);

      // Dynamic Azimuth Counter
      const currentAzDeg = ((sweepAngle * (180 / Math.PI)) % 360).toFixed(1);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#34D399';
      ctx.fillText(`AZ: ${currentAzDeg.padStart(5, '0')}° · DUAL-POL POLARIMETRIC`, xRight - 6, yBottom + 14);
      ctx.textAlign = 'left';

      ctx.restore();

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [atmosphere, scrollProgress, activeHazard]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onClick={handleCanvasClick}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'auto',
        cursor: 'crosshair',
      }}
      title="Tactical Dual-Polarization Doppler Radar & 3D Topographical Terrain Elevation Model. Click anywhere to emit a sonar pulse."
      aria-label="Interactive 3D Doppler weather radar with topographical terrain elevation model"
    />
  );
}
