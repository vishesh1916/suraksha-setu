'use client';

import Link from 'next/link';
import styles from './DopplerRadarMapCard.module.css';

interface Props {
  className?: string;
}

export function DopplerRadarMapCard({ className = '' }: Props) {
  return (
    <div className={`${styles.cardContainer} ${className}`}>
      {/* Satellite Ocean & Land Background SVG */}
      <svg
        className={styles.mapSvg}
        viewBox="0 0 700 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Satellite ocean gradient */}
          <radialGradient id="oceanGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#142A38" />
            <stop offset="60%" stopColor="#0B1A24" />
            <stop offset="100%" stopColor="#061017" />
          </radialGradient>

          {/* Subcontinent land gradient */}
          <linearGradient id="landGrad" x1="30%" y1="10%" x2="70%" y2="90%">
            <stop offset="0%" stopColor="#1E3847" />
            <stop offset="40%" stopColor="#244252" />
            <stop offset="100%" stopColor="#1A3340" />
          </linearGradient>

          {/* Rainband Radar Echo Gradients */}
          <radialGradient id="echoRed" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E53E3E" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#ED8936" stopOpacity="0.75" />
            <stop offset="75%" stopColor="#ECC94B" stopOpacity="0.6" />
            <stop offset="95%" stopColor="#48BB78" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#319795" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="echoGreen" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ECC94B" stopOpacity="0.75" />
            <stop offset="50%" stopColor="#48BB78" stopOpacity="0.65" />
            <stop offset="85%" stopColor="#319795" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#319795" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ocean Backdrop */}
        <rect width="700" height="420" fill="url(#oceanGrad)" />

        {/* Coordinate Grid Lines */}
        <g stroke="rgba(255, 255, 255, 0.06)" strokeWidth="0.8" strokeDasharray="4 6">
          <line x1="0" y1="100" x2="700" y2="100" />
          <line x1="0" y1="200" x2="700" y2="200" />
          <line x1="0" y1="300" x2="700" y2="300" />
          <line x1="180" y1="0" x2="180" y2="420" />
          <line x1="360" y1="0" x2="360" y2="420" />
          <line x1="540" y1="0" x2="540" y2="420" />
        </g>

        {/* India & South Asia Landmass Silhouette */}
        <path
          d="M 280,45 
             C 310,40 330,35 350,50 
             C 370,60 400,75 425,70 
             C 450,65 480,80 505,85 
             C 530,90 560,95 580,110 
             C 600,125 615,145 610,165 
             C 605,185 580,200 565,190 
             C 550,180 535,175 520,185 
             C 505,195 490,215 480,230 
             C 470,245 450,265 440,285 
             C 430,305 415,335 405,365 
             C 395,395 385,410 375,415 
             C 365,410 355,385 345,355 
             C 335,325 320,295 310,270 
             C 300,245 280,225 270,205 
             C 260,185 235,175 220,160 
             C 205,145 210,125 225,115 
             C 240,105 255,100 265,80 
             Z"
          fill="url(#landGrad)"
          stroke="rgba(200, 227, 234, 0.28)"
          strokeWidth="1.2"
        />

        {/* State Boundaries / Relief Contours */}
        <path
          d="M 280,120 Q 340,140 400,130 Q 460,140 510,125"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="0.8"
          strokeDasharray="2 3"
        />
        <path
          d="M 270,200 Q 330,220 390,210 Q 450,230 480,230"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="0.8"
          strokeDasharray="2 3"
        />
        <path
          d="M 310,270 Q 360,290 410,275"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="0.8"
          strokeDasharray="2 3"
        />

        {/* Doppler Precipitation Rainbands (Multi-spectrum dBZ echoes) */}
        {/* Core Lucknow / Awadh Rainband */}
        <ellipse cx="440" cy="180" rx="90" ry="55" fill="url(#echoRed)" />
        <ellipse cx="435" cy="175" rx="55" ry="32" fill="#E53E3E" opacity="0.85" />
        <ellipse cx="430" cy="172" rx="28" ry="16" fill="#C53030" opacity="0.95" />

        {/* Western Ghats / Coastal Surcharge */}
        <ellipse cx="275" cy="220" rx="65" ry="40" fill="url(#echoGreen)" />
        <ellipse cx="270" cy="215" rx="35" ry="20" fill="#ECC94B" opacity="0.75" />

        {/* Eastern Coastal Delta Rainband */}
        <ellipse cx="505" cy="245" rx="75" ry="45" fill="url(#echoRed)" />
        <ellipse cx="500" cy="240" rx="42" ry="22" fill="#E53E3E" opacity="0.8" />

        {/* Major City Coordinate Markers */}
        <circle cx="360" cy="135" r="3" fill="#FFFFFF" opacity="0.8" />
        <text x="368" y="139" fill="rgba(255,255,255,0.75)" fontSize="9" fontFamily="system-ui" fontWeight="600">
          New Delhi
        </text>

        <circle cx="305" cy="240" r="3" fill="#FFFFFF" opacity="0.8" />
        <text x="313" y="244" fill="rgba(255,255,255,0.75)" fontSize="9" fontFamily="system-ui" fontWeight="600">
          Mumbai
        </text>

        <circle cx="375" cy="340" r="3" fill="#FFFFFF" opacity="0.8" />
        <text x="383" y="344" fill="rgba(255,255,255,0.75)" fontSize="9" fontFamily="system-ui" fontWeight="600">
          Bengaluru
        </text>
      </svg>

      {/* Pulsing Alert Pin at Lucknow, UP */}
      <div className={styles.alertPinWrapper}>
        <div className={styles.pinDotPulse} />
        <div className={styles.pinCard}>
          <span className={styles.pinDot} />
          <div className={styles.pinContent}>
            <span className={styles.pinTitle}>Heavy Rain Alert</span>
            <span className={styles.pinSub}>Lucknow, UP</span>
          </div>
        </div>
      </div>

      {/* Floating Map Controls on the Right */}
      <div className={styles.mapControls}>
        <button type="button" className={styles.controlBtn} title="Layer Switcher" aria-label="Layer Switcher">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </button>

        <button type="button" className={styles.controlBtn} title="My Location" aria-label="My Location">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="7" />
            <polyline points="12 9 12 12 13.5 13.5" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>

        <div className={styles.zoomGroup}>
          <button type="button" className={styles.zoomBtn} title="Zoom in" aria-label="Zoom in">
            +
          </button>
          <div className={styles.zoomDivider} />
          <button type="button" className={styles.zoomBtn} title="Zoom out" aria-label="Zoom out">
            −
          </button>
        </div>
      </div>
    </div>
  );
}
