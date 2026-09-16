'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from './footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Brand Column */}
        <div className={styles.brandCol}>
          <div className={styles.wordmark}>
            <Image
              src="/logo.png"
              alt="Suraksha Setu Emblem"
              width={34}
              height={34}
              className={styles.brandLogoImg}
            />
            <span>SURAKSHA SETU</span>
          </div>
          <p className={styles.tagline}>
            Hyperlocal weather clarity, disaster intelligence, and early warning network for India.
          </p>
          <div className={styles.statusPill}>
            <span className={styles.statusDot} />
            <span>Telemetry Grid · All 45 Radar Stations Operational</span>
          </div>
          <div className={styles.emergencyHelpline}>
            <span>Emergency Services:</span>
            <a href="tel:112" className={styles.helplineBadge}>Dial 112 (Toll Free)</a>
          </div>
        </div>

        {/* Links Navigation */}
        <div className={styles.linksGrid}>
          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>Platform</h4>
            <ul className={styles.linkList}>
              <li><Link href="/map">Live Risk Map</Link></li>
              <li><Link href="/report">Report a Hazard</Link></li>
              <li><Link href="/alerts">Official Alerts</Link></li>
              <li><Link href="/track">Track Report Status</Link></li>
              <li><Link href="/weather">All-India Radar Weather</Link></li>
            </ul>
          </div>

          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>Operations</h4>
            <ul className={styles.linkList}>
              <li><Link href="/authorities">For Authorities</Link></li>
              <li><Link href="/staff/admin">Command Triage</Link></li>
              <li><Link href="/safety">Safety Guidelines</Link></li>
              <li><Link href="/about">Mission &amp; Architecture</Link></li>
              <li><Link href="/login">Officer Sign In</Link></li>
            </ul>
          </div>

          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>Standards</h4>
            <ul className={styles.linkList}>
              <li><span>Common Alerting Protocol (CAP 1.2)</span></li>
              <li><span>Uber H3 Spatial Hexagons</span></li>
              <li><span>Doppler S-Band Telemetry</span></li>
              <li><span>IMD &amp; NDMA Interoperability</span></li>
              <li><span>Privacy-Preserving Reporting</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.bottomContainer}>
          <p>© {new Date().getFullYear()} SURAKSHA SETU. National Hyperlocal Weather &amp; Disaster Resilience Platform.</p>
          <div className={styles.bottomMeta}>
            <span>Awadh &amp; Gangetic Basin Node</span>
            <span>·</span>
            <span>Zero Commercial Tracking</span>
            <span>·</span>
            <span>Public Safety Open Source</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
