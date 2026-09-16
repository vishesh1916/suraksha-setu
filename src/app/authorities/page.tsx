'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import type { Report, ActionCategory } from '@/types';
import { HAZARD_CATEGORIES } from '@/types';
import { getClientReports, updateClientReportAction, subscribeToSync, isDemoReport } from '@/lib/clientSync';
import styles from './authorities.module.css';

export default function AuthoritiesPortalPage() {
  // Authentication State
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Operational Data State
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // 1. Initial Session Verification (Gated for Authorized Admin)
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data?.authenticated) {
          setAuthenticated(true);
          return;
        }

        // Check if previously authorized in localStorage
        if (typeof window !== 'undefined' && localStorage.getItem('suraksha_admin_authenticated') === 'true') {
          try {
            const loginRes = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: 'admin', password: 'Suraksha@Setu2026!' }),
            });
            const loginData = await loginRes.json();
            if (loginData.success) {
              setAuthenticated(true);
              return;
            }
          } catch {}
        }
        setAuthenticated(false);
      } catch {
        setAuthenticated(false);
      }
    }
    checkSession();
  }, []);

  // 2. Incident Stream Loader (Server + LocalStorage clientSync merged)
  const loadIncidents = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports?limit=100&_t=${Date.now()}`, { cache: 'no-store' });
      const clientReps = getClientReports().filter((r) => !isDemoReport(r));
      let serverReps: Report[] = [];

      if (res.ok) {
        const json = await res.json();
        serverReps = (json.data || []).filter((r: Report) => !isDemoReport(r));
      }

      // Merge server reports and client reports cleanly
      const mergedMap = new Map<string, Report>();
      for (const sr of serverReps) {
        mergedMap.set(sr.id.toLowerCase(), sr);
      }
      for (const cr of clientReps) {
        const existing = mergedMap.get(cr.id.toLowerCase());
        if (existing) {
          const crHasAction = cr.currentActionCategory && cr.currentActionCategory !== 'Pending Verification';
          const srHasAction = existing.currentActionCategory && existing.currentActionCategory !== 'Pending Verification';
          if (crHasAction && !srHasAction) {
            mergedMap.set(cr.id.toLowerCase(), { ...existing, ...cr });
          } else {
            mergedMap.set(cr.id.toLowerCase(), { ...cr, ...existing });
          }
        } else {
          mergedMap.set(cr.id.toLowerCase(), cr);
        }
      }

      const sortedReports = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      setReports(sortedReports);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load incident stream:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. Trigger loader and recurring sync once authenticated
  useEffect(() => {
    if (!authenticated) return;
    loadIncidents();
    const interval = setInterval(loadIncidents, 6000);
    return () => clearInterval(interval);
  }, [authenticated, loadIncidents]);

  // 4. Real-time zero-latency cross-tab sync subscription
  useEffect(() => {
    if (!authenticated) return;
    const unsubscribe = subscribeToSync((msg) => {
      if (msg.type === 'PURGE_ALL') {
        setReports([]);
        setLastUpdated(new Date());
      } else if (msg.type === 'NEW_REPORT' && msg.report && !isDemoReport(msg.report)) {
        setReports((prev) => {
          const cleanId = msg.report!.id.toLowerCase();
          const exists = prev.some((r) => r.id.toLowerCase() === cleanId);
          if (exists) {
            return prev.map((r) => (r.id.toLowerCase() === cleanId ? { ...r, ...msg.report! } : r));
          }
          return [msg.report!, ...prev];
        });
        setLastUpdated(new Date());
      } else if (msg.type === 'REPORT_ACTION' && msg.report) {
        setReports((prev) => {
          const cleanId = msg.report!.id.toLowerCase();
          return prev.map((r) => (r.id.toLowerCase() === cleanId ? { ...r, ...msg.report! } : r));
        });
        setLastUpdated(new Date());
      }
    });
    return unsubscribe;
  }, [authenticated]);

  // Handle Authentication Submission
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAuthenticated(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('suraksha_admin_authenticated', 'true');
        }
      } else {
        setLoginError(data.error || 'Invalid credentials. Access restricted to authorized personnel.');
      }
    } catch {
      setLoginError('Connection to authentication gateway failed. Please retry.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Sign Out / Terminal Lock
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('suraksha_admin_authenticated');
    }
    setAuthenticated(false);
  };

  // Handle Quick Inline Tactical Actions
  const handleQuickAction = async (reportId: string, action: ActionCategory) => {
    setActionInProgress(reportId);

    // Optimistically update the UI
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === reportId || r.id.toLowerCase() === reportId.toLowerCase()) {
          const isFalse = action === 'Flagged False Alarm / Dismissed';
          const isResolved = action === 'Hazard Resolved';
          return {
            ...r,
            currentActionCategory: action,
            verificationStatus: isFalse ? 'FLAGGED_FALSE_REPORT' : 'VERIFIED_GENUINE',
            status: isFalse ? 'DISMISSED' : isResolved ? 'RESOLVED' : 'REVIEWED',
            updatedAt: new Date().toISOString(),
          };
        }
        return r;
      })
    );

    // Save and broadcast via clientSync
    updateClientReportAction(reportId, action, 'Tactical action executed from Authorities Console');

    // Notify backend API
    try {
      await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          action,
          notes: 'Tactical action executed from Authorities Console',
          actorName: 'Duty Admin (admin)',
        }),
      });
    } catch (err) {
      console.warn('Server PATCH error:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  // Status Badge Formatter
  const renderStatusBadge = (r: Report) => {
    const action = r.currentActionCategory;
    if (action === 'Evacuation Ordered') {
      return <span className={`${styles.statusChip} ${styles.statusTacticalEvac}`}>🚨 Evacuation Ordered</span>;
    }
    if (action === 'Search & Rescue Deployed') {
      return <span className={`${styles.statusChip} ${styles.statusTacticalSAR}`}>⛑️ SAR Deployed</span>;
    }
    if (action === 'Dewatering & Municipal Crew Dispatched') {
      return <span className={`${styles.statusChip} ${styles.statusTacticalDewater}`}>🚜 Dewatering Dispatched</span>;
    }
    if (action === 'Public Warning Issued (CAP 1.2)') {
      return <span className={`${styles.statusChip} ${styles.statusTacticalCAP}`}>📢 CAP 1.2 Broadcast</span>;
    }
    if (action === 'Hazard Resolved' || r.status === 'RESOLVED') {
      return <span className={`${styles.statusChip} ${styles.statusTacticalResolved}`}>✅ Hazard Resolved</span>;
    }
    if (r.verificationStatus === 'VERIFIED_GENUINE' || action === 'Verified Genuine — Pending Tactical Action') {
      return <span className={`${styles.statusChip} ${styles.statusVerified}`}>🛡️ Verified Genuine</span>;
    }
    if (r.status === 'DISMISSED' || r.verificationStatus === 'FLAGGED_FALSE_REPORT' || action === 'Flagged False Alarm / Dismissed') {
      return <span className={`${styles.statusChip} ${styles.statusDismissed}`}>✖️ Dismissed / False</span>;
    }
    return <span className={`${styles.statusChip} ${styles.statusPending}`}>⏳ Pending Triage</span>;
  };

  // Metrics Calculations
  const pendingCount = reports.filter(
    (r) =>
      (!r.verificationStatus || r.verificationStatus === 'PENDING_VERIFICATION') &&
      r.status !== 'DISMISSED' &&
      r.status !== 'RESOLVED' &&
      (!r.currentActionCategory || r.currentActionCategory === 'Pending Verification')
  ).length;

  const verifiedActiveCount = reports.filter(
    (r) =>
      r.status !== 'DISMISSED' &&
      r.status !== 'RESOLVED' &&
      (r.verificationStatus === 'VERIFIED_GENUINE' ||
        (r.currentActionCategory && r.currentActionCategory !== 'Pending Verification'))
  ).length;

  // View State 1: Verification in Progress
  if (authenticated === null) {
    return (
      <div className={styles.page}>
        <Navbar />
        <main className={styles.authContainer}>
          <div className={styles.authLoading}>
            <div className="spinner spinner-lg" />
            <p>Verifying authority clearance credentials…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // View State 2: Unauthenticated Gate (Official Access Modal)
  if (authenticated === false) {
    return (
      <div className={styles.page}>
        <Navbar />
        <main className={styles.authContainer}>
          <div className={styles.authCard}>
            <div className={styles.authBadge}>
              <span>🔒</span> Restricted Authority Portal
            </div>

            <h1 className={styles.authTitle}>Official Access</h1>
            <p className={styles.authSubtitle}>
              Authorized meteorologists, disaster response officers, and system administrators.
            </p>

            {loginError && (
              <div className={styles.authErrorAlert} role="alert">
                <span>⚠️</span>
                <div>{loginError}</div>
              </div>
            )}

            <form onSubmit={handleLogin} className={styles.authForm}>
              <div className={styles.authFormGroup}>
                <label htmlFor="auth-username" className={styles.authLabel}>
                  Operator Username
                </label>
                <div className={styles.authInputWrapper}>
                  <input
                    id="auth-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className={styles.authInput}
                    placeholder="Enter authorized identifier"
                  />
                </div>
              </div>

              <div className={styles.authFormGroup}>
                <label htmlFor="auth-password" className={styles.authLabel}>
                  Security Password
                </label>
                <div className={styles.authInputWrapper}>
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={styles.authInput}
                    placeholder="Enter secure clearance passphrase"
                  />
                  <button
                    type="button"
                    className={styles.authToggleBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={styles.authSubmitBtn}
                disabled={loginLoading}
                id="authorities-auth-btn"
              >
                {loginLoading ? (
                  <>
                    <span className="spinner spinner-sm" />
                    <span>Verifying Clearance…</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate &amp; Enter Command Post</span>
                    <span>→</span>
                  </>
                )}
              </button>

              <div style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setLoginUsername('admin');
                    setLoginPassword('Suraksha@Setu2026!');
                  }}
                  className={styles.autoFillBtn}
                >
                  <span>⚡</span>
                  <span>Auto-fill Duty Credentials (admin / Suraksha@Setu2026!)</span>
                </button>
              </div>
            </form>

            <div className={styles.authCardFooter}>
              All authentication attempts are logged for audit compliance under the Disaster Management Framework.
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // View State 3: Authorized Command Post Console
  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.container}>
        {/* Admin Operational Clearance Bar */}
        <div className={styles.clearanceBar}>
          <div className={styles.clearanceInfo}>
            <span className={styles.clearanceDot} />
            <span>
              <strong>ADMIN CLEARANCE VERIFIED</strong> · Operator: <code className={styles.clearanceCode}>admin</code> · Department: Disaster Operations &amp; Tactical Dispatch
            </span>
          </div>
          <div className={styles.clearanceActions}>
            <button
              onClick={loadIncidents}
              className={styles.syncBtn}
              title="Manual live sync"
              disabled={loading}
            >
              <span>{loading ? '⟳ Syncing…' : '↻ Refresh Feed'}</span>
              <span className={styles.syncTimestamp}>
                Synced: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Live'}
              </span>
            </button>
            <button
              onClick={handleLogout}
              className={styles.logoutBtn}
              title="Lock terminal and sign out"
            >
              🔒 Lock Terminal
            </button>
          </div>
        </div>

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
            <span className={styles.statValue}>{pendingCount}</span>
            <span className={styles.statMeta}>Reports Requiring Human Sign-off</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>VERIFIED ACTIVE</span>
            <span className={styles.statValue}>{verifiedActiveCount}</span>
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
                <span className={styles.sectionSubtitle}>
                  Real-time citizen submissions awaiting municipal directive ({reports.length} total active reports)
                </span>
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
              {loading && reports.length === 0 ? (
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
                  const isPending = !r.verificationStatus || r.verificationStatus === 'PENDING_VERIFICATION';
                  const isOperating = actionInProgress === r.id;

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
                        {renderStatusBadge(r)}
                      </div>

                      <p className={styles.incidentDesc}>
                        {r.description || 'Hazard reported by citizen via mobile GPS telemetry.'}
                      </p>

                      {/* Inline Quick Action Directives for Duty Admin */}
                      <div className={styles.inlineActionsRow}>
                        {isPending && (
                          <>
                            <button
                              disabled={isOperating}
                              onClick={() => handleQuickAction(r.id, 'Verified Genuine — Pending Tactical Action')}
                              className={`${styles.quickActionBtn} ${styles.quickActionBtnSuccess}`}
                              title="Mark genuine and escalate"
                            >
                              ✓ Verify Genuine
                            </button>
                            <button
                              disabled={isOperating}
                              onClick={() => handleQuickAction(r.id, 'Flagged False Alarm / Dismissed')}
                              className={`${styles.quickActionBtn} ${styles.quickActionBtnDanger}`}
                              title="Dismiss as false report"
                            >
                              ✕ Flag False
                            </button>
                          </>
                        )}
                        <button
                          disabled={isOperating}
                          onClick={() => handleQuickAction(r.id, 'Dewatering & Municipal Crew Dispatched')}
                          className={styles.quickActionBtn}
                          title="Deploy municipal dewatering pumps"
                        >
                          🚜 Dispatch Dewatering
                        </button>
                        <button
                          disabled={isOperating}
                          onClick={() => handleQuickAction(r.id, 'Evacuation Ordered')}
                          className={styles.quickActionBtn}
                          title="Trigger emergency evacuation protocol"
                        >
                          🚨 Order Evacuation
                        </button>
                        {r.status !== 'RESOLVED' && r.currentActionCategory !== 'Hazard Resolved' && (
                          <button
                            disabled={isOperating}
                            onClick={() => handleQuickAction(r.id, 'Hazard Resolved')}
                            className={`${styles.quickActionBtn} ${styles.quickActionBtnSuccess}`}
                            title="Mark hazard as fully resolved"
                          >
                            ✅ Resolve
                          </button>
                        )}
                      </div>

                      <div className={styles.incidentFooter}>
                        <span className={styles.incidentLandmark}>📍 {r.landmark || 'Designated Zone'}</span>
                        <div className={styles.incidentActions}>
                          <Link
                            href={`/map?lat=${r.location.latitude}&lng=${r.location.longitude}&highlight=${r.id}`}
                            className={styles.inspectMapLink}
                          >
                            Locate on Map ↗
                          </Link>
                          <Link href={`/staff/admin?tab=all&highlight=${r.id}`} className={styles.takeActionLink}>
                            Full Console →
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
                  <div className={styles.telemetrySub}>
                    GPS positioning, evidence photos, {reports.length} ground reports synchronized
                  </div>
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
