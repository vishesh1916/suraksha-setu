'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { translations, getSavedLanguage, type Language } from '@/lib/i18n';
import styles from './track.module.css';

interface ActionLogItem {
  id: string;
  action: string;
  actorName: string;
  notes?: string;
  timestamp: string;
}

interface TrackingData {
  id: string;
  status: string;
  verificationStatus?: string;
  verificationRationale?: string;
  firstActionTaken?: string;
  currentActionCategory?: string;
  actionHistory?: ActionLogItem[];
  stage: number;
  stages: Array<{
    name: string;
    completed: boolean;
    timestamp?: string;
  }>;
  category: string;
  severity: number;
  description?: string;
  landmark?: string;
  waterDepthFeet?: number;
  createdAt?: string;
  updatedAt?: string;
  corroborationCount: number;
  weatherSignal: string;
  reviewNote: string;
}

function TrackContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id') || '';

  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== 'undefined') return getSavedLanguage();
    return 'en';
  });
  const [reportIdInput, setReportIdInput] = useState(initialId);
  const [activeTrackId, setActiveTrackId] = useState(initialId);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(initialId));

  useEffect(() => {
    const onLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail) setLang(customEvent.detail);
    };
    window.addEventListener('languagechange', onLangChange);
    return () => window.removeEventListener('languagechange', onLangChange);
  }, []);

  const t = translations[lang].track;

  const performTracking = useCallback(async (idToTrack: string, isSilent = false) => {
    if (!idToTrack.trim()) return;
    if (!isSilent) setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/reports/track?id=${encodeURIComponent(idToTrack.trim())}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTracking(json.data);
      } else {
        setTracking(null);
      }
    } catch {
      setTracking(null);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Fetch on mount or when activeTrackId changes
  useEffect(() => {
    if (activeTrackId) {
      performTracking(activeTrackId);
    }
  }, [activeTrackId, performTracking]);

  // Live polling every 3s to keep complainer side in sync with admin actions
  useEffect(() => {
    if (!activeTrackId) return;
    const interval = setInterval(() => {
      performTracking(activeTrackId, true);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTrackId, performTracking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = reportIdInput.trim();
    if (cleanId) {
      setActiveTrackId(cleanId);
      performTracking(cleanId);
    }
  };

  const getActionBanner = () => {
    if (!tracking) return null;
    const cat = tracking.currentActionCategory;

    if (cat === 'Evacuation Ordered') {
      return (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #EF4444',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <span style={{ fontSize: '2rem' }}>🚨</span>
          <div>
            <strong style={{ color: '#EF4444', fontSize: '1rem', display: 'block' }}>
              MANDATORY EVACUATION ORDERED BY CIVIL AUTHORITIES
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#FEE2E2' }}>
              Emergency responders have issued an immediate high-ground evacuation directive for this sector. Follow civil defense instructions and avoid all low-lying transit routes.
            </p>
          </div>
        </div>
      );
    }

    if (cat === 'Dewatering & Municipal Crew Dispatched') {
      return (
        <div style={{
          background: 'rgba(56, 189, 248, 0.15)',
          border: '1px solid #38BDF8',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <span style={{ fontSize: '2rem' }}>🚒</span>
          <div>
            <strong style={{ color: '#38BDF8', fontSize: '1rem', display: 'block' }}>
              MUNICIPAL DEWATERING CREW & PUMPS MOBILIZED
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#E0F2FE' }}>
              High-volume dewatering pumps and municipal engineering units are on-site actively clearing waterlogged roads and establishing traffic barricades.
            </p>
          </div>
        </div>
      );
    }

    if (cat === 'Public Warning Issued (CAP 1.2)') {
      return (
        <div style={{
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid #F59E0B',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <span style={{ fontSize: '2rem' }}>📢</span>
          <div>
            <strong style={{ color: '#F59E0B', fontSize: '1rem', display: 'block' }}>
              PUBLIC CAP 1.2 EMERGENCY BROADCAST ACTIVE
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#FEF3C7' }}>
              Duty meteorologists have broadcasted an official public weather hazard advisory across cellular emergency streams for this geographic zone.
            </p>
          </div>
        </div>
      );
    }

    if (cat === 'Hazard Resolved' || tracking.status === 'RESOLVED') {
      return (
        <div style={{
          background: 'rgba(52, 211, 153, 0.15)',
          border: '1px solid #34D399',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <span style={{ fontSize: '2rem' }}>✅</span>
          <div>
            <strong style={{ color: '#34D399', fontSize: '1rem', display: 'block' }}>
              HAZARD MITIGATED & CORRIDOR FULLY RESTORED
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#D1FAE5' }}>
              Municipal engineers and meteorologists confirm floodwaters have receded. Road dewatering is complete, electrical safety clearance issued, and normal transit restored.
            </p>
          </div>
        </div>
      );
    }

    if (tracking.verificationStatus === 'FLAGGED_FALSE_REPORT' || tracking.status === 'DISMISSED') {
      return (
        <div style={{
          background: 'rgba(148, 163, 184, 0.12)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <span style={{ fontSize: '1.8rem' }}>ℹ️</span>
          <div>
            <strong style={{ color: '#CBD5E1', fontSize: '0.95rem', display: 'block' }}>
              REPORT REVIEWED: FLAGGED AS INACCURATE / RECEDED
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
              {tracking.verificationRationale || 'Cross-checked against nearest Doppler weather radar and automatic rain gauge network. No actionable life threat detected at coordinates.'}
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleArea}>
        <div className={styles.badge}>
          <span>🔍</span> Citizen Transparency Pipeline · Live 3s Telemetry Sync
        </div>
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.subtitle}>{t.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.searchBox}>
        <input
          type="text"
          className={styles.input}
          placeholder={t.inputPlaceholder}
          value={reportIdInput}
          onChange={(e) => setReportIdInput(e.target.value)}
          id="track-id-input"
        />
        <button type="submit" className={styles.submitBtn} id="track-submit-btn">
          {t.trackBtn}
        </button>
      </form>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div className="spinner spinner-lg" />
          <p style={{ marginTop: 16, color: '#8A99A8' }}>
            Connecting to official disaster review registry…
          </p>
        </div>
      )}

      {!loading && searched && !tracking && (
        <div className="alert alert-warning" style={{ textAlign: 'center' }}>
          <span>⚠️</span> No record found for ID &ldquo;{reportIdInput}&rdquo;. Please verify your receipt identifier.
        </div>
      )}

      {!loading && tracking && (
        <div className={styles.trackingCard}>
          {/* Dynamic Emergency Action Directive Banner */}
          {getActionBanner()}

          <div className={styles.cardHeader}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: 13, color: '#8A99A8' }}>Report Tracking Record</span>
                {tracking.verificationStatus === 'VERIFIED_GENUINE' && (
                  <span style={{
                    background: 'rgba(52, 211, 153, 0.15)',
                    border: '1px solid #34D399',
                    color: '#34D399',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}>
                    ✓ Verified Genuine Hazard
                  </span>
                )}
                {tracking.verificationStatus === 'FLAGGED_FALSE_REPORT' && (
                  <span style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #EF4444',
                    color: '#EF4444',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}>
                    ✕ Flagged Inaccurate / False Alarm
                  </span>
                )}
              </div>
              <strong style={{ fontSize: 18, color: '#F7F6F2' }}>
                {tracking.landmark || `${tracking.category} Incident`} · Severity {tracking.severity}/5
              </strong>
            </div>
            <div className={styles.reportIdTag}>{tracking.id}</div>
          </div>

          {/* Timeline Stages */}
          <div className={styles.timeline}>
            {tracking.stages.map((st, idx) => (
              <div
                key={idx}
                className={`${styles.timelineNode} ${
                  st.completed ? styles.nodeCompleted : idx === tracking.stage ? styles.nodeActive : ''
                }`}
              >
                <div className={styles.nodeCircle}>
                  {st.completed ? '✓' : idx + 1}
                </div>
                <div className={styles.nodeLabel}>{st.name}</div>
              </div>
            ))}
          </div>

          {/* Details */}
          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Verification & Action Status</span>
              <span className={styles.detailValue}>
                <span className={`badge ${
                  tracking.status === 'RESOLVED' ? 'badge-success' :
                  tracking.currentActionCategory?.includes('Evacuation') ? 'badge-error' :
                  tracking.currentActionCategory?.includes('Dewatering') ? 'badge-info' : 'badge-warning'
                }`}>
                  {tracking.currentActionCategory || tracking.status}
                </span>
              </span>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Nearby Corroboration</span>
              <span className={styles.detailValue}>
                {tracking.corroborationCount} independent reports in 1.5 km
              </span>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Weather Evidence Match</span>
              <span className={styles.detailValue}>{tracking.weatherSignal}</span>
            </div>

            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Submission Timestamp</span>
              <span className={styles.detailValue}>
                {tracking.createdAt
                  ? new Date(tracking.createdAt).toLocaleString()
                  : 'Recent'}
              </span>
            </div>
          </div>

          {/* Reviewer Note */}
          <div className={styles.reviewNote}>
            <strong>Current Operational Status:</strong> {tracking.reviewNote}
          </div>

          {/* Detailed Agency Action History / Audit Trail */}
          {tracking.actionHistory && tracking.actionHistory.length > 0 && (
            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(138, 153, 168, 0.2)'
            }}>
              <h4 style={{
                margin: '0 0 12px',
                fontSize: '0.85rem',
                color: '#38BDF8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                📋 Action History & Agency Deployment Log ({tracking.actionHistory.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tracking.actionHistory.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(11, 31, 51, 0.6)',
                      border: '1px solid rgba(138, 153, 168, 0.25)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#F7F6F2' }}>
                        {item.action}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '2px' }}>
                        By: <strong style={{ color: '#E2E8F0' }}>{item.actorName}</strong>
                        {item.notes && <span style={{ marginLeft: 6, color: '#CBD5E1' }}>— {item.notes}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#8A99A8', whiteSpace: 'nowrap' }}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrackReportPage() {
  return (
    <div className={styles.page}>
      <Navbar />
      <Suspense fallback={<div className="spinner spinner-lg" />}>
        <TrackContent />
      </Suspense>
    </div>
  );
}
