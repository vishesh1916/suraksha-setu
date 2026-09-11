'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import type { Alert } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import { translations, getSavedLanguage, type Language } from '@/lib/i18n';
import styles from './alerts.module.css';

export default function AlertsDirectoryPage() {
  const [lang, setLang] = useState<Language>('en');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'RAIN' | 'WIND'>('ALL');

  useEffect(() => {
    setLang(getSavedLanguage());
    const onLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail) setLang(customEvent.detail);
    };
    window.addEventListener('languagechange', onLangChange);
    return () => window.removeEventListener('languagechange', onLangChange);
  }, []);

  const t = translations[lang].alerts;

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts?status=active');
      if (res.ok) {
        const d = await res.json();
        setAlerts(d.data || []);
      }
    } catch {
      // Graceful
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 30000);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'CRITICAL') return a.severity >= 4;
    if (filter === 'RAIN') return a.category === 'WATERLOGGING' || a.category === 'SEVERE_RAIN';
    if (filter === 'WIND') return a.category === 'STRONG_WIND';
    return true;
  });

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.container}>
        <div className={styles.headerSection}>
          <div className={styles.badge}>
            <span>⚠️</span> NDMA & IMD Verified Broadcast Registry
          </div>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.filterPills}>
            <button
              type="button"
              className={`${styles.pillBtn} ${filter === 'ALL' ? styles.pillActive : ''}`}
              onClick={() => setFilter('ALL')}
            >
              {t.filterAll} ({alerts.length})
            </button>
            <button
              type="button"
              className={`${styles.pillBtn} ${filter === 'CRITICAL' ? styles.pillActive : ''}`}
              onClick={() => setFilter('CRITICAL')}
            >
              🚨 {t.filterCritical}
            </button>
            <button
              type="button"
              className={`${styles.pillBtn} ${filter === 'RAIN' ? styles.pillActive : ''}`}
              onClick={() => setFilter('RAIN')}
            >
              🌊 Flood & Waterlogging
            </button>
            <button
              type="button"
              className={`${styles.pillBtn} ${filter === 'WIND' ? styles.pillActive : ''}`}
              onClick={() => setFilter('WIND')}
            >
              ⚡ Storm & High Winds
            </button>
          </div>

          <div style={{ fontSize: 12.5, color: '#8A99A8' }}>
            Auto-refresh active · Live CAP 1.2 Feed
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div className="spinner spinner-lg" />
            <p style={{ marginTop: 16, color: '#8A99A8' }}>Loading verified alerts…</p>
          </div>
        )}

        {/* Alerts List */}
        {!loading && (
          <div className={styles.alertsGrid}>
            {filteredAlerts.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem',
                  background: 'rgba(14, 38, 62, 0.4)',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span style={{ fontSize: 36 }}>✅</span>
                <h3 style={{ color: '#F7F6F2', marginTop: 12 }}>No Active Alerts in this Category</h3>
                <p style={{ color: '#8A99A8', fontSize: 13 }}>
                  Atmospheric stability confirmed for this filter. Check the Live Map for local telemetry.
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const hazard = HAZARD_CATEGORIES[alert.category] || {
                  icon: '⚠️',
                  label: alert.category,
                };
                const sev = SEVERITY_LABELS[alert.severity] || { label: `Severity ${alert.severity}` };
                const isCritical = alert.severity >= 4;

                return (
                  <article
                    key={alert.id}
                    className={`${styles.alertCard} ${
                      isCritical ? styles.alertCardCritical : styles.alertCardHigh
                    }`}
                  >
                    <div className={styles.cardTop}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <span className={`badge ${isCritical ? 'badge-critical' : 'badge-warning'}`}>
                            {sev.label}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: '#8A99A8',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span>{hazard.icon}</span>
                            <span>{hazard.label}</span>
                          </span>
                        </div>
                        <h2 className={styles.headline}>{alert.headline}</h2>
                        <div className={styles.metaRow}>
                          <span>🏛️ Issued by: {alert.source}</span>
                          <span>•</span>
                          <span>
                            ⏳ Valid until:{' '}
                            {new Date(alert.expiresAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>•</span>
                          <span>📍 {alert.areaName || 'Designated Regional Sector'}</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.guidanceBox}>
                      <strong style={{ color: '#F59E0B', display: 'block', marginBottom: 4 }}>
                        {t.safetyInstructions}:
                      </strong>
                      {alert.guidance}
                    </div>

                    <div className={styles.cardFooter}>
                      <div className={styles.capBtnGroup}>
                        <a
                          href={`/api/alerts/cap?id=${alert.id}&format=xml`}
                          className={styles.capBtn}
                          download={`CAP-${alert.id}.xml`}
                        >
                          <span>📄</span> {t.exportCap}
                        </a>
                        <a
                          href={`/api/alerts/cap?id=${alert.id}&format=json`}
                          className={styles.capBtn}
                          download={`CAP-${alert.id}.json`}
                        >
                          <span>⚙️</span> CAP JSON
                        </a>
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <Link href={`/alerts/${alert.id}`} className={styles.capBtn}>
                          Official Advisory →
                        </Link>
                        <Link href="/map" className={styles.inspectBtn}>
                          <span>🗺️</span> Inspect on Map
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
