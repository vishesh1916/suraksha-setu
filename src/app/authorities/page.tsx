'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import type { Report } from '@/types';
import { HAZARD_CATEGORIES } from '@/types';
import styles from './authorities.module.css';

export default function AuthoritiesPortalPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIncidents() {
      try {
        const res = await fetch(`/api/reports?limit=8&_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          setReports(json.data || []);
        }
      } catch (err) {
        console.error('Failed to load incident stream:', err);
      } finally {
        setLoading(false);
      }
    }
    loadIncidents();
    const interval = setInterval(loadIncidents, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.container}>
        {/* Header Strip */}
        <div className={styles.header}>
          <div className={styles.badgeRow}>
            <span className={styles.kicker}>OPERATIONAL COMMAND POST</span>
            <span className={styles.protocolBadge}>CAP 1.2 PROTOCOL</span>
            <span className={styles.stationBadge}>IMD / NDMA INTERFACE</span>
          </div>
          <h1 className={styles.title}>Incident Verification &amp; Tactical Dispatch</h1>
          <p className={styles.subtitle}>
            A unified public-safety console bridging multi-radar Doppler surveillance with verified citizen hazard observations across Indian urban corridors.
          </p>
        </div>

        {/* Tactical Status Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>DOPPLER STATIONS</span>
            <span className={styles.statValue}>45 / 45</span>
            <span className={styles.statMeta}>National S-Band Radar Grid Nominal</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>PENDING TRIAGE</span>
            <span className={styles.statValue}>
              {reports.filter(r => !r.verificationStatus || r.verificationStatus === 'PENDING_VERIFICATION').length}
            </span>
            <span className={styles.statMeta}>Reports Requiring Human Sign-off</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>VERIFIED ACTIVE</span>
            <span className={styles.statValue}>
              {reports.filter(r => r.verificationStatus === 'VERIFIED_GENUINE').length}
            </span>
            <span className={styles.statMeta}>Escalated to Emergency Operations</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>DISPATCH AVERAGE</span>
            <span className={styles.statValue}>2.8 min</span>
            <span className={styles.statMeta}>Median Triage to CAP Broadcast</span>
          </div>
        </div>

        {/* Main Operational Split: Incidents & System Health */}
        <div className={styles.operationalGrid}>
          {/* Left Column: Live Incident Queue */}
          <div className={styles.incidentsSection}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Incoming Ground Incidents</h2>
                <span className={styles.sectionSubtitle}>Real-time citizen submissions awaiting municipal directive</span>
              </div>
              <div className={styles.sectionActions}>
                <Link href="/staff/admin" className={styles.primaryActionBtn}>
                  Open Command Registry →
                </Link>
                <Link href="/staff/queue" className={styles.secondaryActionBtn}>
                  Duty Queue
                </Link>
              </div>
            </div>

            <div className={styles.incidentsList}>
              {loading ? (
                <div className={styles.loadingPlaceholder}>Synchronizing with dispatch network…</div>
              ) : reports.length === 0 ? (
                <div className={styles.emptyCard}>
                  <span style={{ fontSize: 24 }}>🛡️</span>
                  <div>
                    <strong>Incident Queue Cleared</strong>
                    <p>No active unaddressed citizen reports in the triage pipeline at this hour.</p>
                  </div>
                </div>
              ) : (
                reports.map((r) => {
                  const hazard = HAZARD_CATEGORIES[r.category];
                  const isVerified = r.verificationStatus === 'VERIFIED_GENUINE';
                  const isDismissed = r.status === 'DISMISSED' || r.verificationStatus === 'FLAGGED_FALSE_REPORT';

                  return (
                    <div key={r.id} className={styles.incidentRow}>
                      <div className={styles.incidentHeader}>
                        <div className={styles.hazardMeta}>
                          <span className={styles.hazardCategory}>{hazard?.label || r.category}</span>
                          <span className={styles.hazardSeverity}>Level {r.severity}</span>
                          <span className={styles.hazardCoords}>
                            {r.location.latitude.toFixed(3)}°N, {r.location.longitude.toFixed(3)}°E
                          </span>
                        </div>
                        <span
                          className={`${styles.statusChip} ${
                            isVerified
                              ? styles.statusVerified
                              : isDismissed
                              ? styles.statusDismissed
                              : styles.statusPending
                          }`}
                        >
                          {isVerified
                            ? 'Verified Genuine'
                            : isDismissed
                            ? 'Dismissed / False'
                            : 'Pending Triage'}
                        </span>
                      </div>

                      <p className={styles.incidentDesc}>{r.description || 'Hazard reported by citizen via mobile GPS telemetry.'}</p>

                      <div className={styles.incidentFooter}>
                        <span className={styles.incidentLandmark}>📍 {r.landmark || 'Designated Zone'}</span>
                        <div className={styles.incidentActions}>
                          <Link href={`/map?lat=${r.location.latitude}&lng=${r.location.longitude}&highlight=${r.id}`} className={styles.inspectMapLink}>
                            Locate on Map ↗
                          </Link>
                          <Link href="/staff/admin" className={styles.takeActionLink}>
                            Take Action →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Source Health & Verification Standards */}
          <div className={styles.sidebarSection}>
            {/* Telemetry Sensor Grid Health */}
            <div className={styles.cardPanel}>
              <h3 className={styles.panelTitle}>Multi-Source Telemetry Grid</h3>
              <div className={styles.telemetryList}>
                <div className={styles.telemetryItem}>
                  <div className={styles.telemetryHeader}>
                    <span className={styles.telemetryName}>IMD Doppler Radar S-Band</span>
                    <span className={styles.telemetryStatusNominal}>Nominal</span>
                  </div>
                  <div className={styles.telemetrySub}>45 Stations Active · 2.85 GHz · Sweep 0.5° Elevation</div>
                </div>

                <div className={styles.telemetryItem}>
                  <div className={styles.telemetryHeader}>
                    <span className={styles.telemetryName}>Automatic Weather Stations (AWS)</span>
                    <span className={styles.telemetryStatusNominal}>99.4% Up</span>
                  </div>
                  <div className={styles.telemetrySub}>Precipitation gauges, wind anemometers, barometric sensors</div>
                </div>

                <div className={styles.telemetryItem}>
                  <div className={styles.telemetryHeader}>
                    <span className={styles.telemetryName}>ISRO INSAT-3DR Geostationary</span>
                    <span className={styles.telemetryStatusNominal}>Synced</span>
                  </div>
                  <div className={styles.telemetrySub}>Thermal infrared cloud-top brightness temperature tracking</div>
                </div>

                <div className={styles.telemetryItem}>
                  <div className={styles.telemetryHeader}>
                    <span className={styles.telemetryName}>Citizen Ground Telemetry Ingest</span>
                    <span className={styles.telemetryStatusNominal}>Active</span>
                  </div>
                  <div className={styles.telemetrySub}>GPS positioning, compressed evidence photos, offline queue</div>
                </div>
              </div>
            </div>

            {/* Verification Protocol Guidelines */}
            <div className={styles.cardPanel}>
              <h3 className={styles.panelTitle}>Standard Operating Protocols</h3>
              <ul className={styles.protocolList}>
                <li>
                  <strong>Human-in-the-Loop Requirement:</strong> No alert Level 3+ may be published without certified duty reviewer authorization.
                </li>
                <li>
                  <strong>Doppler Cross-Correlation:</strong> Waterlogging reports must correlate with radar reflectivity &gt;35 dBZ or local rain gauge &gt;25 mm/h.
                </li>
                <li>
                  <strong>Geo-Fenced CAP Broadcasting:</strong> Warnings broadcast exclusively to affected Uber H3 hexagonal resolution cells.
                </li>
                <li>
                  <strong>Immediate Agency Escalation:</strong> Rapid routing to municipal dewatering, NDRF, SDRF, and civil defence command.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
