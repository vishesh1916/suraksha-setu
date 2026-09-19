'use client';

import { useEffect, useRef } from 'react';

interface Props {
  className?: string;
  activeHazardsCount?: number;
}

interface CityCoord {
  name: string;
  xRatio: number; // 0 to 1 relative to canvas width
  yRatio: number; // 0 to 1 relative to canvas height
}

interface RouteSegment {
  from: string;
  to: string;
  cycleInterval: number; // seconds between illuminations
  duration: number; // seconds for signal to travel
  startTime: number;
}

export function AtmosphericWeatherHero({ className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId: number;
    let isVisible = true;

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let width = 0;
    let height = 0;

    const resize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // City Coordinates precisely aligned with hero-clean-bg.jpg
    const cities: CityCoord[] = [
      { name: 'New Delhi', xRatio: 0.513, yRatio: 0.22 },
      { name: 'Lucknow', xRatio: 0.572, yRatio: 0.328 },
      { name: 'Patna', xRatio: 0.608, yRatio: 0.344 },
      { name: 'Mumbai', xRatio: 0.469, yRatio: 0.453 },
      { name: 'Bengaluru', xRatio: 0.535, yRatio: 0.625 },
    ];

    // Infrastructure Intelligence Routes
    const routes: RouteSegment[] = [
      { from: 'Mumbai', to: 'New Delhi', cycleInterval: 14, duration: 3.8, startTime: 1 },
      { from: 'New Delhi', to: 'Lucknow', cycleInterval: 12, duration: 3.2, startTime: 4 },
      { from: 'Lucknow', to: 'Patna', cycleInterval: 16, duration: 3.5, startTime: 7 },
      { from: 'Mumbai', to: 'Bengaluru', cycleInterval: 18, duration: 4.0, startTime: 10 },
      { from: 'Bengaluru', to: 'Lucknow', cycleInterval: 20, duration: 4.6, startTime: 13 },
    ];

    let time = 0;

    const render = () => {
      if (!isVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      time += prefersReducedMotion ? 0.005 : 0.016;

      ctx.clearRect(0, 0, width, height);

      // ============================================================
      // LAYER 1 — ATMOSPHERIC AMBIENT GLOW
      // ============================================================
      const atmSlow = time * 0.04;
      const grad1X = width * 0.52 + Math.sin(atmSlow) * (width * 0.08);
      const grad1Y = height * 0.45 + Math.cos(atmSlow * 0.7) * (height * 0.10);
      const atmGrad = ctx.createRadialGradient(grad1X, grad1Y, 0, grad1X, grad1Y, width * 0.45);
      atmGrad.addColorStop(0, 'rgba(215, 238, 245, 0.20)');
      atmGrad.addColorStop(0.6, 'rgba(200, 230, 240, 0.08)');
      atmGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = atmGrad;
      ctx.fillRect(0, 0, width, height);

      // ============================================================
      // LAYER 2 — DYNAMIC INFRASTRUCTURE MESH & TRAVELING SIGNALS
      // ============================================================
      routes.forEach((route) => {
        const fromCity = cities.find((c) => c.name === route.from);
        const toCity = cities.find((c) => c.name === route.to);
        if (!fromCity || !toCity) return;

        const x1 = fromCity.xRatio * width;
        const y1 = fromCity.yRatio * height;
        const x2 = toCity.xRatio * width;
        const y2 = toCity.yRatio * height;

        // Subtle baseline signal route
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = 'rgba(76, 141, 162, 0.12)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Traveling pulse packet
        const elapsed = (time - route.startTime) % route.cycleInterval;
        if (elapsed > 0 && elapsed < route.duration) {
          const progress = elapsed / route.duration;
          const signalAlpha = Math.sin(progress * Math.PI) * 0.75;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(53, 114, 136, ${signalAlpha * 0.55})`;
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Glowing traveling beacon
          const px = x1 + (x2 - x1) * progress;
          const py = y1 + (y2 - y1) * progress;
          ctx.beginPath();
          ctx.arc(px, py, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(47, 133, 125, ${signalAlpha * 0.95})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(px, py, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(76, 141, 162, ${signalAlpha * 0.35})`;
          ctx.fill();
        }
      });

      // City Landmark Pulse Rings (Soft animated breathing rings)
      cities.forEach((city, cIdx) => {
        const cx = city.xRatio * width;
        const cy = city.yRatio * height;
        const pulseCycle = (time * 1.5 + cIdx * 1.2) % 3;
        const pulseRatio = pulseCycle / 3;
        const ringRadius = 4 + pulseRatio * 14;
        const ringAlpha = Math.max(0, (1 - pulseRatio) * 0.45);

        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(53, 114, 136, ${ringAlpha})`;
        ctx.lineWidth = 1.0;
        ctx.stroke();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
