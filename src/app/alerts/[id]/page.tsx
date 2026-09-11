'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import type { Alert } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import styles from './alert.module.css';

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadAlert() {
      try {
        const res = await fetch(`/api/alerts/${resolvedParams.id}`);
        if (!res.ok) {
          throw new Error('Alert not found');
        }
        const json = await res.json();
        setAlert(json.data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load alert';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    loadAlert();
  }, [resolvedParams.id]);

  const copyShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <div className="spinner spinner-lg" />
            <p style={{ marginTop: 16 }}>Loading alert verification data…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Link href="/map" className={styles.backLink}>← Back to Map</Link>
          <div className={styles.alertCard} style={{ padding: 40, textAlign: 'center' }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>⚠️</span>
            <h2>Alert Not Found or Expired</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 8, marginBottom: 24 }}>
              This alert may have been resolved, cancelled, or the link is invalid.
            </p>
            <Link href="/map" className="btn btn-primary">
              View Active Alerts on Map
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const severityInfo = SEVERITY_LABELS[alert.severity];
  const hazardInfo = HAZARD_CATEGORIES[alert.category];
  const expiresIn = Math.max(0, Math.round((new Date(alert.expiresAt).getTime() - Date.now()) / 60000));
  const isExpired = expiresIn === 0;

  const getBannerClass = () => {
    switch (alert.severity) {
      case 5:
      case 4:
        return styles.bannerCritical;
      case 3:
        return styles.bannerHigh;
      case 2:
        return styles.bannerModerate;
      default:
        return styles.bannerLow;
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.headerLeft}>
          <span className={styles.logo}>🛡️</span>
          <span className={styles.logoText}>SURAKSHA SETU</span>
          <span style={{ fontSize: 11, color: '#8A99A8', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: 10, marginLeft: 6 }}>
            सुरक्षा सेतु
          </span>
        </Link>
        <nav className={styles.headerNav}>
          <Link href="/" className={styles.navLink}>Home</Link>
          <Link href="/map" className={styles.navLink}>Live Map</Link>
          <Link href="/report" className={styles.navLink}>Report Hazard</Link>
          <Link href="/safety" className={styles.navLink}>Safety</Link>
          <Link href="/login" className={styles.navLink}>For Authorities</Link>
        </nav>
      </header>

      <div className={styles.container}>
        <Link href="/map" className={styles.backLink}>
          <span>←</span> Back to Public Map
        </Link>

        <div className={`${styles.alertCard} ${getBannerClass()}`}>
          <div className={styles.cardHeader}>
            <div className={styles.tagGroup}>
              <span className={styles.hazardBadge}>
                {hazardInfo.icon} {hazardInfo.label}
              </span>
              <span className={`badge badge-${alert.severity >= 4 ? 'critical' : alert.severity >= 3 ? 'high' : 'moderate'}`}>
                {severityInfo.label}
              </span>
              {!isExpired && alert.status === 'PUBLISHED' && (
                <span className={styles.statusLive}>
                  <span className={styles.livePulse} />
                  LIVE ALERT
                </span>
              )}
            </div>

            <div className={styles.timeInfo}>
              {!isExpired ? (
                <span>⏱ Valid for next {expiresIn > 60 ? `${Math.round(expiresIn / 60)}h ${expiresIn % 60}m` : `${expiresIn}m`}</span>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>Status: Expired / Resolved</span>
              )}
            </div>
          </div>

          <div className={styles.cardBody}>
            <h1 className={styles.headline}>{alert.headline}</h1>

            <div className={styles.sourceRow}>
              <span>Issued by:</span>
              <span className={styles.sourceBadge}>🏛️ {alert.source}</span>
              <span>•</span>
              <span>Published: {new Date(alert.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span>•</span>
              <span>Expires: {new Date(alert.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div className={styles.sectionTitle}>
              <span>📢</span> Official Public Guidance
            </div>
            <div className={styles.guidanceText}>
              {alert.guidance}
            </div>

            <div className={styles.geoSection}>
              <div className={styles.sectionTitle}>
                <span>📍</span> Affected Geography
              </div>
              <div className={styles.geoGrid}>
                <div className={styles.geoCard}>
                  <span className={styles.geoLabel}>Area / Sector</span>
                  <span className={styles.geoValue}>{alert.areaName || 'Pilot Zone Corridor'}</span>
                </div>
                <div className={styles.geoCard}>
                  <span className={styles.geoLabel}>Spatial Index (H3)</span>
                  <span className={styles.geoValue} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                    {alert.h3Index || '8860a25997fffff'}
                  </span>
                </div>
                <div className={styles.geoCard}>
                  <span className={styles.geoLabel}>Corroborating Reports</span>
                  <span className={styles.geoValue}>{alert.reportCount || 'Verified Cluster'} reports</span>
                </div>
              </div>

              <div className={styles.mapPreview}>
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🗺️</span>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                    Interactive polygon preview rendered on primary map
                  </p>
                  <Link href={`/map?focus=${alert.id}`} className={`btn btn-secondary btn-sm ${styles.mapOverlayBtn}`}>
                    View on Full Interactive Map →
                  </Link>
                </div>
              </div>
            </div>

            <div className={styles.actionsBar}>
              <button className="btn btn-secondary" onClick={copyShareLink}>
                {copied ? '✅ Link Copied!' : '🔗 Share Alert Link'}
              </button>
              <Link href="/report" className="btn btn-primary">
                🚨 Report Observed Conditions in this Area
              </Link>
            </div>

            <div className={styles.footerNotice}>
              <strong>⚠️ Official Alert Notice:</strong> This public advisory has been human-verified by authorized duty officers. In situations involving immediate danger to life or property, bypass this app and dial emergency responders at <strong>112</strong> immediately.
            </div>
          </div>
        </div>

        {/* Emergency Contacts Grid */}
        <section className={styles.emergencySection}>
          <div className={styles.sectionTitle}>
            <span>🆘</span> Direct Emergency Assistance Lines
          </div>
          <div className={styles.emergencyGrid}>
            <a href="tel:112" className={styles.emergencyCard}>
              <span className={styles.emergencyIcon}>🚨</span>
              <div>
                <span className={styles.emergencyName}>National Emergency Helpline</span>
                <span className={styles.emergencyNumber}>112</span>
              </div>
            </a>
            <a href="tel:1077" className={styles.emergencyCard}>
              <span className={styles.emergencyIcon}>🌊</span>
              <div>
                <span className={styles.emergencyName}>Disaster Management Control</span>
                <span className={styles.emergencyNumber}>1077</span>
              </div>
            </a>
            <a href="tel:108" className={styles.emergencyCard}>
              <span className={styles.emergencyIcon}>🚑</span>
              <div>
                <span className={styles.emergencyName}>Emergency Medical / Ambulance</span>
                <span className={styles.emergencyNumber}>108</span>
              </div>
            </a>
            <a href="tel:101" className={styles.emergencyCard}>
              <span className={styles.emergencyIcon}>🚒</span>
              <div>
                <span className={styles.emergencyName}>Fire & Rescue Services</span>
                <span className={styles.emergencyNumber}>101</span>
              </div>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
