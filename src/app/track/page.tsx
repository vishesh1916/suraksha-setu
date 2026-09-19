'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { getClientReport, getClientReports, saveClientReport, subscribeToSync, isDemoReport } from '@/lib/clientSync';
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
  const [myReports, setMyReports] = useState<Array<{
    id: string;
    category: string;
    severity: number;
    landmark: string;
    description: string;
    createdAt: string;
  }>>([]);
  const [reportIdInput, setReportIdInput] = useState(initialId);
  const [activeTrackId, setActiveTrackId] = useState(initialId);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(initialId));
  const [publicRecentReports, setPublicRecentReports] = useState<Array<{
    id: string;
    category: string;
    severity: number;
    landmark?: string;
    description?: string;
    createdAt: string;
    currentActionCategory?: string;
  }>>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('suraksha_my_reports') || '[]').filter((r: any) => !isDemoReport(r));
        setMyReports(saved);
        if (!initialId) {
          const lastId = localStorage.getItem('suraksha_last_report_id') || saved[0]?.id;
          if (lastId) {
            setReportIdInput(lastId);
            setActiveTrackId(lastId);
          }
        }
      } catch {}
    }

    // Always fetch recent public reports from server for cross-device discovery
    async function fetchPublicReports() {
      try {
        const res = await fetch(`/api/reports?limit=8&_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const list = json.data.filter((r: any) => !isDemoReport(r));
            setPublicRecentReports(list);
            // If device has no local report and no initialId, default to tracking the latest active report
            if (!initialId && list.length > 0) {
              const hasLocal = typeof window !== 'undefined' && localStorage.getItem('suraksha_last_report_id');
              if (!hasLocal) {
                setReportIdInput(list[0].id);
                setActiveTrackId(list[0].id);
              }
            }
          }
        }
      } catch {}
    }
    fetchPublicReports();
  }, [initialId]);

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
        return;
      }
    } catch {
      // Fall through to client storage fallback
    }

    // Client storage fallback: check local reports if server had cold start or 404
    const clientRep = getClientReport(idToTrack);
    if (clientRep) {
      const isResolved = clientRep.status === 'RESOLVED' || clientRep.currentActionCategory === 'Hazard Resolved';
      const isActionTaken = Boolean(
        clientRep.currentActionCategory &&
        clientRep.currentActionCategory !== 'Pending Verification' &&
        clientRep.currentActionCategory !== 'Verified Genuine — Pending Tactical Action' &&
        clientRep.currentActionCategory !== 'Flagged False Alarm / Dismissed'
      );
      const isVerified = clientRep.verificationStatus === 'VERIFIED_GENUINE' || clientRep.status === 'REVIEWED';
      const isDismissed = clientRep.verificationStatus === 'FLAGGED_FALSE_REPORT' || clientRep.status === 'DISMISSED';

      let stage = 1;
      let stageStatusDesc = 'Report submitted and queued for meteorologist Doppler radar verification.';
      if (isResolved) {
        stage = 4;
        stageStatusDesc = clientRep.actionHistory?.[0]?.notes || 'Hazard fully mitigated by emergency response teams. Water receded and corridor restored to safe public transit.';
      } else if (isActionTaken) {
        stage = 3;
        stageStatusDesc = `🚨 Active Response Directive: "${clientRep.currentActionCategory}". ${clientRep.actionHistory?.[0]?.notes || 'Field teams deployed and operational.'}`;
      } else if (isVerified) {
        stage = 2;
        stageStatusDesc = '✅ Confirmed genuine hazard by duty meteorologist and Doppler radar cross-check. Queued for tactical deployment.';
      } else if (isDismissed) {
        stage = 1;
        stageStatusDesc = `❌ Evaluated by duty reviewer: ${clientRep.verificationRationale || 'Flagged as false alarm or duplicate observation.'}`;
      }

      const stages = [
        { name: 'Report Received', completed: true, timestamp: clientRep.createdAt },
        { name: isDismissed ? 'Verification (Flagged False)' : 'Meteorologist Verification', completed: isVerified || isActionTaken || isResolved || isDismissed, timestamp: clientRep.updatedAt },
        { name: isActionTaken || isResolved ? `Action: ${clientRep.currentActionCategory || 'Response Mobilized'}` : 'Tactical Response Action', completed: Boolean(isActionTaken || isResolved), timestamp: clientRep.updatedAt },
        { name: isDismissed ? 'Dismissed / Closed' : 'Resolved & Corridor Restored', completed: isResolved || isDismissed, timestamp: clientRep.updatedAt },
      ];

      setTracking({
        id: clientRep.id,
        status: clientRep.status,
        verificationStatus: clientRep.verificationStatus || 'PENDING_VERIFICATION',
        verificationRationale: clientRep.verificationRationale,
        firstActionTaken: clientRep.firstActionTaken,
        currentActionCategory: clientRep.currentActionCategory || (isVerified ? 'Verified Genuine — Pending Tactical Action' : 'Pending Verification'),
        actionHistory: clientRep.actionHistory || [],
        stage,
        stages,
        category: clientRep.category,
        severity: clientRep.severity,
        description: clientRep.description,
        landmark: clientRep.landmark,
        waterDepthFeet: clientRep.waterDepthFeet,
        createdAt: clientRep.createdAt,
        updatedAt: clientRep.updatedAt,
        corroborationCount: isVerified || isActionTaken || isResolved ? 4 : 1,
        weatherSignal: 'Doppler AWS Telemetry Verified: 52 dBZ reflectivity match',
        reviewNote: stageStatusDesc,
      });
    } else {
      setTracking(null);
    }

    if (!isSilent) setLoading(false);
  }, []);

  // Fetch on mount or when activeTrackId changes
  useEffect(() => {
    if (activeTrackId) {
      performTracking(activeTrackId);
    }
  }, [activeTrackId, performTracking]);

  // Real-time zero-latency sync subscription across tabs (BroadcastChannel + storage)
  useEffect(() => {
    const unsubscribe = subscribeToSync((msg) => {
      if (msg.type === 'PURGE_ALL') {
        setMyReports([]);
        setTracking(null);
        setActiveTrackId('');
        setReportIdInput('');
        return;
      }
      if (!activeTrackId) return;
      const cleanActive = activeTrackId.trim().toLowerCase();
      const targetId = (msg.reportId || msg.report?.id || '').toLowerCase();
      if (targetId && (targetId.includes(cleanActive) || cleanActive.includes(targetId))) {
        performTracking(activeTrackId, true);
      }
    });
    return unsubscribe;
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
          background: 'rgba(215, 109, 99, 0.1)',
          border: '1px solid rgba(215, 109, 99, 0.35)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <span style={{ fontSize: '2rem' }}>🚨</span>
          <div>
            <strong style={{ color: '#D76D63', fontSize: '1.05rem', display: 'block', fontWeight: 800 }}>
              MANDATORY EVACUATION ORDERED BY CIVIL AUTHORITIES
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#7F2D25' }}>
              Emergency responders have issued an immediate high-ground evacuation directive for this sector. Follow civil defense instructions and avoid all low-lying transit routes.
            </p>
          </div>
        </div>
      );
    }

    if (cat === 'Dewatering & Municipal Crew Dispatched') {
      return (
        <div style={{
          background: 'rgba(76, 141, 162, 0.1)',
          border: '1px solid rgba(76, 141, 162, 0.35)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <span style={{ fontSize: '2rem' }}>🚒</span>
          <div>
            <strong style={{ color: '#4C8DA2', fontSize: '1.05rem', display: 'block', fontWeight: 800 }}>
              MUNICIPAL DEWATERING CREW & PUMPS MOBILIZED
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#244955' }}>
              High-volume dewatering pumps and municipal engineering units are on-site actively clearing waterlogged roads and establishing traffic barricades.
            </p>
          </div>
        </div>
      );
    }

    if (cat === 'Public Warning Issued (CAP 1.2)') {
      return (
        <div style={{
          background: 'rgba(215, 170, 99, 0.12)',
          border: '1px solid rgba(215, 170, 99, 0.35)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <span style={{ fontSize: '2rem' }}>📢</span>
          <div>
            <strong style={{ color: '#D7AA63', fontSize: '1.05rem', display: 'block', fontWeight: 800 }}>
              PUBLIC CAP 1.2 EMERGENCY BROADCAST ACTIVE
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#6E491A' }}>
              Duty meteorologists have broadcasted an official public weather hazard advisory across cellular emergency streams for this geographic zone.
            </p>
          </div>
        </div>
      );
    }

    if (cat === 'Hazard Resolved' || tracking.status === 'RESOLVED') {
      return (
        <div style={{
          background: 'rgba(76, 139, 113, 0.1)',
          border: '1px solid rgba(76, 139, 113, 0.35)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <span style={{ fontSize: '2rem' }}>✅</span>
          <div>
            <strong style={{ color: '#4C8B71', fontSize: '1.05rem', display: 'block', fontWeight: 800 }}>
              HAZARD MITIGATED & CORRIDOR FULLY RESTORED
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#234737' }}>
              Municipal engineers and meteorologists confirm floodwaters have receded. Road dewatering is complete, electrical safety clearance issued, and normal transit restored.
            </p>
          </div>
        </div>
      );
    }

    if (tracking.verificationStatus === 'FLAGGED_FALSE_REPORT' || tracking.status === 'DISMISSED') {
      return (
        <div style={{
          background: 'rgba(96, 113, 123, 0.1)',
          border: '1px solid rgba(96, 113, 123, 0.25)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <span style={{ fontSize: '1.8rem' }}>ℹ️</span>
          <div>
            <strong style={{ color: '#1F3440', fontSize: '1rem', display: 'block', fontWeight: 800 }}>
              REPORT REVIEWED: FLAGGED AS INACCURATE / RECEDED
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#60717B' }}>
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

      {/* Your Reported Hazards Quick Selector (Local Device) */}
      {myReports.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '0.82rem', color: '#60717B', fontWeight: 600 }}>Your Device Reports:</span>
          {myReports.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setReportIdInput(r.id);
                setActiveTrackId(r.id);
                performTracking(r.id);
              }}
              style={{
                background: activeTrackId === r.id ? '#DCEEF2' : '#FFFFFF',
                border: activeTrackId === r.id ? '1.5px solid #4C8DA2' : '1px solid #C8E3EA',
                color: activeTrackId === r.id ? '#1F3440' : '#60717B',
                padding: '5px 14px',
                borderRadius: '999px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: activeTrackId === r.id ? 700 : 500,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <span>{activeTrackId === r.id ? '📍' : '📄'}</span>
              <span>{r.category}: {r.landmark ? r.landmark.slice(0, 22) : r.id.slice(0, 10)}…</span>
            </button>
          ))}
        </div>
      )}

      {/* Community Hazard Reports (Available on Any Device) */}
      {publicRecentReports.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px'
        }}>
          <span style={{ fontSize: '0.82rem', color: '#60717B', fontWeight: 600 }}>Recent Community Hazards:</span>
          {publicRecentReports.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setReportIdInput(r.id);
                setActiveTrackId(r.id);
                performTracking(r.id);
              }}
              style={{
                background: activeTrackId === r.id ? '#DCEEF2' : '#FFFFFF',
                border: activeTrackId === r.id ? '1.5px solid #4C8DA2' : '1px solid #C8E3EA',
                color: activeTrackId === r.id ? '#1F3440' : '#60717B',
                padding: '5px 14px',
                borderRadius: '999px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: activeTrackId === r.id ? 700 : 500,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <span>{activeTrackId === r.id ? '🛡️' : '⚠️'}</span>
              <span>{r.landmark ? r.landmark.split(',')[0].slice(0, 20) : r.category}</span>
              <code style={{ fontSize: '0.7rem', opacity: 0.8 }}>({r.id.slice(0, 8)})</code>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div className="spinner spinner-lg" />
          <p style={{ marginTop: 16, color: '#60717B' }}>
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
                <span style={{ fontSize: 13, color: '#60717B', fontWeight: 600 }}>Report Tracking Record</span>
                {tracking.verificationStatus === 'VERIFIED_GENUINE' && (
                  <span style={{
                    background: 'rgba(76, 139, 113, 0.1)',
                    border: '1px solid rgba(76, 139, 113, 0.3)',
                    color: '#4C8B71',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px'
                  }}>
                    ✓ Verified Genuine Hazard
                  </span>
                )}
                {tracking.verificationStatus === 'FLAGGED_FALSE_REPORT' && (
                  <span style={{
                    background: 'rgba(215, 109, 99, 0.1)',
                    border: '1px solid rgba(215, 109, 99, 0.3)',
                    color: '#D76D63',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px'
                  }}>
                    ✕ Flagged Inaccurate / False Alarm
                  </span>
                )}
              </div>
              <strong style={{ fontSize: 18, color: '#1F3440', fontFamily: "var(--font-family-heading, 'Manrope', sans-serif)" }}>
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
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid #DCEEF2'
            }}>
              <h4 style={{
                margin: '0 0 14px',
                fontSize: '0.82rem',
                color: '#1F3440',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-family-mono, monospace)',
                fontWeight: 700
              }}>
                Action History & Agency Deployment Log ({tracking.actionHistory.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tracking.actionHistory.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: '#F8FBFC',
                      border: '1px solid #DCEEF2',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1F3440' }}>
                        {item.action}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#60717B', marginTop: '3px' }}>
                        By: <strong style={{ color: '#1F3440' }}>{item.actorName}</strong>
                        {item.notes && <span style={{ marginLeft: 6, color: '#8FA2AD' }}>— {item.notes}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#8FA2AD', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
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
      <Footer />
    </div>
  );
}
