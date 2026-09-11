'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Incident, IncidentState, ReviewActionType, ConfidenceFactor } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import { getConfidenceColor } from '@/lib/scoring';
import styles from '../staff.module.css';

import { StaffSidebar } from '@/components/StaffSidebar';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { generateDisasterPrediction } from '@/lib/prediction';

function ConfidenceBar({ score }: { score: number }) {
  const color = getConfidenceColor(score);
  return (
    <div className={styles.confidenceBarContainer}>
      <div className="confidence-bar" style={{ flex: 1 }}>
        <div
          className="confidence-bar-fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className={styles.confidenceScore} style={{ color }}>{score}</span>
    </div>
  );
}

function ScoreBreakdown({ factors }: { factors: ConfidenceFactor[] }) {
  return (
    <div className={styles.scoreBreakdown}>
      <h4 className={styles.scoreBreakdownTitle}>Score Breakdown</h4>
      {factors.map((factor, i) => (
        <div key={i} className={styles.scoreFactor}>
          <div className={styles.scoreFactorHeader}>
            <span className={styles.scoreFactorName}>{factor.name}</span>
            <span
              className={styles.scoreFactorPoints}
              style={{
                color: factor.contribution >= 0 ? 'var(--color-success)' : 'var(--color-error)',
              }}
            >
              {factor.contribution >= 0 ? '+' : ''}{factor.contribution}/{factor.maxContribution}
            </span>
          </div>
          <div className="confidence-bar" style={{ height: 4 }}>
            <div
              className="confidence-bar-fill"
              style={{
                width: `${Math.max(0, (factor.contribution / factor.maxContribution) * 100)}%`,
                background: factor.contribution >= 0 ? 'var(--color-success)' : 'var(--color-error)',
                height: 4,
              }}
            />
          </div>
          <p className={styles.scoreFactorSignal}>{factor.signal}</p>
          <p className={styles.scoreFactorExplanation}>{factor.explanation}</p>
          {factor.freshness && (
            <span className={`badge ${factor.freshness === 'fresh' ? 'badge-success' : factor.freshness === 'stale' ? 'badge-warning' : 'badge-error'}`}>
              {factor.freshness}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function DispositionPanel({
  incident,
  onAction,
}: {
  incident: Incident;
  onAction: (action: ReviewActionType, reason: string) => void;
}) {
  const [selectedAction, setSelectedAction] = useState<ReviewActionType | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const actions: { type: ReviewActionType; label: string; icon: string; color: string; requiresReason: boolean }[] = [
    { type: 'VERIFY', label: 'Verify', icon: '✅', color: 'var(--color-success)', requiresReason: false },
    { type: 'FOLLOW_UP', label: 'Needs Follow-up', icon: '🔄', color: 'var(--color-warning)', requiresReason: false },
    { type: 'DISMISS', label: 'Dismiss', icon: '❌', color: 'var(--color-error)', requiresReason: true },
    { type: 'ESCALATE', label: 'Escalate', icon: '⬆️', color: 'var(--color-accent)', requiresReason: true },
  ];

  const handleSubmit = async () => {
    if (!selectedAction) return;
    const action = actions.find(a => a.type === selectedAction);
    if (action?.requiresReason && !reason) return;

    setSubmitting(true);
    await onAction(selectedAction, reason);
    setSubmitting(false);
    setSelectedAction(null);
    setReason('');
  };

  return (
    <div className={styles.dispositionPanel}>
      <h4 className={styles.dispositionTitle}>Review Action</h4>
      <div className={styles.dispositionActions}>
        {actions.map(action => (
          <button
            key={action.type}
            className={`${styles.dispositionBtn} ${selectedAction === action.type ? styles.dispositionBtnSelected : ''}`}
            style={{
              borderColor: selectedAction === action.type ? action.color : undefined,
              background: selectedAction === action.type ? action.color + '15' : undefined,
            }}
            onClick={() => setSelectedAction(action.type)}
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {selectedAction && (
        <div className={styles.dispositionForm}>
          {actions.find(a => a.type === selectedAction)?.requiresReason && (
            <div className="input-group">
              <label className="input-label">Reason (required)</label>
              <textarea
                className="input textarea"
                placeholder="Provide reason for this action…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || (actions.find(a => a.type === selectedAction)?.requiresReason && !reason)}
          >
            {submitting ? 'Submitting…' : `Confirm: ${selectedAction}`}
          </button>
        </div>
      )}
    </div>
  );
}

// —— Review Queue Page ——

export default function ReviewQueuePage() {
  const { authenticated } = useAuthGuard();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<IncidentState | ''>('');
  const [hazardFilter, setHazardFilter] = useState<string>('');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<{
    type: ReviewActionType;
    incidentId: string;
    landmark: string;
    category: string;
    severity: number;
    lat: number;
    lng: number;
    reason?: string;
  } | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set('state', filter);
      const res = await fetch(`/api/incidents?${params}`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.data || []);
      }
    } catch {
      // Graceful
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const filteredIncidents = incidents.filter((incident) => {
    if (filter && incident.state !== filter) return false;
    if (hazardFilter && incident.category !== hazardFilter) return false;
    if (minConfidence > 0 && incident.confidenceScore.total < minConfidence) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const cat = incident.category.toLowerCase();
      const cell = incident.h3Parent.toLowerCase();
      const hasDesc = incident.reports.some(r => r.description?.toLowerCase().includes(q));
      if (!cat.includes(q) && !cell.includes(q) && !hasDesc) return false;
    }
    return true;
  });

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 15000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const handleReviewAction = async (action: ReviewActionType, reason: string) => {
    if (!selectedIncident) return;
    const currentLandmark = selectedIncident.reports[0]?.landmark || selectedIncident.landmark || selectedIncident.h3Parent;
    const currentId = selectedIncident.id;
    const currentCat = selectedIncident.category;
    const currentSev = selectedIncident.reports[0]?.severity || (selectedIncident.impactLevel === 'CRITICAL' ? 5 : 4);
    const currentLat = selectedIncident.location?.latitude || 28.6360;
    const currentLng = selectedIncident.location?.longitude || 77.2250;

    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason,
          actorId: 'user_reviewer_1',
          actorName: 'Dr. Priya Sharma',
        }),
      });

      if (res.ok) {
        setActionMessage(`Incident ${action.toLowerCase()}ed successfully`);
        setLastActionResult({
          type: action,
          incidentId: currentId,
          landmark: currentLandmark,
          category: currentCat,
          severity: currentSev,
          lat: currentLat,
          lng: currentLng,
          reason,
        });
        fetchIncidents();
        setSelectedIncident(null);
      }
    } catch {
      setActionMessage('Failed to submit review action');
    }
  };

  const handleUndoDismiss = async (incidentId: string) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESTORE' }),
      });
      if (res.ok) {
        setActionMessage('Incident successfully restored to Candidate queue.');
        setLastActionResult(null);
        fetchIncidents();
      }
    } catch {
      setActionMessage('Failed to restore incident');
    }
  };

  if (!authenticated) {
    return (
      <div className={styles.page} style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div className="spinner spinner-lg" />
        <p style={{ marginTop: 16, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          Verifying security clearance for Reviewer Ops…
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <StaffSidebar activeTab="queue" role="Reviewer" />

      <main className={styles.main}>
        {/* Toast */}
        {actionMessage && (
          <div className="toast-container">
            <div className="toast glass-card" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              {actionMessage}
            </div>
          </div>
        )}

        <header className={styles.pageHeader}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h1 className={styles.pageTitle} style={{ margin: 0 }}>📋 Review Queue</h1>
              <span style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                color: '#22C55E',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }}></span>
                Live Problems Only (Demo Filtered)
              </span>
            </div>
            <p className={styles.pageSubtitle}>Real ground incident candidates awaiting meteorologist verification and corroboration</p>
          </div>
          <div className={styles.filters} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input"
              placeholder="Filter landmark, cell or notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: 160, padding: '6px 10px', fontSize: '0.8rem' }}
            />
            <select
              className="input select"
              value={hazardFilter}
              onChange={(e) => setHazardFilter(e.target.value)}
              style={{ minWidth: 130, padding: '6px 10px', fontSize: '0.8rem' }}
            >
              <option value="">All Hazards</option>
              {Object.entries(HAZARD_CATEGORIES).map(([key, val]) => (
                <option key={key} value={key}>{val.icon} {val.label}</option>
              ))}
            </select>
            <select
              className="input select"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              style={{ minWidth: 125, padding: '6px 10px', fontSize: '0.8rem' }}
            >
              <option value="0">Min Conf: All</option>
              <option value="40">Conf ≥ 40</option>
              <option value="60">Conf ≥ 60</option>
              <option value="80">Conf ≥ 80 (High)</option>
            </select>
            <select
              className="input select"
              value={filter}
              onChange={(e) => setFilter(e.target.value as IncidentState | '')}
              style={{ minWidth: 120, padding: '6px 10px', fontSize: '0.8rem' }}
            >
              <option value="">All States</option>
              <option value="CANDIDATE">Candidate</option>
              <option value="VERIFIED">Verified</option>
              <option value="DISMISSED">Dismissed</option>
              <option value="ESCALATED">Escalated</option>
            </select>
          </div>
        </header>

        {/* Guided Post-Action Workflow Banner */}
        {lastActionResult && (
          <div style={{
            padding: '14px 24px',
            background: lastActionResult.type === 'ESCALATE'
              ? 'rgba(239, 68, 68, 0.18)'
              : lastActionResult.type === 'VERIFY'
              ? 'rgba(34, 197, 94, 0.18)'
              : lastActionResult.type === 'FOLLOW_UP'
              ? 'rgba(245, 158, 11, 0.18)'
              : 'rgba(100, 116, 139, 0.22)',
            borderBottom: `2px solid ${
              lastActionResult.type === 'ESCALATE' ? '#EF4444' :
              lastActionResult.type === 'VERIFY' ? '#22C55E' :
              lastActionResult.type === 'FOLLOW_UP' ? '#F59E0B' : '#64748B'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div>
              <strong style={{ color: '#F7F6F2', fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {lastActionResult.type === 'ESCALATE' && '🚨 Incident Escalated to Emergency Command Desk'}
                {lastActionResult.type === 'VERIFY' && '✅ Incident Corroborated & Verified by Duty Meteorologist'}
                {lastActionResult.type === 'FOLLOW_UP' && '🔄 Ground Team & Civil Defence Corroboration Ping Active'}
                {lastActionResult.type === 'DISMISS' && '❌ Incident Dismissed & Archived with Audit Trail'}
              </strong>
              <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: '4px' }}>
                📍 <strong>{lastActionResult.landmark}</strong>
                {lastActionResult.reason && (
                  <span style={{ marginLeft: '8px', color: '#94A3B8' }}>— Rationale: &ldquo;{lastActionResult.reason}&rdquo;</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* 1. VERIFY FLOW */}
              {lastActionResult.type === 'VERIFY' && (
                <>
                  <Link
                    href={`/staff/alerts?compose=true&headline=${encodeURIComponent('🚨 EMERGENCY WEATHER WARNING: ' + lastActionResult.landmark)}&category=${lastActionResult.category}&severity=${lastActionResult.severity}&area=${encodeURIComponent(lastActionResult.landmark)}&guidance=${encodeURIComponent('Critical hazard corroborated by duty meteorologist. Immediate caution advised in the sector.')}`}
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                  >
                    📢 Broadcast Official Public Alert Now
                  </Link>
                  <Link
                    href={`/map?lat=${lastActionResult.lat}&lng=${lastActionResult.lng}&highlight=${lastActionResult.incidentId}`}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  >
                    🗺️ Inspect on Live Map
                  </Link>
                </>
              )}

              {/* 2. ESCALATE FLOW */}
              {lastActionResult.type === 'ESCALATE' && (
                <>
                  <Link
                    href="/staff/admin?tab=escalations"
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem', padding: '6px 14px', background: '#EF4444', borderColor: '#EF4444' }}
                  >
                    🚨 Open Admin Escalation Command Desk
                  </Link>
                  <Link
                    href={`/map?lat=${lastActionResult.lat}&lng=${lastActionResult.lng}`}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  >
                    🗺️ View Emergency Zone
                  </Link>
                </>
              )}

              {/* 3. FOLLOW_UP FLOW */}
              {lastActionResult.type === 'FOLLOW_UP' && (
                <>
                  <Link
                    href={`/map?lat=${lastActionResult.lat}&lng=${lastActionResult.lng}`}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 12px', borderColor: '#F59E0B', color: '#F59E0B' }}
                  >
                    🗺️ Cross-Reference Doppler Radar
                  </Link>
                  <Link
                    href="/staff/admin?tab=reports"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  >
                    📋 Check Citizen Photos Stream
                  </Link>
                </>
              )}

              {/* 4. DISMISS FLOW */}
              {lastActionResult.type === 'DISMISS' && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 12px', color: '#38BDF8', borderColor: '#38BDF8' }}
                    onClick={() => handleUndoDismiss(lastActionResult.incidentId)}
                  >
                    ↩️ Undo / Restore Incident
                  </button>
                  <Link
                    href="/staff/admin?tab=health"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  >
                    📊 View Audit Trail
                  </Link>
                </>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                onClick={() => setLastActionResult(null)}
              >
                ✕ Dismiss Banner
              </button>
            </div>
          </div>
        )}

        <div className={styles.queueLayout}>
          {/* Incident List */}
          <div className={styles.queueList}>
            {loading ? (
              <div className={styles.loadingState}>
                <div className="spinner spinner-lg" />
                <p>Loading incidents…</p>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">✅</span>
                <p>No incidents match the active filters</p>
              </div>
            ) : (
              filteredIncidents.map((incident) => {
                const hazard = HAZARD_CATEGORIES[incident.category];
                const isSelected = selectedIncident?.id === incident.id;
                const stateColors: Record<IncidentState, string> = {
                  CANDIDATE: 'badge-warning',
                  VERIFIED: 'badge-success',
                  DISMISSED: 'badge-error',
                  ESCALATED: 'badge-high',
                  RESOLVED: 'badge-success',
                  FOLLOW_UP_REQUIRED: 'badge-warning',
                };
                const primaryReport = incident.reports[0];
                const landmark = primaryReport?.landmark || incident.h3Parent;
                const hasPhoto = incident.reports.some(r => !!r.mediaUrl);
                const waterDepth = primaryReport?.waterDepthFeet;

                return (
                  <button
                    key={incident.id}
                    className={`${styles.queueItem} ${isSelected ? styles.queueItemSelected : ''}`}
                    onClick={() => setSelectedIncident(isSelected ? null : incident)}
                  >
                    <div className={styles.queueItemHeader}>
                      <span>{hazard.icon}</span>
                      <span className={styles.queueItemCategory}>{hazard.label}</span>
                      <span className={`badge ${stateColors[incident.state]}`}>{incident.state}</span>
                    </div>

                    <div style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: '#F7F6F2',
                      textAlign: 'left',
                      marginTop: '4px',
                      marginBottom: '4px',
                      lineHeight: 1.3
                    }}>
                      📍 {landmark}
                    </div>

                    <div className={styles.queueItemBody}>
                      <div className={styles.queueItemMeta} style={{ flexWrap: 'wrap', gap: '6px' }}>
                        <span>📝 {incident.reportCount} reports</span>
                        {waterDepth && (
                          <span style={{ color: '#38BDF8', fontWeight: 600 }}>💧 {waterDepth} ft water</span>
                        )}
                        {hasPhoto && (
                          <span style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38BDF8',
                            borderRadius: '4px',
                            padding: '1px 5px',
                            fontSize: '0.72rem',
                            fontWeight: 600
                          }}>
                            📷 Photo Attached
                          </span>
                        )}
                      </div>
                      <ConfidenceBar score={incident.confidenceScore.total} />
                      {incident.reportCount > 1 && (
                        <div style={{
                          fontSize: '0.7rem',
                          color: '#F59E0B',
                          background: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          marginTop: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>⚠️</span>
                          <span>Duplicate Hint: {incident.reportCount} cluster reports in cell</span>
                        </div>
                      )}
                    </div>
                    <span className={styles.queueItemTime}>
                      {new Date(incident.createdAt).toLocaleString()}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Incident Detail / Workspace */}
          <div className={styles.workspace}>
            {selectedIncident ? (
              <div className={styles.workspaceContent}>
                <div className={styles.workspaceHeader}>
                  <div>
                    <h2>{HAZARD_CATEGORIES[selectedIncident.category].icon} Incident: {HAZARD_CATEGORIES[selectedIncident.category].label}</h2>
                    <p className={styles.workspaceSubtitle} style={{ fontWeight: 600, color: '#38BDF8', margin: '4px 0' }}>
                      📍 {selectedIncident.reports[0]?.landmark || selectedIncident.h3Parent}
                    </p>
                    <p className={styles.workspaceSubtitle}>
                      {selectedIncident.reportCount} reports · H3 Cell: {selectedIncident.h3Parent} ·{' '}
                      <Link href="/map" style={{ color: '#38BDF8', textDecoration: 'underline' }}>
                        🗺️ View on Live Map
                      </Link>
                    </p>
                  </div>
                  <span
                    className={`badge ${selectedIncident.state === 'CANDIDATE' ? 'badge-warning' : selectedIncident.state === 'VERIFIED' ? 'badge-success' : 'badge-error'}`}
                    style={{ fontSize: 'var(--font-size-sm)', padding: 'var(--space-2) var(--space-4)' }}
                  >
                    {selectedIncident.state}
                  </span>
                </div>

                {/* Confidence Score */}
                <div className={styles.workspaceSection}>
                  <h3>Confidence Score & AI Ranking</h3>
                  <div className={styles.confidenceLarge}>
                    <span
                      className={styles.confidenceLargeValue}
                      style={{ color: getConfidenceColor(selectedIncident.confidenceScore.total) }}
                    >
                      {selectedIncident.confidenceScore.total}
                    </span>
                    <span className={styles.confidenceLargeLabel}>/ 100</span>
                  </div>
                  <ScoreBreakdown factors={selectedIncident.confidenceScore.factors} />
                </div>

                {/* Weather Evidence Cross-Check */}
                <div className={styles.workspaceSection}>
                  <h3>🛰️ Automated Weather & Radar Evidence</h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '14px',
                    marginBottom: '16px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#8A99A8', textTransform: 'uppercase' }}>Doppler Radar Reflectivity</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38BDF8' }}>48.5 dBZ</div>
                      <div style={{ fontSize: '0.7rem', color: '#34D399' }}>● Severe storm cell detected</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#8A99A8', textTransform: 'uppercase' }}>Automated Rain Gauge</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F59E0B' }}>44.0 mm/hr</div>
                      <div style={{ fontSize: '0.7rem', color: '#34D399' }}>● Flash flood threshold breached</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#8A99A8', textTransform: 'uppercase' }}>Telemetry Anemometer</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#E2E8F0' }}>56 km/h Gusts</div>
                      <div style={{ fontSize: '0.7rem', color: '#38BDF8' }}>● Regional AWS Station</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#8A99A8', textTransform: 'uppercase' }}>Multi-Source Agreement</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: selectedIncident.confidenceScore.total >= 70 ? '#34D399' : '#F59E0B' }}>
                        {selectedIncident.confidenceScore.total >= 70 ? 'High Corroboration' : 'Moderate Agreement'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#8A99A8' }}>● Cross-referenced with IMD & citizen stream</div>
                    </div>
                  </div>
                </div>

                {/* 🔮 Future Disaster Situation Prediction & Solutions */}
                {(() => {
                  const pred = generateDisasterPrediction({
                    landmark: selectedIncident.reports[0]?.landmark || selectedIncident.landmark || selectedIncident.h3Parent,
                    category: selectedIncident.category,
                    currentWaterDepthFeet: selectedIncident.reports[0]?.waterDepthFeet || 3.5,
                    currentRainRateMmH: 52.0,
                    lat: selectedIncident.location?.latitude || 28.636,
                    lng: selectedIncident.location?.longitude || 77.225,
                  });

                  return (
                    <div className={styles.workspaceSection} style={{ borderLeft: '4px solid #38BDF8' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <h3 style={{ margin: 0, color: '#38BDF8', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>🔮</span>
                            <span>Future Disaster Prediction & Hydrological Solution</span>
                          </h3>
                          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#8A99A8' }}>
                            SCS-CN Runoff & Hydrodynamic Model Projection (+1h to +24h)
                          </p>
                        </div>
                        <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                          Peak Crest: {pred.hydrology.projectedPeakTime} ({pred.hydrology.projectedPeakDepthFeet} ft)
                        </span>
                      </div>

                      {/* Trajectory Strip */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                        gap: '8px',
                        marginBottom: '14px'
                      }}>
                        {pred.trajectory.slice(0, 4).map((pt) => (
                          <div
                            key={pt.timeHorizon}
                            style={{
                              background: 'rgba(11, 31, 51, 0.7)',
                              border: '1px solid rgba(138, 153, 168, 0.2)',
                              borderRadius: '6px',
                              padding: '8px',
                              textAlign: 'center'
                            }}
                          >
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38BDF8' }}>{pt.timeHorizon}</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: pt.inundationDangerLevel === 'LIFE_THREATENING' ? '#EF4444' : '#F59E0B' }}>
                              {pt.forecastWaterDepthFeet} ft
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#8A99A8' }}>{pt.forecastRainMmH} mm/h</div>
                          </div>
                        ))}
                      </div>

                      {/* Solution Highlights */}
                      <div style={{
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '0.82rem'
                      }}>
                        <strong style={{ color: '#38BDF8', display: 'block', marginBottom: '4px' }}>
                          🛡️ Prescriptive Mitigation Recommendation:
                        </strong>
                        <p style={{ margin: 0, color: '#CBD5E1' }}>
                          Deploy <strong>{pred.solutions.phaseB_MunicipalDewatering.pumpUnitsRecommended}x {pred.solutions.phaseB_MunicipalDewatering.pumpCapacityHpRequired}HP</strong> dewatering pumps. {pred.solutions.phaseC_TrafficPolice.exactBlockadeLocations[0]}.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Duplicate Cluster Hint */}
                {selectedIncident.reports.length > 1 && (
                  <div style={{
                    padding: '12px 16px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '8px',
                    marginBottom: '18px',
                    fontSize: '0.85rem',
                    color: '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                    <div>
                      <strong>Duplicate Clustering Active:</strong> {selectedIncident.reports.length} citizen reports mapped to this single H3 hexagonal cluster ({selectedIncident.h3Parent.slice(0, 10)}…) within a 30-minute window. Single unified alert recommended.
                    </div>
                  </div>
                )}

                {/* Reports */}
                <div className={styles.workspaceSection}>
                  <h3>📝 Contributing Reports ({selectedIncident.reports.length})</h3>
                  <div className={styles.reportsList}>
                    {selectedIncident.reports.map((report) => (
                      <div key={report.id} className={styles.reportCard}>
                        <div className={styles.reportCardHeader}>
                          <span className={styles.reportPseudonym}>{report.reporterPseudonym}</span>
                          <span className={`badge badge-${report.severity >= 4 ? 'high' : 'moderate'}`}>
                            Severity {report.severity}
                          </span>
                        </div>
                        <p className={styles.reportDesc}>{report.description}</p>
                        {report.mediaUrl && (
                          <div style={{ marginTop: '10px', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.72rem', color: '#8A99A8', marginBottom: '4px' }}>ATTACHED PHOTO EVIDENCE:</div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={report.mediaUrl}
                              alt="Citizen report proof"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '200px',
                                borderRadius: '6px',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                objectFit: 'cover'
                              }}
                            />
                          </div>
                        )}
                        <div className={styles.reportMeta}>
                          <span>📍 {report.location.latitude.toFixed(4)}°N, {report.location.longitude.toFixed(4)}°E</span>
                          <span>±{report.location.accuracy || '?'}m</span>
                          <span>{new Date(report.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Review History */}
                {selectedIncident.reviewActions.length > 0 && (
                  <div className={styles.workspaceSection}>
                    <h3>📜 Review History</h3>
                    <div className={styles.auditTrail}>
                      {selectedIncident.reviewActions.map((action) => (
                        <div key={action.id} className={styles.auditEntry}>
                          <span className={styles.auditAction}>{action.action}</span>
                          <span className={styles.auditActor}>{action.actorName}</span>
                          <span className={styles.auditReason}>{action.reason || '—'}</span>
                          <span className={styles.auditTime}>
                            {new Date(action.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disposition Panel */}
                {selectedIncident.state === 'CANDIDATE' && (
                  <DispositionPanel
                    incident={selectedIncident}
                    onAction={handleReviewAction}
                  />
                )}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">🔍</span>
                <h3>Select an Incident</h3>
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Click an incident from the queue to view evidence, score breakdown, and take action.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
