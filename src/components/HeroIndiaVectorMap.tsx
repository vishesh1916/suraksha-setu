'use client';

import { useEffect, useState } from 'react';
import { INDIA_SVG_PATH, INDIA_MAP_CITIES } from './indiaSvgPath';

interface RouteDef {
  from: string;
  to: string;
  cycle: number;
  offset: number;
}

const ROUTES: RouteDef[] = [
  { from: 'Mumbai', to: 'New Delhi', cycle: 4.5, offset: 0 },
  { from: 'New Delhi', to: 'Lucknow', cycle: 3.8, offset: 1.2 },
  { from: 'Lucknow', to: 'Patna', cycle: 3.5, offset: 2.4 },
  { from: 'Mumbai', to: 'Bengaluru', cycle: 4.2, offset: 0.8 },
  { from: 'Bengaluru', to: 'Lucknow', cycle: 5.0, offset: 2.0 },
];

export function HeroIndiaVectorMap() {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let animId: number;
    const start = performance.now();

    const frame = (now: number) => {
      setTime((now - start) / 1000);
      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Helper to find city coordinates
  const getCity = (name: string) => INDIA_MAP_CITIES.find((c) => c.name === name);

  // Sri Lanka coordinates aligned with Tamil Nadu apex (in local subcontinent coordinates)
  const sriLanka = { cx: 405, cy: 1045, rx: 18, ry: 32, rot: 15 };

  // Cyclone vortex center (Bay of Bengal / East of card)
  const cyclone = { cx: 1420, cy: 300 };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1600 1020"
        preserveAspectRatio="xMidYMid slice"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        <defs>
          {/* Western Ocean Ripple Mask: Prevents any ripple lines from encroaching into the left text zone */}
          <mask id="oceanRippleMask">
            <linearGradient id="rippleFadeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#000000" />
              <stop offset="38%" stopColor="#000000" />
              <stop offset="43%" stopColor="#777777" />
              <stop offset="47%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>
            <rect x="0" y="0" width="1600" height="1020" fill="url(#rippleFadeGrad)" />
          </mask>

          {/* Soft Editorial Topographic Relief Fill Gradient for India Subcontinent */}
          <linearGradient id="heroIndiaRelief" x1="0%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#CBE2EC" stopOpacity="0.48" />
            <stop offset="35%" stopColor="#DEF0F5" stopOpacity="0.38" />
            <stop offset="70%" stopColor="#C6DFEB" stopOpacity="0.44" />
            <stop offset="100%" stopColor="#BEDAE7" stopOpacity="0.54" />
          </linearGradient>

          {/* Ambient Background Glow for Cyclone Vortex */}
          <radialGradient id="cycloneGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38A3A5" stopOpacity="0.22" />
            <stop offset="45%" stopColor="#57CC99" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#EBF4F8" stopOpacity="0" />
          </radialGradient>

          {/* Faint subtle elevation drop shadow for landmass */}
          <filter id="landmassShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor="#386A7A" floodOpacity="0.06" />
          </filter>
        </defs>

        {/* ============================================================
            1. GEOGRAPHIC LATITUDE / LONGITUDE GIS GRID (Subtle & Crisp)
            ============================================================ */}
        <g stroke="rgba(56, 123, 146, 0.10)" strokeWidth="0.8" strokeDasharray="3 7">
          {/* Parallels (30°N, 20°N, 10°N) */}
          <line x1="600" y1="280" x2="1560" y2="280" />
          <line x1="600" y1="550" x2="1560" y2="550" />
          <line x1="600" y1="820" x2="1560" y2="820" />

          {/* Meridians (70°E, 80°E, 90°E) */}
          <line x1="680" y1="50" x2="680" y2="980" />
          <line x1="940" y1="50" x2="940" y2="980" />
          <line x1="1260" y1="50" x2="1260" y2="980" />
        </g>

        {/* Coordinate Labels */}
        <g fill="rgba(56, 123, 146, 0.40)" fontSize="9.5" fontFamily="ui-monospace, monospace" fontWeight="600">
          <text x="615" y="274">30° N</text>
          <text x="615" y="544">20° N</text>
          <text x="615" y="814">10° N</text>
          <text x="946" y="1000">80° E</text>
          <text x="1266" y="1000">90° E</text>
        </g>

        {/* ============================================================
            2. INDIA SUBCONTINENT GROUP (Centered Behind Card & In Gap)
               Gujarat: ~43% width, Mumbai: ~50%, Card starts: ~60%
            ============================================================ */}
        <g transform="translate(665, 45) scale(0.77)">
          {/* Concentric Coastal Ocean Depth Ripples (Masked to avoid left text) */}
          <g mask="url(#oceanRippleMask)">
            {[1.06, 1.13, 1.21, 1.30].map((ratio, idx) => {
              const opacities = [0.15, 0.10, 0.06, 0.03];
              const isDashed = idx % 2 === 1;
              return (
                <path
                  key={`ocean-ripple-${idx}`}
                  d={INDIA_SVG_PATH}
                  fill="none"
                  stroke="rgba(56, 123, 146, 1)"
                  strokeOpacity={opacities[idx]}
                  strokeWidth="1.0"
                  strokeDasharray={isDashed ? '4 5' : undefined}
                  transform={`matrix(${ratio} 0 0 ${ratio} ${-(ratio - 1) * 440} ${-(ratio - 1) * 520})`}
                />
              );
            })}
          </g>

          {/* Main Subcontinent Vector Boundary & Soft Tinted Fill */}
          <path
            d={INDIA_SVG_PATH}
            fill="url(#heroIndiaRelief)"
            stroke="#4C8DA2"
            strokeOpacity="0.50"
            strokeWidth="1.3"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#landmassShadow)"
          />

          {/* Inner Topographic Elevation Contours */}
          {[0.85, 0.70, 0.55, 0.40].map((ratio, idx) => {
            const isDashed = idx === 1 || idx === 3;
            return (
              <path
                key={`topo-contour-${idx}`}
                d={INDIA_SVG_PATH}
                fill="none"
                stroke="rgba(56, 123, 146, 0.22)"
                strokeWidth="0.9"
                strokeDasharray={isDashed ? '3 4' : undefined}
                transform={`matrix(${ratio} 0 0 ${ratio} ${-(ratio - 1) * 440} ${-(ratio - 1) * 520})`}
              />
            );
          })}

          {/* Sri Lanka Teardrop Island */}
          <ellipse
            cx={sriLanka.cx}
            cy={sriLanka.cy}
            rx={sriLanka.rx}
            ry={sriLanka.ry}
            transform={`rotate(${sriLanka.rot} ${sriLanka.cx} ${sriLanka.cy})`}
            fill="url(#heroIndiaRelief)"
            stroke="#4C8DA2"
            strokeOpacity="0.50"
            strokeWidth="1.3"
          />

          {/* Infrastructure Route Networks & Signal Beacons */}
          {ROUTES.map((route, rIdx) => {
            const from = getCity(route.from);
            const to = getCity(route.to);
            if (!from || !to) return null;

            const elapsed = (time + route.offset) % route.cycle;
            const progress = elapsed / route.cycle;
            const beaconX = from.x + (to.x - from.x) * progress;
            const beaconY = from.y + (to.y - from.y) * progress;
            const pulseAlpha = Math.sin(progress * Math.PI) * 0.85;

            return (
              <g key={`route-${rIdx}`}>
                {/* Dotted Route Vector */}
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgba(56, 123, 146, 0.22)"
                  strokeWidth="1.1"
                  strokeDasharray="4 5"
                />

                {/* Traveling Signal Line Highlight */}
                {progress > 0.05 && progress < 0.95 && (
                  <line
                    x1={from.x + (to.x - from.x) * Math.max(0, progress - 0.12)}
                    y1={from.y + (to.y - from.y) * Math.max(0, progress - 0.12)}
                    x2={beaconX}
                    y2={beaconY}
                    stroke={`rgba(47, 133, 125, ${pulseAlpha})`}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                )}

                {/* Glowing Traveling Beacon Point */}
                {progress > 0.02 && progress < 0.98 && (
                  <circle
                    cx={beaconX}
                    cy={beaconY}
                    r="3.0"
                    fill={`rgba(31, 143, 122, ${pulseAlpha})`}
                    filter="drop-shadow(0 0 3px rgba(47, 133, 125, 0.7))"
                  />
                )}
              </g>
            );
          })}

          {/* City Landmarks & Subtle Radar Halos */}
          {INDIA_MAP_CITIES.map((city, cIdx) => {
            const pulse = (time * 1.5 + cIdx * 1.1) % 2.5;
            const pulseRatio = pulse / 2.5;
            const ringRadius = 4 + pulseRatio * 14;
            const ringAlpha = (1 - pulseRatio) * 0.45;

            return (
              <g key={`city-${city.name}`}>
                {/* Expanding Breathing Pulse Ring */}
                <circle
                  cx={city.x}
                  cy={city.y}
                  r={ringRadius}
                  fill="none"
                  stroke={`rgba(56, 123, 146, ${ringAlpha})`}
                  strokeWidth="1.0"
                />

                {/* Solid Core Dot */}
                <circle
                  cx={city.x}
                  cy={city.y}
                  r="3.4"
                  fill="#1F3440"
                  stroke="#FFFFFF"
                  strokeWidth="1.4"
                />

                {/* Vector City Label Typography */}
                <text
                  x={city.x + 8}
                  y={city.y + 4}
                  fill="#1F3440"
                  fillOpacity="0.80"
                  fontSize="11.5"
                  fontWeight="600"
                  fontFamily="Inter, -apple-system, sans-serif"
                  letterSpacing="-0.01em"
                >
                  {city.name}
                </text>
              </g>
            );
          })}
        </g>

        {/* ============================================================
            3. BAY OF BENGAL CYCLONE ISOBAR SPIRAL (Upper Right)
            ============================================================ */}
        <g transform={`translate(${cyclone.cx}, ${cyclone.cy})`}>
          {/* Ambient Glowing Storm Eye */}
          <circle cx="0" cy="0" r="130" fill="url(#cycloneGlow)" />

          {/* Concentric Isobar Arcs with Subtle Rotation Drift */}
          {[45, 80, 125, 175, 235, 305].map((r, idx) => {
            const isDashed = idx % 2 === 1;
            const alpha = Math.max(0.03, 0.22 - idx * 0.032);
            return (
              <ellipse
                key={`isobar-${idx}`}
                cx="0"
                cy="0"
                rx={r}
                ry={r * 0.92}
                transform={`rotate(${time * 1.5 + idx * 15})`}
                fill="none"
                stroke="rgba(42, 115, 138, 1)"
                strokeOpacity={alpha}
                strokeWidth="1.0"
                strokeDasharray={isDashed ? '5 6' : undefined}
              />
            );
          })}

          {/* Cyclone Eye Core */}
          <circle cx="0" cy="0" r="5" fill="#38A3A5" fillOpacity="0.40" />
          <circle cx="0" cy="0" r="2.5" fill="#1F3440" fillOpacity="0.70" />
        </g>

        {/* ============================================================
            4. UPPER RIGHT VECTOR TYPOGRAPHY
            ============================================================ */}
        <g
          transform="translate(1440, 115)"
          textAnchor="end"
          fill="rgba(31, 52, 64, 0.50)"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontWeight="700"
          fontSize="10"
          letterSpacing="0.12em"
        >
          <text y="0">REAL-TIME</text>
          <text y="16">INTELLIGENCE</text>
          <text y="32">FOR A SAFER INDIA</text>
        </g>
      </svg>
    </div>
  );
}
