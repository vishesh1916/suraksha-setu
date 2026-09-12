'use client';

import { useEffect, useRef } from 'react';
import type { WeatherAtmosphereType, WeatherAtmosphereConfig } from '@/lib/weatherAtmosphere';
import { ATMOSPHERE_CONFIGS } from '@/lib/weatherAtmosphere';

interface WeatherHeroAtmosphereProps {
  atmosphere: WeatherAtmosphereType;
  scrollProgress?: number;
  className?: string;
}

interface WindStreamline {
  x: number;
  y: number;
  trail: { x: number; y: number }[];
  maxTrail: number;
  speed: number;
  seed: number;
  thickness: number;
  alpha: number;
}

interface LightningBolt {
  segments: { x1: number; y1: number; x2: number; y2: number; alpha: number; branch?: boolean }[];
  alpha: number;
}

interface BokehParticle {
  x: number;
  y: number;
  r: number;
  speedY: number;
  speedX: number;
  alpha: number;
  pulsePhase: number;
}

export function WeatherHeroAtmosphere({
  atmosphere,
  scrollProgress = 0,
  className,
}: WeatherHeroAtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config: WeatherAtmosphereConfig = ATMOSPHERE_CONFIGS[atmosphere] || ATMOSPHERE_CONFIGS.clear;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animFrameId: number;
    let isVisible = true;

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Dynamic resolution clamping
    let width = 0;
    let height = 0;
    const isMobile = window.innerWidth < 768;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas.width = rect.width * dpr;
      height = canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Mouse Tracking for Interactive Fluid Vortex Deflection
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      active: false,
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.active = true;
    };

    const handlePointerLeave = () => {
      mouse.active = false;
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseleave', handlePointerLeave);

    // ========================================================
    // 1. WIND STREAMLINE VECTOR FIELD PARTICLES
    // ========================================================
    const streamlineCount = isMobile ? 35 : 75;
    const streamlines: WindStreamline[] = Array.from({ length: streamlineCount }, (_, i) => ({
      x: Math.random() * (width || 1200),
      y: Math.random() * (height || 800),
      trail: [],
      maxTrail: Math.floor(Math.random() * 14 + 10),
      speed: Math.random() * 2.2 + 1.2,
      seed: Math.random() * 100 + i,
      thickness: Math.random() * 1.2 + 0.6,
      alpha: Math.random() * 0.35 + 0.15,
    }));

    // ========================================================
    // 2. RAIN DROP ENTITIES & GROUND RIPPLES
    // ========================================================
    const rainCount = isMobile ? Math.floor(config.rainDensity * 0.45) : config.rainDensity;
    const rainDrops = Array.from({ length: Math.max(rainCount, 30) }, () => ({
      x: Math.random() * (width || 1200),
      y: Math.random() * (height || 800),
      len: Math.random() * 14 + 8,
      speed: Math.random() * 5 + 7,
      opacity: Math.random() * 0.38 + 0.22,
      thickness: Math.random() * 0.8 + 0.7,
    }));

    interface Ripple {
      x: number;
      y: number;
      r: number;
      maxR: number;
      alpha: number;
    }
    const ripples: Ripple[] = [];

    // ========================================================
    // 3. CLOUD CLUSTERS & MIST BANKS
    // ========================================================
    const clouds = [
      { x: -100, y: 120, r: 240, speed: 0.15, alpha: 0.08 },
      { x: 340, y: 70, r: 310, speed: 0.11, alpha: 0.09 },
      { x: 750, y: 150, r: 260, speed: 0.18, alpha: 0.07 },
      { x: 1100, y: 100, r: 320, speed: 0.13, alpha: 0.085 },
    ];

    const mistBanks = Array.from({ length: 5 }, (_, idx) => ({
      x: (idx * 280) % 1100,
      y: 90 + idx * 65,
      w: 520,
      h: 130,
      speed: 0.12 + idx * 0.035,
      alpha: 0.065 + idx * 0.02,
    }));

    // ========================================================
    // 4. SOLAR REFRACTION BOKEH PARTICLES (Clear / Heatwave)
    // ========================================================
    const bokehParticles: BokehParticle[] = Array.from({ length: isMobile ? 12 : 24 }, () => ({
      x: Math.random() * (width || 1200),
      y: Math.random() * (height || 800),
      r: Math.random() * 18 + 6,
      speedY: -(Math.random() * 0.35 + 0.15),
      speedX: Math.random() * 0.4 - 0.2,
      alpha: Math.random() * 0.08 + 0.03,
      pulsePhase: Math.random() * Math.PI * 2,
    }));

    // Animation Timers & State
    let phase = 0;
    let lightningTimer = 0;
    let activeBolt: LightningBolt | null = null;
    let ambientFlash = 0;

    // Helper: Generate procedural multi-branch lightning
    const generateLightning = (startX: number, startY: number, endX: number, endY: number): LightningBolt => {
      const segments: LightningBolt['segments'] = [];
      const steps = 14;
      let currX = startX;
      let currY = startY;

      for (let s = 1; s <= steps; s++) {
        const prog = s / steps;
        const targetX = startX + (endX - startX) * prog;
        const targetY = startY + (endY - startY) * prog;

        // Add jagged perpendicular offset
        const offsetX = (Math.random() - 0.5) * 45;
        const nextX = s === steps ? endX : targetX + offsetX;
        const nextY = targetY;

        segments.push({
          x1: currX,
          y1: currY,
          x2: nextX,
          y2: nextY,
          alpha: 1,
        });

        // 35% chance of spawning an angled lightning branch
        if (Math.random() < 0.35 && s < steps - 2) {
          const branchLen = Math.random() * 60 + 30;
          const branchAngle = (Math.random() - 0.5) * 1.2 + Math.PI * 0.45;
          const bx = nextX + Math.cos(branchAngle) * branchLen;
          const by = nextY + Math.sin(branchAngle) * branchLen;
          segments.push({
            x1: nextX,
            y1: nextY,
            x2: bx,
            y2: by,
            alpha: 0.7,
            branch: true,
          });
        }

        currX = nextX;
        currY = nextY;
      }

      return { segments, alpha: 1 };
    };

    const render = () => {
      if (!isVisible) {
        animFrameId = requestAnimationFrame(render);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const cssWidth = rect.width;
      const cssHeight = rect.height;

      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Reduced motion compliance
      if (prefersReducedMotion) {
        const staticGrad = ctx.createLinearGradient(0, 0, 0, cssHeight);
        staticGrad.addColorStop(0, config.ambientLight);
        staticGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = staticGrad;
        ctx.fillRect(0, 0, cssWidth, cssHeight);
        return;
      }

      phase += 0.012;

      // Smooth mouse position interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.12;
      mouse.y += (mouse.targetY - mouse.y) * 0.12;

      // ========================================================
      // 1. SKY BACKDROP & ATMOSPHERIC BASE
      // ========================================================
      const skyGrad = ctx.createLinearGradient(0, 0, 0, cssHeight);
      skyGrad.addColorStop(0, config.ambientLight);
      skyGrad.addColorStop(0.7, 'transparent');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // ========================================================
      // 2. METEOROLOGICAL ISOBAR PRESSURE CONTOUR WAVES
      // ========================================================
      ctx.save();
      const isobars = [
        { hpa: 1012, baseRatio: 0.28, amp: 18, freq: 0.003, alpha: 0.035 },
        { hpa: 1008, baseRatio: 0.52, amp: 26, freq: 0.0025, alpha: 0.045 },
        { hpa: 1004, baseRatio: 0.76, amp: 20, freq: 0.0035, alpha: 0.03 },
      ];

      isobars.forEach((bar, bIdx) => {
        ctx.beginPath();
        const baseY = cssHeight * bar.baseRatio;
        for (let x = 0; x <= cssWidth; x += 25) {
          const y = baseY + Math.sin(x * bar.freq + phase * 0.8 + bIdx) * bar.amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(56, 189, 248, ${bar.alpha})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 8]);
        ctx.stroke();

        // Faint Isobar Pressure Readout along contour
        if (cssWidth > 640 && bIdx === 1) {
          ctx.font = '9px monospace';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
          ctx.fillText(`${bar.hpa} hPa ISOBAR`, cssWidth * 0.15, baseY - 8);
        }
      });
      ctx.setLineDash([]);
      ctx.restore();

      // ========================================================
      // 3. FLUID AERODYNAMIC WIND STREAMLINE PARTICLES
      // ========================================================
      ctx.save();
      const windAngle =
        atmosphere === 'rain'
          ? Math.PI * 0.32
          : atmosphere === 'thunderstorm'
          ? Math.PI * 0.38
          : atmosphere === 'heatwave'
          ? -Math.PI * 0.15
          : 0.08;

      streamlines.forEach((p) => {
        // Calculate organic stream trajectory with sine wave
        const wave = Math.sin(p.x * 0.004 + phase + p.seed) * 1.4;
        let vx = Math.cos(windAngle) * p.speed;
        let vy = Math.sin(windAngle) * p.speed + wave;

        // Interactive Cursor Ripple / Aerodynamic Deflection
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          const influenceR = 160;

          if (dist < influenceR && dist > 1) {
            const force = (1 - dist / influenceR) * 3.5;
            // Add vortex deflection (perpendicular lift)
            vx += (dx / dist) * force + (-dy / dist) * force * 0.5;
            vy += (dy / dist) * force + (dx / dist) * force * 0.5;
          }
        }

        p.x += vx;
        p.y += vy;

        // Push current position to trail history
        p.trail.unshift({ x: p.x, y: p.y });
        if (p.trail.length > p.maxTrail) {
          p.trail.pop();
        }

        // Wrap around boundaries
        if (p.x > cssWidth + 50) {
          p.x = -40;
          p.trail = [];
        }
        if (p.x < -50) {
          p.x = cssWidth + 40;
          p.trail = [];
        }
        if (p.y > cssHeight + 50) {
          p.y = -40;
          p.trail = [];
        }
        if (p.y < -50) {
          p.y = cssHeight + 40;
          p.trail = [];
        }

        // Draw Streamline Curve with Tapered Opacity
        if (p.trail.length > 2) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let t = 1; t < p.trail.length; t++) {
            ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }

          const streamColor =
            atmosphere === 'clear'
              ? `rgba(251, 191, 36, ${p.alpha * 0.7})`
              : atmosphere === 'heatwave'
              ? `rgba(245, 158, 11, ${p.alpha * 0.8})`
              : atmosphere === 'thunderstorm'
              ? `rgba(186, 230, 253, ${p.alpha * 0.9})`
              : `rgba(148, 163, 184, ${p.alpha * 0.6})`;

          ctx.strokeStyle = streamColor;
          ctx.lineWidth = p.thickness;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Streamline glowing head particle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.thickness * 0.9, 0, Math.PI * 2);
          ctx.fillStyle = streamColor;
          ctx.fill();
        }
      });
      ctx.restore();

      // ========================================================
      // 4. WEATHER-SPECIFIC LAYERS
      // ========================================================
      if (atmosphere === 'clear') {
        // ——— CLEAR SKY: Warm soft daylight, sunbeam refraction, floating bokeh ———
        const beamGrad = ctx.createLinearGradient(0, 0, cssWidth * 0.75, cssHeight * 0.85);
        const sunBreath = Math.sin(phase * 0.5) * 0.02 + 0.05;
        beamGrad.addColorStop(0, `rgba(254, 243, 199, ${sunBreath * 1.5})`);
        beamGrad.addColorStop(0.4, `rgba(253, 230, 138, ${sunBreath})`);
        beamGrad.addColorStop(1, 'transparent');

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cssWidth * 0.1, 0);
        ctx.lineTo(cssWidth * 0.45, 0);
        ctx.lineTo(cssWidth * 0.9, cssHeight);
        ctx.lineTo(cssWidth * 0.35, cssHeight);
        ctx.closePath();
        ctx.fillStyle = beamGrad;
        ctx.fill();
        ctx.restore();

        // Prismatic Floating Bokeh Particles
        ctx.save();
        bokehParticles.forEach((b) => {
          b.y += b.speedY;
          b.x += b.speedX;
          b.pulsePhase += 0.02;

          if (b.y < -30) {
            b.y = cssHeight + 20;
            b.x = Math.random() * cssWidth;
          }

          const pulse = Math.sin(b.pulsePhase) * 0.02 + b.alpha;
          const bGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          bGrad.addColorStop(0, `rgba(253, 230, 138, ${pulse * 1.8})`);
          bGrad.addColorStop(0.6, `rgba(251, 191, 36, ${pulse * 0.8})`);
          bGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

      } else if (atmosphere === 'cloudy') {
        // ——— CLOUDY: Layered drifting stratus clouds with soft volumetric shadows ———
        ctx.save();
        clouds.forEach((c) => {
          c.x += c.speed;
          if (c.x - c.r > cssWidth) c.x = -c.r;

          const cGrad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
          cGrad.addColorStop(0, `rgba(148, 163, 184, ${c.alpha * 1.4})`);
          cGrad.addColorStop(0.5, `rgba(100, 116, 139, ${c.alpha * 0.8})`);
          cGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = cGrad;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

      } else if (atmosphere === 'rain' || atmosphere === 'thunderstorm') {
        // ——— RAIN & THUNDERSTORM: Rain streaks, procedural lightning, ground ripples ———
        const isThunder = atmosphere === 'thunderstorm';

        // Multi-fork lightning bolt trigger
        if (isThunder) {
          lightningTimer++;
          if (lightningTimer > 240 && Math.random() < 0.02) {
            const startX = cssWidth * (0.2 + Math.random() * 0.6);
            const endX = startX + (Math.random() - 0.5) * 220;
            activeBolt = generateLightning(startX, 0, endX, cssHeight * 0.65);
            ambientFlash = 0.32;
            lightningTimer = 0;
          }

          // Ambient flash illumination
          if (ambientFlash > 0.01) {
            ctx.fillStyle = `rgba(186, 230, 253, ${ambientFlash})`;
            ctx.fillRect(0, 0, cssWidth, cssHeight);
            ambientFlash *= 0.86;
          }

          // Render active procedural lightning bolt
          if (activeBolt && activeBolt.alpha > 0.02) {
            ctx.save();
            activeBolt.segments.forEach((seg) => {
              ctx.beginPath();
              ctx.moveTo(seg.x1, seg.y1);
              ctx.lineTo(seg.x2, seg.y2);
              ctx.strokeStyle = `rgba(255, 255, 255, ${activeBolt!.alpha * (seg.branch ? 0.65 : 1)})`;
              ctx.lineWidth = seg.branch ? 1.5 : 2.5;
              ctx.shadowColor = '#38BDF8';
              ctx.shadowBlur = 12;
              ctx.stroke();
            });
            ctx.restore();
            activeBolt.alpha *= 0.82; // rapid lightning decay
          }
        }

        // Draw animated rain streaks
        ctx.save();
        const drift = config.windDrift;
        rainDrops.forEach((drop) => {
          drop.y += drop.speed * (1 + scrollProgress * 0.8);
          drop.x += drift;

          // Mouse deflection on rain
          if (mouse.active) {
            const dx = drop.x - mouse.x;
            const dy = drop.y - mouse.y;
            const d = Math.hypot(dx, dy);
            if (d < 100 && d > 1) {
              drop.x += (dx / d) * 2.5;
            }
          }

          if (drop.y > cssHeight - 40) {
            // Spawn subtle ripple ring
            if (Math.random() < 0.14 && ripples.length < 18) {
              ripples.push({
                x: drop.x,
                y: drop.y + Math.random() * 20,
                r: 1,
                maxR: Math.random() * 16 + 6,
                alpha: 0.38,
              });
            }
            drop.y = -15;
            drop.x = Math.random() * (cssWidth + 100) - 50;
          }
          if (drop.x > cssWidth + 50) drop.x = -20;
          if (drop.x < -50) drop.x = cssWidth + 20;

          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + drift * 2.2, drop.y + drop.len);
          ctx.strokeStyle = `rgba(186, 230, 253, ${drop.opacity})`;
          ctx.lineWidth = drop.thickness;
          ctx.stroke();
        });

        // Draw water ripple rings
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rip = ripples[i];
          rip.r += 0.6;
          rip.alpha *= 0.94;

          if (rip.alpha < 0.02 || rip.r > rip.maxR) {
            ripples.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.ellipse(rip.x, rip.y, rip.r * 1.6, rip.r * 0.65, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(186, 230, 253, ${rip.alpha * 0.6})`;
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
        ctx.restore();

      } else if (atmosphere === 'fog') {
        // ——— FOG: Low-altitude fluid vapor drifting across the hero ———
        ctx.save();
        mistBanks.forEach((mist) => {
          mist.x += mist.speed;
          if (mist.x - mist.w / 2 > cssWidth) mist.x = -mist.w / 2;

          const mGrad = ctx.createRadialGradient(
            mist.x,
            mist.y,
            0,
            mist.x,
            mist.y,
            mist.w * 0.5
          );
          mGrad.addColorStop(0, `rgba(226, 232, 240, ${mist.alpha})`);
          mGrad.addColorStop(0.6, `rgba(203, 213, 225, ${mist.alpha * 0.4})`);
          mGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = mGrad;
          ctx.beginPath();
          ctx.ellipse(mist.x, mist.y, mist.w * 0.6, mist.h * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

      } else if (atmosphere === 'heatwave') {
        // ——— HEATWAVE: Upward thermal updraft mirage shimmer & solar flare ———
        ctx.save();
        const shimmerCount = 5;
        for (let s = 0; s < shimmerCount; s++) {
          const baseY = cssHeight * (0.38 + s * 0.12);
          ctx.beginPath();
          for (let x = 0; x <= cssWidth; x += 25) {
            const wave = Math.sin(x * 0.012 + phase * 2.2 + s * 1.5) * (3.5 + s * 0.8);
            if (x === 0) ctx.moveTo(x, baseY + wave);
            else ctx.lineTo(x, baseY + wave);
          }
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.038 + s * 0.01})`;
          ctx.lineWidth = 2 + s * 0.5;
          ctx.stroke();
        }

        // Restrained warm sun glow in upper corner
        const sunGlow = ctx.createRadialGradient(
          cssWidth * 0.85,
          cssHeight * 0.15,
          0,
          cssWidth * 0.85,
          cssHeight * 0.15,
          cssHeight * 0.55
        );
        sunGlow.addColorStop(0, 'rgba(245, 158, 11, 0.08)');
        sunGlow.addColorStop(0.6, 'rgba(217, 119, 6, 0.03)');
        sunGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, cssWidth, cssHeight);
        ctx.restore();
      }

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, [atmosphere, scrollProgress, config]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
        mixBlendMode: 'screen',
      }}
      aria-hidden="true"
    />
  );
}
