'use client';

import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import styles from './safety.module.css';

export default function SafetyPage() {
  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.container}>
        <div className={styles.titleArea}>
          <div className={styles.badge}>
            <span>🛡️</span> Disaster Preparedness Protocol
          </div>
          <h1 className={styles.pageTitle}>Hyperlocal Safety & Action Guidelines</h1>
          <p className={styles.pageDesc}>
            Standard operating procedures and precautionary protocols for intense rainfall, urban flash flooding, and severe convective thunderstorms across India.
          </p>
        </div>

        {/* Hazard 1: Intense Rainfall & Urban Flooding */}
        <section className={styles.hazardSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>🌊</span>
            <h2 className={styles.sectionHeading}>Intense Rainfall & Urban Flooding</h2>
          </div>

          <div className={styles.cardsGrid}>
            <div className={styles.guidelineCard}>
              <div className={`${styles.cardCategory} ${styles.catBefore}`}>
                <span>⚠️</span> Before Flood Event
              </div>
              <h3 className={styles.cardHeading}>Pre-Storm Readiness</h3>
              <ul className={styles.cardList}>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Clear external drains, rain gutters, and check municipal pumps nearby.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Keep vital documents, medicines, and torches in waterproof zip bags.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Elevate ground-floor electrical appliances and inverter batteries.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Check the Suraksha Setu Alert Map for real-time corridor inundation warnings.
                </li>
              </ul>
            </div>

            <div className={styles.guidelineCard}>
              <div className={`${styles.cardCategory} ${styles.catDuring}`}>
                <span>🚨</span> During Waterlogging
              </div>
              <h3 className={styles.cardHeading}>Immediate Protection</h3>
              <ul className={styles.cardList}>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  <strong>Never walk or drive through flowing water.</strong> 15 cm of moving water can knock an adult over.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Stay clear of submerged metro stations, railway underpasses, and culverts.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Turn off mains electrical breaker if water enters your house or office.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  If trapped in a vehicle in rising water, unbuckle and escape via windows immediately.
                </li>
              </ul>
            </div>

            <div className={styles.guidelineCard}>
              <div className={`${styles.cardCategory} ${styles.catAfter}`}>
                <span>📋</span> After Water Recedes
              </div>
              <h3 className={styles.cardHeading}>Recovery & Inspection</h3>
              <ul className={styles.cardList}>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Watch out for open manholes and damaged electrical cables on roadways.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Do not consume tap water until municipal advisory confirms potability; boil all drinking water.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Photograph local water marks and submit a damage/drain report to the platform.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Hazard 2: Severe Thunderstorm & Lightning */}
        <section className={styles.hazardSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>⚡</span>
            <h2 className={styles.sectionHeading}>Severe Thunderstorms & Lightning Strikes</h2>
          </div>

          <div className={styles.cardsGrid}>
            <div className={styles.guidelineCard}>
              <div className={`${styles.cardCategory} ${styles.catBefore}`}>
                <span>⚠️</span> Early Warnings
              </div>
              <h3 className={styles.cardHeading}>Precautionary Steps</h3>
              <ul className={styles.cardList}>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Secure loose tin roofing, rooftop antennas, solar panels, and construction scaffolding.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Charge all communication devices and emergency power banks.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Trim unstable tree branches near overhead power lines.
                </li>
              </ul>
            </div>

            <div className={styles.guidelineCard}>
              <div className={`${styles.cardCategory} ${styles.catDuring}`}>
                <span>⚡</span> During Peak Storm
              </div>
              <h3 className={styles.cardHeading}>Lightning Safety: 30-30 Rule</h3>
              <ul className={styles.cardList}>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Seek shelter inside an enclosed building or all-metal hardtop vehicle.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  <strong>Avoid solitary tall trees, metal fences, and utility poles.</strong>
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Unplug non-essential electronic appliances to prevent power surge damage.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Avoid plumbing fixtures and bathing during active cloud-to-ground strikes.
                </li>
              </ul>
            </div>

            <div className={styles.guidelineCard}>
              <div className={`${styles.cardCategory} ${styles.catAfter}`}>
                <span>🩺</span> First Aid & Reporting
              </div>
              <h3 className={styles.cardHeading}>Post-Incident Protocol</h3>
              <ul className={styles.cardList}>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Lightning victims carry NO electrical charge; administer CPR immediately if breathing stops.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Call 108 or 112 for rapid trauma ambulance dispatch.
                </li>
                <li className={styles.cardListItem}>
                  <span className={styles.checkIcon}>✓</span>
                  Submit verified strike coordinates on the Suraksha Setu reporting console.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Emergency Callout Banner */}
        <div className={styles.emergencyBanner}>
          <div className={styles.bannerText}>
            <h3>Need Emergency Assistance Right Now?</h3>
            <p>For trapped civilians, medical collapse, or flash flood evacuation, immediately connect to national dispatch.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="tel:112" className="btn btn-primary btn-lg">
              📞 Dial 112
            </a>
            <Link href="/report" className="btn btn-secondary btn-lg">
              📝 Log Hazard Report
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
