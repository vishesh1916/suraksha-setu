'use client';

import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import styles from './about.module.css';

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.container}>
        {/* Header Story */}
        <section className={styles.heroSection}>
          <div className={styles.kicker}>INSTITUTIONAL ARCHITECTURE &amp; MISSION</div>
          <h1 className={styles.headline}>
            Weather clarity.<br />
            <span className={styles.headlineSub}>Engineered for 1.4 billion citizens.</span>
          </h1>
          <p className={styles.leadText}>
            Suraksha Setu (सुरक्षा सेतु) was created to bridge a critical operational gap in Indian disaster resilience: 
            the vital minutes between a sudden urban waterlogging cloudburst on the ground and official early warning broadcasts.
          </p>
        </section>

        {/* The Challenge & Core Thesis */}
        <section className={styles.storySection}>
          <div className={styles.twoCol}>
            <div className={styles.storyCol}>
              <h2 className={styles.sectionHeading}>The Urban Climate Challenge</h2>
              <p className={styles.bodyText}>
                During monsoon and squall seasons across Indian cities—from Lucknow&apos;s Gomti basin to Mumbai&apos;s low-lying rail corridors—microbursts and severe waterlogging occur in isolated 500-metre pockets.
              </p>
              <p className={styles.bodyText}>
                While space-borne geostationary satellites provide macro-scale regional views, urban drainage blockages, underpass inundations, and fallen high-voltage cables develop faster than traditional forecast dissemination cycles.
              </p>
            </div>
            <div className={styles.storyCol}>
              <h2 className={styles.sectionHeading}>Our Technical Solution</h2>
              <p className={styles.bodyText}>
                Suraksha Setu establishes a verified bilateral intelligence loop: citizens provide street-level observations with verified GPS coordinates and lightweight evidence imagery, which are instantly cross-correlated with dual-polarization Doppler weather radar echoes.
              </p>
              <p className={styles.bodyText}>
                Duty officers at Emergency Operations Centres inspect corroborating radar reflectivity before publishing geo-fenced CAP 1.2 advisories to affected neighborhood H3 cells.
              </p>
            </div>
          </div>
        </section>

        {/* 4 Pillars Grid */}
        <section className={styles.pillarsSection}>
          <div className={styles.sectionTag}>FOUR CORNERSTONES OF SURAKSHA SETU</div>
          <div className={styles.pillarsGrid}>
            <div className={styles.pillarCard}>
              <span className={styles.pillarNum}>01</span>
              <h3 className={styles.pillarTitle}>Doppler Radar Telemetry</h3>
              <p className={styles.pillarDesc}>
                Direct integration with 45 IMD Doppler weather radar stations across 28 states and 8 Union Territories. Analyzing reflectivity (dBZ), radial velocity, and rain accumulation in real time.
              </p>
            </div>

            <div className={styles.pillarCard}>
              <span className={styles.pillarNum}>02</span>
              <h3 className={styles.pillarTitle}>Low-Bandwidth Citizen Ingestion</h3>
              <p className={styles.pillarDesc}>
                Engineered for real-world conditions with poor cellular connectivity. Offline IndexedDB buffering, sub-150KB client-side image compression, and one-tap GPS coordinate capture.
              </p>
            </div>

            <div className={styles.pillarCard}>
              <span className={styles.pillarNum}>03</span>
              <h3 className={styles.pillarTitle}>Certified Human Verification</h3>
              <p className={styles.pillarDesc}>
                Zero automated panic broadcasting. Every Level 3+ public warning is verified and signed by certified municipal authorities and meteorologists with full audit traceability.
              </p>
            </div>

            <div className={styles.pillarCard}>
              <span className={styles.pillarNum}>04</span>
              <h3 className={styles.pillarTitle}>CAP 1.2 Geo-Fenced Alerts</h3>
              <p className={styles.pillarDesc}>
                Conforming to the ITU / NDMA Common Alerting Protocol. Publishing localized warnings strictly to the affected Uber H3 hexagonal cells without alarming uninvolved districts.
              </p>
            </div>
          </div>
        </section>

        {/* Technical Architecture Specs */}
        <section className={styles.specsSection}>
          <h2 className={styles.sectionHeading}>Platform Specifications</h2>
          <div className={styles.specsTable}>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Spatial Indexing Engine</span>
              <span className={styles.specVal}>Uber H3 Discrete Global Grid System (Resolution 8, ~460m cell edge)</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Cartographic Engine</span>
              <span className={styles.specVal}>MapLibre GL Vector &amp; Raster Pipeline with Carto Positron / Voyager</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Standard Alerting Protocol</span>
              <span className={styles.specVal}>OASIS / ITU-T Common Alerting Protocol (CAP 1.2 XML &amp; JSON)</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Radar Frequencies</span>
              <span className={styles.specVal}>S-band (2.7 – 2.9 GHz) and C-band (5.6 GHz) Dual-Polarization</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Privacy &amp; Telemetry Policy</span>
              <span className={styles.specVal}>Zero commercial ad tracking. Anonymized contributor session tokens only.</span>
            </div>
          </div>
        </section>

        {/* Institutional Commitment Callout */}
        <section className={styles.commitmentBanner}>
          <div className={styles.commitmentContent}>
            <h3>Dedicated to National Disaster Preparedness</h3>
            <p>
              Suraksha Setu is built for the public interest, open for civic collaboration, and designed to support emergency response crews across India.
            </p>
          </div>
          <div className={styles.commitmentActions}>
            <Link href="/map" className={styles.primaryBtn}>
              Explore Live Risk Map →
            </Link>
            <Link href="/report" className={styles.secondaryBtn}>
              Report a Hazard
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
