'use client';

import { useEffect, useRef } from 'react';
import type { WeatherAtmosphereType, WeatherAtmosphereConfig } from '@/lib/weatherAtmosphere';
import { ATMOSPHERE_CONFIGS } from '@/lib/weatherAtmosphere';

interface WeatherHeroAtmosphereProps {
  atmosphere: WeatherAtmosphereType;
  scrollProgress?: number;
  className?: string;
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

    // Weather particle entities
    const particleCount = isMobile ? Math.floor(config.rainDensity * 0.45) : config.rainDensity;
    const rainDrops = Array.from({ length: Math.max(particleCount, 30) }, () => ({
      x: Math.random() * (width || 800),
      y: Math.random() * (height || 600),
      len: Math.random() * 12 + 8,
      speed: Math.random() * 4 + 6,
      opacity: Math.random() * 0.35 + 0.2,
      thickness: Math.random() * 0.8 + 0.7,
    }));

    // Ripple rings for rain
    interface Ripple {
      x: number;
      y: number;
      r: number;
      maxR: number;
      alpha: number;
    }
    const ripples: Ripple[] = [];

    // Cloud clusters for overcast/cloudy
    const clouds = [
      { x: -100, y: 120, r: 240, speed: 0.15, alpha: 0.08 },
      { x: 300, y: 80, r: 310, speed: 0.11, alpha: 0.09 },
      { x: 700, y: 160, r: 260, speed: 0.18, alpha: 0.07 },
    ];

    // Mist banks for fog
    const mistBanks = Array.from({ length: 4 }, (_, idx) => ({
      x: (idx * 280) % 900,
      y: 90 + idx * 70,
      w: 480,
      h: 120,
      speed: 0.12 + idx * 0.04,
      alpha: 0.07 + idx * 0.02,
    }));

    // Sunbeam / Daylight shimmer phases
    let phase = 0;
    let lightningTimer = 0;
    let lightningFlash = 0;

    const render = () => {
      if (!isVisible) {
        animFrameId = requestAnimationFrame(render);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const cssWidth = rect.width;
      const cssHeight = rect.height;

      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // If reduced motion is requested, render static calm ambient gradient
      if (prefersReducedMotion) {
        const staticGrad = ctx.createLinearGradient(0, 0, 0, cssHeight);
        staticGrad.addColorStop(0, config.ambientLight);
        staticGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = staticGrad;
        ctx.fillRect(0, 0, cssWidth, cssHeight);
        return;
      }

      phase += 0.015;

      // ========================================================
      // 1. ATMOSPHERIC BASE & SKY BACKDROP
      // ========================================================
      const skyGrad = ctx.createLinearGradient(0, 0, 0, cssHeight);
      skyGrad.addColorStop(0, config.ambientLight);
      skyGrad.addColorStop(0.6, 'transparent');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // ========================================================
      // 2. WEATHER-SPECIFIC VISUAL SIMULATION LAYERS
      // ========================================================
      if (atmosphere === 'clear') {
        // ——— CLEAR SKY: Soft warm daylight, subtle moving haze, gentle sunlight reflections ———
        // Soft angled sunlight beam
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

        // Subtle undulating daylight haze lines
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.04)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          const waveY = cssHeight * (0.35 + i * 0.15);
          for (let x = 0; x <= cssWidth; x += 30) {
            const y = waveY + Math.sin(x * 0.005 + phase + i) * 6;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();

      } else if (atmosphere === 'cloudy') {
        // ——— CLOUDY / OVERCAST: Layered drifting clouds, soft gray-green light, atmospheric movement ———
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
        // ——— RAIN / MONSOON: Refined animated rain streaks, wet-glass reflections, ripple echoes ———
        const isThunder = atmosphere === 'thunderstorm';

        // Distant muted lightning flash (soft atmospheric spike, no harsh strobe)
        if (isThunder) {
          lightningTimer++;
          if (lightningTimer > 280 && Math.random() < 0.015) {
            lightningFlash = 0.22;
            lightningTimer = 0;
          }
          if (lightningFlash > 0.005) {
            ctx.fillStyle = `rgba(186, 230, 253, ${lightningFlash})`;
            ctx.fillRect(0, 0, cssWidth, cssHeight);
            lightningFlash *= 0.88; // smooth natural decay
          }
        }

        // Draw animated rain streaks
        ctx.save();
        const drift = config.windDrift;
        rainDrops.forEach((drop) => {
          drop.y += drop.speed * (1 + scrollProgress * 0.8);
          drop.x += drift;

          if (drop.y > cssHeight - 40) {
            // Spawn subtle ripple ring
            if (Math.random() < 0.12 && ripples.length < 16) {
              ripples.push({
                x: drop.x,
                y: drop.y + Math.random() * 20,
                r: 1,
                maxR: Math.random() * 14 + 6,
                alpha: 0.35,
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
          rip.r += 0.55;
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
        // ——— FOG / MIST: Low-opacity mist moving slowly across the hero, softened silhouettes ———
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
        // ——— HEATWAVE: Warm atmospheric shimmer, dry haze, restrained sun glow ———
        ctx.save();
        const shimmerCount = 5;
        for (let s = 0; s < shimmerCount; s++) {
          const baseY = cssHeight * (0.4 + s * 0.12);
          ctx.beginPath();
          for (let x = 0; x <= cssWidth; x += 25) {
            const wave = Math.sin(x * 0.012 + phase * 2.2 + s * 1.5) * (3.5 + s * 0.8);
            if (x === 0) ctx.moveTo(x, baseY + wave);
            else ctx.lineTo(x, baseY + wave);
          }
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.035 + s * 0.01})`;
          ctx.lineWidth = 2 + s * 0.5;
          ctx.stroke();
        }

        // Restrained warm sun glow in upper corner (never garish orange)
        const sunGlow = ctx.createRadialGradient(
          cssWidth * 0.85,
          cssHeight * 0.15,
          0,
          cssWidth * 0.85,
          cssHeight * 0.15,
          cssHeight * 0.55
        );
        sunGlow.addColorStop(0, 'rgba(245, 158, 11, 0.07)');
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
