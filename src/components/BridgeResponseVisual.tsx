'use client';

import Link from 'next/link';
import styles from './BridgeResponseVisual.module.css';

interface Props {
  className?: string;
}

export function BridgeResponseVisual({ className = '' }: Props) {
  return (
    <div className={`${styles.container} ${className}`}>
      {/* Background Graphic of Flooded Bridge / Urban River */}
      <svg
        className={styles.bgSvg}
        viewBox="0 0 640 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8FA8B5" />
            <stop offset="40%" stopColor="#A4BCC7" />
            <stop offset="100%" stopColor="#BBD0DA" />
          </linearGradient>

          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#58696F" />
            <stop offset="35%" stopColor="#435258" />
            <stop offset="100%" stopColor="#303C41" />
          </linearGradient>

          <linearGradient id="bridgeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4A565C" />
            <stop offset="50%" stopColor="#63737A" />
            <stop offset="100%" stopColor="#4A565C" />
          </linearGradient>

          <linearGradient id="mistGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Misty Overcast Sky */}
        <rect width="640" height="240" fill="url(#skyGrad)" />

        {/* Distant City Skyline & Shoreline Foliage */}
        <path
          d="M 0,160 L 40,150 L 70,155 L 120,140 L 160,150 L 220,145 L 280,150 L 350,140 L 410,152 L 480,145 L 550,155 L 640,148 L 640,220 L 0,220 Z"
          fill="#526269"
          opacity="0.65"
        />

        {/* Lush Riverbank Trees (Submerged in flood water) */}
        <ellipse cx="60" cy="185" rx="55" ry="30" fill="#2E4035" opacity="0.85" />
        <ellipse cx="140" cy="190" rx="45" ry="25" fill="#2E4035" opacity="0.9" />
        <ellipse cx="520" cy="195" rx="75" ry="35" fill="#2E4035" opacity="0.85" />
        <ellipse cx="600" cy="190" rx="60" ry="30" fill="#2E4035" opacity="0.9" />

        {/* Grand Municipal Arched Bridge Span */}
        <rect x="0" y="165" width="640" height="14" fill="url(#bridgeGrad)" />
        {/* Bridge Railing */}
        <rect x="0" y="159" width="640" height="6" fill="#3D474C" opacity="0.75" />

        {/* Bridge Arches & Water Flow */}
        <path
          d="M 60,179 Q 95,195 130,179 
             L 155,179 Q 190,195 225,179 
             L 250,179 Q 285,195 320,179 
             L 345,179 Q 380,195 415,179 
             L 440,179 Q 475,195 510,179 
             L 535,179 Q 570,195 605,179"
          fill="#374146"
        />

        {/* High Flood Water Surface */}
        <rect x="0" y="185" width="640" height="215" fill="url(#waterGrad)" />

        {/* Water Reflections and Wake Streaks */}
        <g stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.2">
          <line x1="80" y1="230" x2="220" y2="230" strokeDasharray="12 8" />
          <line x1="280" y1="250" x2="480" y2="250" strokeDasharray="16 10" />
          <line x1="140" y1="280" x2="360" y2="280" strokeDasharray="20 12" />
          <line x1="320" y1="310" x2="560" y2="310" strokeDasharray="14 10" />
          <line x1="40" y1="345" x2="260" y2="345" strokeDasharray="18 12" />
        </g>

        {/* Atmospheric Monsoon Rain Mist Overlay */}
        <rect x="0" y="120" width="640" height="120" fill="url(#mistGrad)" />
      </svg>

      {/* Center Interactive SOS Beacon with Concentric Waves */}
      <div className={styles.sosBeaconAnchor}>
        <div className={styles.rippleWave1} />
        <div className={styles.rippleWave2} />
        <div className={styles.rippleWave3} />
        <div className={styles.rippleWave4} />

        <Link href="/sos" className={styles.sosCenterBtn} title="Emergency SOS Signal Active">
          <span className={styles.sosText}>SOS</span>
        </Link>
      </div>

      {/* Floating Tactical Dispatch Status Tag */}
      <div className={styles.dispatchStatusCard}>
        <span className={styles.checkIconWrap}>✓</span>
        <div className={styles.dispatchTextWrap}>
          <span className={styles.dispatchTitle}>Help is on the way</span>
          <span className={styles.dispatchSub}>NDRF team dispatched</span>
        </div>
      </div>
    </div>
  );
}
