'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Alert, AlertStatus } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import styles from '../staff.module.css';

import { StaffSidebar } from '@/components/StaffSidebar';
import { useAuthGuard } from '@/lib/useAuthGuard';

function AlertManagerContent() {
  const { authenticated } = useAuthGuard();
  const searchParams = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Composer state
  const [headline, setHeadline] = useState('');
  const [guidance, setGuidance] = useState('');
  const [category, setCategory] = useState<string>('FLOODING');
  const [areaDesc, setAreaDesc] = useState('Urban Basin / Corroborated H3 Cluster');
  const [severity, setSeverity] = useState(3);
  const [expiryHours, setExpiryHours] = useState(6);
  const [authorizedOfficer, setAuthorizedOfficer] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [previewCap, setPreviewCap] = useState<Alert | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.data || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    // Check for prefill query parameters from Review Queue or Admin Command Desk
    const compose = searchParams.get('compose');
    const pHeadline = searchParams.get('headline');
    const pCategory = searchParams.get('category');
    const pSeverity = searchParams.get('severity');
    const pArea = searchParams.get('area');
    const pGuidance = searchParams.get('guidance');

    if (compose === 'true' || pHeadline) {
      setShowComposer(true);
      if (pHeadline) setHeadline(decodeURIComponent(pHeadline));
      if (pCategory) setCategory(pCategory);
      if (pSeverity) setSeverity(Math.min(5, Math.max(1, Number(pSeverity))));
      if (pArea) setAreaDesc(decodeURIComponent(pArea));
      if (pGuidance) setGuidance(decodeURIComponent(pGuidance));
      setAuthorizedOfficer(true);
    }
  }, [fetchAlerts, searchParams]);

  const handleCreateAlert = async () => {
    if (!headline || !guidance) return;

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline,
          guidance,
          severity,
          expiresAt: new Date(Date.now() + expiryHours * 3600000).toISOString(),
          category,
          publishedBy: 'user_officer_1',
          source: 'District Disaster Management Authority (DDMA)',
        }),
      });

      if (res.ok) {
        setMessage('Alert draft created successfully');
        setShowComposer(false);
        setHeadline('');
        setGuidance('');
        setAuthorizedOfficer(false);
        fetchAlerts();
        setTimeout(() => setMessage(null), 3000);
      }
    } catch {
      setMessage('Failed to create alert');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', actorId: 'user_officer_1' }),
      });
      if (res.ok) {
        setMessage('Alert published to public feed and CAP stream');
        fetchAlerts();
        setTimeout(() => setMessage(null), 3000);
      }
    } catch {}
  };

  const handleExtend = async (id: string, hours: number) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend', hours, actorId: 'user_officer_1' }),
      });
      if (res.ok) {
        setMessage(`Alert validity extended by +${hours} hours`);
        fetchAlerts();
        setTimeout(() => setMessage(null), 3000);
      }
    } catch {
      setMessage('Failed to extend alert');
    }
  };

  const handleCancel = async (id: string) => {
    if (!cancelReason) return;
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: cancelReason, actorId: 'user_officer_1' }),
      });
      if (res.ok) {
        setMessage('Alert cancelled and archived');
        setCancelId(null);
        setCancelReason('');
        fetchAlerts();
        setTimeout(() => setMessage(null), 3000);
      }
    } catch {}
  };

  const statusColors: Record<AlertStatus, string> = {
    DRAFT: 'badge-warning',
    PUBLISHED: 'badge-success',
    CANCELLED: 'badge-error',
    EXPIRED: 'badge-info',
  };

  if (!authenticated) {
    return (
      <div className={styles.page} style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div className="spinner spinner-lg" />
        <p style={{ marginTop: 16, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          Verifying security clearance for Alert Operations…
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <StaffSidebar activeTab="alerts" role="Officer" />
      <main className={styles.main}>
        {message && (
          <div className="toast-container">
            <div className="toast glass-card" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              {message}
            </div>
          </div>
        )}

        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>🔔 Alert Manager</h1>
            <p className={styles.pageSubtitle}>Create, publish, and manage public alerts</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowComposer(!showComposer)}>
            + New Alert
          </button>
        </header>

        {/* Alert Composer */}
        {showComposer && (
          <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
            <div className={styles.adminCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className={styles.adminCardTitle}>📝 NDMA / CAP-CP 1.2 Alert Composer</h3>
                <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>CAP 1.2 Standard</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="input-group">
                    <label className="input-label">Hazard Category *</label>
                    <select
                      className="input select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {Object.entries(HAZARD_CATEGORIES).map(([key, val]) => (
                        <option key={key} value={key}>{val.icon} {val.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Affected Area / H3 Target *</label>
                    <input
                      className="input"
                      placeholder="e.g. Dadar Hindmata Basin, South Mumbai (H3: 882a10018bfffff)"
                      value={areaDesc}
                      onChange={(e) => setAreaDesc(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Alert Headline *</label>
                  <input
                    className="input"
                    placeholder="⚠️ RED WARNING: Severe Urban Flooding & Submerged Arterials"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Public Safety Guidance & Instructions *</label>
                  <textarea
                    className="input textarea"
                    placeholder="Clear, actionable instructions for citizens: avoid low-lying underpasses, remain indoors, emergency contact helpline numbers…"
                    value={guidance}
                    onChange={(e) => setGuidance(e.target.value)}
                    rows={4}
                  />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">Severity Level</label>
                    <select className="input select" value={severity} onChange={(e) => setSeverity(Number(e.target.value))}>
                      {[1,2,3,4,5].map(s => (
                        <option key={s} value={s}>{s} — {SEVERITY_LABELS[s as 1|2|3|4|5].label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">Initial Validity (Hours)</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={72}
                      value={expiryHours}
                      onChange={(e) => setExpiryHours(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Human Officer Authorization Requirement */}
                <div style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '6px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <input
                    type="checkbox"
                    id="officer-auth-check"
                    checked={authorizedOfficer}
                    onChange={(e) => setAuthorizedOfficer(e.target.checked)}
                    style={{ marginTop: '3px', cursor: 'pointer' }}
                  />
                  <label htmlFor="officer-auth-check" style={{ fontSize: '0.82rem', color: '#E2E8F0', cursor: 'pointer' }}>
                    <strong>Mandatory Human Authorization Sign-Off:</strong> I confirm as authorized Disaster-Response Officer that this alert meets CAP 1.2 accuracy criteria, is based on reviewed incident ground evidence, and is approved for public broadcast.
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" onClick={() => setShowComposer(false)}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleCreateAlert}
                    disabled={!headline || !guidance || !authorizedOfficer}
                  >
                    Draft & Stage Alert
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CAP Preview Modal */}
        {previewCap && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: '#0B1F33',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              maxWidth: '750px',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#F7F6F2' }}>📜 CAP 1.2 XML / JSON Preview</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setPreviewCap(null)}>✕ Close</button>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#8A99A8', marginBottom: '14px' }}>
                OASIS Common Alerting Protocol 1.2 payload for NDMA / IMD integration. Human authorized: <strong>{previewCap.publishedBy || 'Pending'}</strong>
              </p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <a
                  href={`/api/alerts/cap?id=${previewCap.id}&format=xml`}
                  target="_blank"
                  download
                  className="btn btn-primary btn-sm"
                >
                  📥 Download CAP 1.2 XML
                </a>
                <a
                  href={`/api/alerts/cap?id=${previewCap.id}&format=json`}
                  target="_blank"
                  download
                  className="btn btn-ghost btn-sm"
                >
                  📥 Download CAP JSON
                </a>
              </div>
              <pre style={{
                background: '#050D15',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                color: '#38BDF8',
                overflowX: 'auto',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                {`<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${previewCap.id}</identifier>
  <sender>ndma.gov.in/suraksha-setu</sender>
  <sent>${previewCap.createdAt}</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Met</category>
    <event>${HAZARD_CATEGORIES[previewCap.category]?.label || 'Weather Hazard'}</event>
    <urgency>${previewCap.severity >= 4 ? 'Immediate' : 'Expected'}</urgency>
    <severity>${previewCap.severity >= 4 ? 'Extreme' : previewCap.severity >= 3 ? 'Severe' : 'Moderate'}</severity>
    <certainty>Observed</certainty>
    <headline>${previewCap.headline}</headline>
    <description>${previewCap.guidance}</description>
    <instruction>Evacuate low lying areas and follow official advisories.</instruction>
    <expires>${previewCap.expiresAt}</expires>
    <parameter>
      <valueName>HumanAuthorizationSignoff</valueName>
      <value>Verified by ${previewCap.publishedBy || 'District Disaster Officer'}</value>
    </parameter>
  </info>
</alert>`}
              </pre>
            </div>
          </div>
        )}

        {/* Alerts List */}
        <div className={styles.alertManagerGrid}>
          {loading ? (
            <div className={styles.loadingState}><div className="spinner spinner-lg" /></div>
          ) : alerts.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🔔</span>
              <p>No alerts created yet</p>
            </div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className={styles.alertManagerCard}>
                <div className={styles.alertManagerInfo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span className={`badge ${statusColors[alert.status]}`}>{alert.status}</span>
                    <span className={styles.alertManagerTitle}>{alert.headline}</span>
                  </div>
                  <div className={styles.alertManagerMeta}>
                    <span>{HAZARD_CATEGORIES[alert.category]?.icon} {HAZARD_CATEGORIES[alert.category]?.label}</span>
                    <span>Severity: {alert.severity}</span>
                    <span>Expires: {new Date(alert.expiresAt).toLocaleString()}</span>
                    <span>Source: {alert.source}</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: '6px' }}>{alert.guidance}</p>
                </div>

                <div className={styles.alertManagerActions} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  {/* CAP Preview Button */}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPreviewCap(alert)}
                    title="Inspect CAP 1.2 XML / JSON payload"
                  >
                    📄 CAP Preview
                  </button>

                  <a
                    href={`/api/alerts/cap?id=${alert.id}&format=xml`}
                    target="_blank"
                    download
                    className="btn btn-ghost btn-sm"
                    title="Download CAP 1.2 XML file"
                  >
                    XML
                  </a>

                  {alert.status === 'DRAFT' && (
                    <button className="btn btn-primary btn-sm" onClick={() => handlePublish(alert.id)}>
                      📢 Publish Alert
                    </button>
                  )}

                  {alert.status === 'PUBLISHED' && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleExtend(alert.id, 3)}
                        title="Extend expiry by 3 hours"
                        style={{ color: '#38BDF8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
                      >
                        +3h Extend
                      </button>

                      {cancelId === alert.id ? (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                          <input
                            className="input"
                            placeholder="Reason for cancellation…"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            style={{ minWidth: 180, minHeight: 34, fontSize: '0.8rem' }}
                          />
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancel(alert.id)} disabled={!cancelReason}>
                            Confirm Cancel
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setCancelId(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="btn btn-danger btn-sm" onClick={() => setCancelId(alert.id)}>
                          Cancel Alert
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default function AlertManagerPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0B1F33', color: '#8A99A8' }}>
        <div className="spinner spinner-lg" />
      </div>
    }>
      <AlertManagerContent />
    </Suspense>
  );
}
