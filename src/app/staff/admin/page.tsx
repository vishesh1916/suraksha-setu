'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { User, SourceHealth, AuditEvent, Report, Incident, DisasterPredictionResult, ActionCategory, ActionLogItem } from '@/types';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import { generateDisasterPrediction } from '@/lib/prediction';
import { flushOfflineQueue } from '@/lib/offlineQueue';
import { getClientReports, updateClientReportAction, subscribeToSync, purgeClientStorage, isDemoReport } from '@/lib/clientSync';
import styles from '../staff.module.css';

import { StaffSidebar } from '@/components/StaffSidebar';

type AdminTab =
  | 'all'
  | 'sentinel'
  | 'verification'
  | 'false_alarm'
  | 'verified_pending'
  | 'evacuation'
  | 'dewatering'
  | 'cap_warning'
  | 'sar'
  | 'monitoring'
  | 'resolved'
  | 'prediction'
  | 'system';

function mergeActionHistories(local: ActionLogItem[] = [], server: ActionLogItem[] = []): ActionLogItem[] {
  const combined = [...local, ...server];
  const seen = new Set<string>();
  const result: ActionLogItem[] = [];
  for (const item of combined) {
    if (!item) continue;
    const key = item.id ? item.id : `${item.action}_${(item.timestamp || '').slice(0, 19)}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

const ACTION_LEVELS: Record<string, number> = {
  'Pending Verification': 0,
  'Verified Genuine — Pending Tactical Action': 1,
  'Flagged False Alarm / Dismissed': 1,
  'Public Warning Issued (CAP 1.2)': 2,
  'Meteorological Monitoring': 2,
  'Dewatering & Municipal Crew Dispatched': 2,
  'Search & Rescue Deployed': 2,
  'Evacuation Ordered': 2,
  'Hazard Resolved': 3,
};

function smartMergeReport(localRep: Report | undefined, serverRep: Report): Report {
  if (!localRep) return serverRep;
  const mergedHistory = mergeActionHistories(localRep.actionHistory, serverRep.actionHistory);

  const localLevel = ACTION_LEVELS[localRep.currentActionCategory || 'Pending Verification'] ?? 0;
  const serverLevel = ACTION_LEVELS[serverRep.currentActionCategory || 'Pending Verification'] ?? 0;

  const localTime = new Date(localRep.updatedAt || 0).getTime();
  const serverTime = new Date(serverRep.updatedAt || 0).getTime();

  // If local has a higher action level, local MUST win — never demote actions!
  if (localLevel > serverLevel || (localLevel === serverLevel && localLevel > 0 && localTime >= serverTime)) {
    return {
      ...serverRep,
      status: localRep.status,
      verificationStatus: localRep.verificationStatus,
      currentActionCategory: localRep.currentActionCategory,
      firstActionTaken: localRep.firstActionTaken || serverRep.firstActionTaken,
      actionHistory: mergedHistory,
      verificationRationale: localRep.verificationRationale || serverRep.verificationRationale,
      updatedAt: localRep.updatedAt,
    };
  }

  // If server has a higher or equal level and is newer
  if (serverLevel > localLevel) {
    return {
      ...serverRep,
      actionHistory: mergedHistory.length > 0 ? mergedHistory : serverRep.actionHistory,
    };
  }

  return {
    ...serverRep,
    status: localRep.status || serverRep.status,
    verificationStatus: localRep.verificationStatus || serverRep.verificationStatus,
    currentActionCategory: localRep.currentActionCategory || serverRep.currentActionCategory,
    firstActionTaken: localRep.firstActionTaken || serverRep.firstActionTaken,
    actionHistory: mergedHistory.length > 0 ? mergedHistory : serverRep.actionHistory,
  };
}

function smartMergeIncident(localInc: Incident | undefined, serverInc: Incident): Incident {
  if (!localInc) return serverInc;
  const mergedHistory = mergeActionHistories(localInc.actionHistory, serverInc.actionHistory);

  const localLevel = ACTION_LEVELS[localInc.currentActionCategory || 'Pending Verification'] ?? 0;
  const serverLevel = ACTION_LEVELS[serverInc.currentActionCategory || 'Pending Verification'] ?? 0;

  const localTime = new Date(localInc.updatedAt || 0).getTime();
  const serverTime = new Date(serverInc.updatedAt || 0).getTime();

  if (localLevel > serverLevel || (localLevel === serverLevel && localLevel > 0 && localTime >= serverTime)) {
    return {
      ...serverInc,
      state: localInc.state,
      verificationStatus: localInc.verificationStatus,
      currentActionCategory: localInc.currentActionCategory,
      firstActionTaken: localInc.firstActionTaken || serverInc.firstActionTaken,
      actionHistory: mergedHistory,
      actionedDirective: localInc.actionedDirective,
      reports: localInc.reports,
      updatedAt: localInc.updatedAt,
    };
  }

  return {
    ...serverInc,
    actionHistory: mergedHistory.length > 0 ? mergedHistory : serverInc.actionHistory,
  };
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('Suraksha@Setu2026!');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('all');
  const [feedFilter, setFeedFilter] = useState<'all' | 'pending' | 'verified' | 'tactical' | 'resolved' | 'false_alarm'>('all');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [indiaRiskScan, setIndiaRiskScan] = useState<any>(null);
  const [sentinelFilter, setSentinelFilter] = useState<'all' | 'critical' | 'coastal' | 'river' | 'northern'>('all');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [recentlyActionedReports, setRecentlyActionedReports] = useState<Record<string, { action: ActionCategory; targetTab: AdminTab; message: string }>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Support direct URL deep-linking e.g. /staff/admin?tab=verified_pending
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab') as AdminTab | null;
      if (urlTab) setActiveTab(urlTab);
    }
  }, []);

  // In-situ Auth Verification
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data?.authenticated) {
          setAuthenticated(true);
        } else if (typeof window !== 'undefined' && localStorage.getItem('suraksha_admin_authenticated') === 'true') {
          // Attempt silent auto-login if previously verified
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
          setAuthenticated(false);
        } else {
          setAuthenticated(false);
        }
      } catch {
        setAuthenticated(false);
      }
    }
    checkSession();
  }, []);

  const handleInSituLogin = async (u?: string, p?: string) => {
    const userToTry = u || loginUsername;
    const passToTry = p || loginPassword;
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userToTry, password: passToTry }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuthenticated(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('suraksha_admin_authenticated', 'true');
        }
        showToast('🔓 Clearance verified! Welcome to Tactical Emergency Command Desk.');
        fetchData();
        fetchSentinelRisk();
      } else {
        setLoginError(data.error || 'Authentication denied. Invalid clearance credentials.');
      }
    } catch {
      setLoginError('Failed to connect to authentication gateway.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Prediction tool state
  const [selectedHotspot, setSelectedHotspot] = useState<string>('minto');
  const [customWaterDepth, setCustomWaterDepth] = useState<number>(4.5);
  const [customRainRate, setCustomRainRate] = useState<number>(58.0);
  const [predictionResult, setPredictionResult] = useState<DisasterPredictionResult | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Auto-flush any pending citizen reports queued in local storage
      if (typeof window !== 'undefined' && navigator.onLine) {
        try {
          await flushOfflineQueue();
        } catch {}
      }

      const timestamp = Date.now();
      const results = await Promise.allSettled([
        fetch(`/api/stats?_t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/admin/sources?_t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/admin/users?_t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/admin/audit?_t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/reports?limit=100&_t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/incidents?_t=${timestamp}`, { cache: 'no-store' }),
      ]);

      const [statsRes, sourcesRes, usersRes, auditRes, reportsRes, incidentsRes] = results;

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats(data.data || {});
      }
      if (sourcesRes.status === 'fulfilled' && sourcesRes.value.ok) {
        const data = await sourcesRes.value.json();
        setSources(data.data || []);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
        const data = await usersRes.value.json();
        setUsers(data.data || []);
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const data = await auditRes.value.json();
        setAuditLog(data.data || []);
      }
      if (reportsRes.status === 'fulfilled' && reportsRes.value.ok) {
        const data = await reportsRes.value.json();
        if (Array.isArray(data.data)) {
          const clientReps = getClientReports().filter(r => !isDemoReport(r));
          const serverReps: Report[] = data.data.filter((r: Report) => !isDemoReport(r));
          // Combine server reports and client reports seamlessly
          const incoming = [...serverReps];
          for (const cr of clientReps) {
            const idx = incoming.findIndex(ir => ir.id === cr.id || ir.id.toLowerCase() === cr.id.toLowerCase());
            if (idx >= 0) {
              incoming[idx] = smartMergeReport(cr, incoming[idx]);
            } else {
              incoming.unshift(cr);
            }
          }

          setReports((prev) => {
            if (prev.length === 0) return incoming;
            const merged = incoming.map((serverRep) => {
              const localRep = prev.find((p) => p.id === serverRep.id);
              return smartMergeReport(localRep, serverRep);
            });
            const missingFromIncoming = prev.filter(p => !incoming.some(inc => inc.id === p.id));
            return [...missingFromIncoming, ...merged];
          });
        }
      }
      if (incidentsRes.status === 'fulfilled' && incidentsRes.value.ok) {
        const data = await incidentsRes.value.json();
        if (Array.isArray(data.data)) {
          const incoming: Incident[] = data.data;
          setIncidents((prev) => {
            if (prev.length === 0) return incoming;
            const merged = incoming.map((serverInc) => {
              const localInc = prev.find((p) => p.id === serverInc.id);
              return smartMergeIncident(localInc, serverInc);
            });
            const missingFromIncoming = prev.filter(p => !incoming.some(inc => inc.id === p.id));
            return [...missingFromIncoming, ...merged];
          });
        }
      }
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (e) {
      console.warn('Admin fetchData error:', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchSentinelRisk = useCallback(async () => {
    try {
      const res = await fetch(`/api/risk/india?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setIndiaRiskScan(data.data || null);
      }
    } catch (e) {
      console.warn('Sentinel risk fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchSentinelRisk();
    const sentinelInterval = setInterval(fetchSentinelRisk, 30000); // 30s weather telemetry sync
    return () => clearInterval(sentinelInterval);
  }, [fetchData, fetchSentinelRisk]);

  // Real-time zero-latency sync subscription across tabs (BroadcastChannel + storage)
  useEffect(() => {
    const unsubscribe = subscribeToSync((msg) => {
      if (msg.type === 'PURGE_ALL') {
        setReports([]);
        setIncidents([]);
        setRecentlyActionedReports({});
      } else if (msg.type === 'NEW_REPORT' && msg.report && !isDemoReport(msg.report)) {
        setReports((prev) => {
          const exists = prev.some((r) => r.id === msg.report!.id || r.id.toLowerCase() === msg.report!.id.toLowerCase());
          if (exists) {
            return prev.map(r => (r.id === msg.report!.id || r.id.toLowerCase() === msg.report!.id.toLowerCase()) ? smartMergeReport(r, msg.report!) : r);
          }
          return [msg.report!, ...prev];
        });
      } else if (msg.type === 'REPORT_ACTION' && msg.report) {
        setReports((prev) =>
          prev.map((r) => (r.id === msg.report!.id || r.id.toLowerCase() === msg.report!.id.toLowerCase() ? smartMergeReport(r, msg.report!) : r))
        );
      }
    });
    return unsubscribe;
  }, []);

  // Gentle 15s auto-sync interval ONLY when auto-sync toggle is explicitly ON
  useEffect(() => {
    if (!autoSync) return;
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [autoSync, fetchData]);

  const handlePurgeData = async () => {
    if (!confirm('Are you sure you want to purge all test and demo records from the database? This resets the platform to a completely clean zero-data state.')) {
      return;
    }
    try {
      purgeClientStorage();
      setReports([]);
      setIncidents([]);
      setRecentlyActionedReports({});
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      if (res.ok) {
        showToast('🧹 Clean slate: All demo and test records successfully purged.');
        fetchData();
      }
    } catch {
      showToast('Failed to purge records.');
    }
  };

  // Run prediction calculation whenever hotspot or sliders change
  const computePrediction = useCallback((depth?: number, rain?: number) => {
    const depthVal = depth !== undefined ? depth : customWaterDepth;
    const rainVal = rain !== undefined ? rain : customRainRate;

    let landmark = 'Minto Bridge Underpass, Connaught Place, New Delhi';
    let category: any = 'WATERLOGGING';
    let lat = 28.6360;
    let lng = 77.2250;
    let city = 'Delhi NCR';

    if (selectedHotspot === 'hindmata') {
      landmark = 'Hindmata Flyover Junction, Dadar East, Mumbai';
      category = 'WATERLOGGING';
      lat = 18.9932;
      lng = 72.8456;
      city = 'Mumbai';
    } else if (selectedHotspot === 'bellandur') {
      landmark = 'Bellandur EcoSpace Tech Corridor, Outer Ring Road, Bengaluru';
      category = 'FLOODING';
      lat = 12.9260;
      lng = 77.6834;
      city = 'Bengaluru';
    } else if (selectedHotspot === 'shimla') {
      landmark = 'Dhalli Tunnel Bypass, NH-5 Himalayan Corridor, Shimla';
      category = 'CLOUDBURST';
      lat = 31.1150;
      lng = 77.1950;
      city = 'Shimla';
    }

    const url = `/api/prediction?lat=${lat}&lng=${lng}&waterDepth=${depthVal}&rainRate=${rainVal}&landmark=${encodeURIComponent(landmark)}`;
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setPredictionResult(json.data);
        } else {
          throw new Error();
        }
      })
      .catch(() => {
        const res = generateDisasterPrediction({
          landmark,
          cityName: city,
          stateName: 'India',
          category,
          currentWaterDepthFeet: depthVal,
          currentRainRateMmH: rainVal,
          lat,
          lng,
        });
        setPredictionResult(res);
      });
  }, [customWaterDepth, customRainRate, selectedHotspot]);

  useEffect(() => {
    computePrediction();
  }, [computePrediction]);

  // Escalation Actions
  const handleBroadcastAlert = async (incident: Incident) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: `🚨 EMERGENCY FLASH FLOOD WARNING — ${incident.landmark || incident.h3Parent}`,
          guidance: `Urgent executive alert: Critical waterlogging detected (${incident.reports[0]?.waterDepthFeet ? incident.reports[0].waterDepthFeet + ' ft' : 'Dangerous levels'}). Road impassable. Avoid corridor and seek higher ground immediately.`,
          severity: incident.impactLevel === 'CRITICAL' ? 5 : 4,
          category: incident.category,
          expiresAt: new Date(Date.now() + 6 * 3600000).toISOString(),
          publishedBy: 'Platform Administrator (DDMA Emergency Desk)',
          source: 'Executive Disaster Command Centre',
        }),
      });

      if (res.ok) {
        await fetch(`/api/incidents/${incident.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'BROADCAST_ALERT',
            actorId: 'admin_exec',
          }),
        });

        showToast('📢 Official Emergency Public Alert broadcasted to citizen feed and CAP stream!');
        fetchData();
      }
    } catch {
      showToast('Failed to broadcast alert');
    }
  };

  const handleDispatchPumps = async (incidentId: string) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MUNICIPAL_ORDER',
          actorId: 'admin_exec',
          actorName: 'Emergency Administrator',
          orderDetails: { pumpUnits: 3, pumpHp: 500, trafficBarricades: true },
        }),
      });

      if (res.ok) {
        showToast('🚒 Emergency Directive Dispatched: 3x 500HP Dewatering Pumps and Traffic Police Barricades Mobilized!');
        fetchData();
      }
    } catch {
      showToast('Failed to dispatch municipal order');
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESOLVE',
          reason: 'Corridor drained, dewatering pumps completed operation, road restored to safe traffic.',
          actorId: 'admin_exec',
          actorName: 'Emergency Administrator',
        }),
      });

      if (res.ok) {
        showToast('✅ Incident marked as RESOLVED and citizen ground reports closed with all-clear.');
        fetchData();
      }
    } catch {
      showToast('Failed to resolve incident');
    }
  };

  const handleReopenIncident = async (incidentId: string) => {
    try {
      showToast('↩️ Re-opening hazard back to Stage 1 Ground Verification…');
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESTORE' }),
      });
      if (res.ok) {
        showToast('✅ Hazard re-opened to Stage 1: Ground Verification.');
        fetchData();
        setActiveTab('verification');
      } else {
        showToast('Server error re-opening incident');
      }
    } catch {
      showToast('Failed to re-open incident');
    }
  };

  const handleTakeReportAction = async (reportId: string, action: ActionCategory, notes: string = '') => {
    // 1. Optimistic local UI update so buttons respond instantly with 0 latency
    const timestamp = new Date().toISOString();
    const actionLog: ActionLogItem = {
      id: 'act_' + Date.now(),
      action,
      actorName: 'Emergency Administrator',
      notes,
      timestamp,
    };

    let targetTab: AdminTab = 'all';
    let successMsg = '';
    if (action === 'Verified Genuine — Pending Tactical Action') {
      targetTab = 'verified_pending';
      successMsg = 'Verified Genuine! Advanced to Stage 2: Tactical deployment options now unlocked.';
    } else if (action === 'Flagged False Alarm / Dismissed') {
      targetTab = 'false_alarm';
      successMsg = 'Flagged as False Alarm. Archived from active operational streams.';
    } else if (action === 'Hazard Resolved') {
      targetTab = 'resolved';
      successMsg = 'Hazard marked as RESOLVED! Corridor fully restored.';
    } else if (action === 'Evacuation Ordered') {
      targetTab = 'evacuation';
      successMsg = 'Mandatory Evacuation Directive Dispatched! Advanced to Stage 3.';
    } else if (action === 'Dewatering & Municipal Crew Dispatched') {
      targetTab = 'dewatering';
      successMsg = 'Dewatering Pumps (500HP) Dispatched! Advanced to Stage 3.';
    } else if (action === 'Public Warning Issued (CAP 1.2)') {
      targetTab = 'cap_warning';
      successMsg = 'Emergency Public Warning Broadcasted! Advanced to Stage 3.';
    } else if (action === 'Search & Rescue Deployed') {
      targetTab = 'sar';
      successMsg = 'NDRF / SDRF Search & Rescue Deployed! Advanced to Stage 3.';
    } else if (action === 'Meteorological Monitoring') {
      targetTab = 'monitoring';
      successMsg = 'Placed on active sensor telemetry monitoring. Advanced to Stage 3.';
    } else {
      successMsg = `Action "${action}" recorded and synchronized to citizen tracking!`;
    }

    setRecentlyActionedReports(prev => ({
      ...prev,
      [reportId]: { action, targetTab, message: successMsg }
    }));

    setReports((prev) =>
      prev.map((r) => {
        if (r.id !== reportId) return r;
        const isFalse = action === 'Flagged False Alarm / Dismissed';
        const isResolved = action === 'Hazard Resolved';
        return {
          ...r,
          verificationStatus: isFalse
            ? 'FLAGGED_FALSE_REPORT'
            : isResolved
            ? r.verificationStatus
            : 'VERIFIED_GENUINE',
          status: isFalse ? 'DISMISSED' : isResolved ? 'RESOLVED' : 'REVIEWED',
          currentActionCategory: action,
          firstActionTaken:
            r.firstActionTaken &&
            r.firstActionTaken !== 'Pending Verification' &&
            r.firstActionTaken !== 'Verified Genuine — Pending Tactical Action'
              ? r.firstActionTaken
              : action,
          actionHistory: [actionLog, ...(r.actionHistory || [])],
          updatedAt: timestamp,
        };
      })
    );

    // Also optimistically update incidents if clustered
    setIncidents((prev) =>
      prev.map((inc) => {
        const hasReport = inc.reports.some((r) => r.id === reportId);
        if (!hasReport) return inc;
        const isFalse = action === 'Flagged False Alarm / Dismissed';
        const isResolved = action === 'Hazard Resolved';
        return {
          ...inc,
          state: isFalse ? 'DISMISSED' : isResolved ? 'RESOLVED' : 'ESCALATED',
          verificationStatus: isFalse ? 'FLAGGED_FALSE_REPORT' : 'VERIFIED_GENUINE',
          currentActionCategory: action,
          firstActionTaken:
            inc.firstActionTaken &&
            inc.firstActionTaken !== 'Pending Verification' &&
            inc.firstActionTaken !== 'Verified Genuine — Pending Tactical Action'
              ? inc.firstActionTaken
              : action,
          actionHistory: [actionLog, ...(inc.actionHistory || [])],
          updatedAt: timestamp,
        };
      })
    );

    // Sync to local browser storage and broadcast across tabs in 0ms
    updateClientReportAction(reportId, action, notes, 'Emergency Administrator');

    showToast(successMsg);

    // Stay on the current tab so the report stays visible with its action banner.
    // The user can manually navigate to the target tab if they want.

    try {
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          action,
          notes,
          actorName: 'Emergency Administrator',
        }),
      });
      if (res.ok) {
        const patchData = await res.json();
        if (patchData.success && patchData.data) {
          const serverUpdated: Report = patchData.data;
          setReports((prev) =>
            prev.map((r) => (r.id === reportId || r.id.toLowerCase() === reportId.toLowerCase() ? smartMergeReport(r, serverUpdated) : r))
          );
        }
      }
    } catch {
      // Offline or network error — optimistic update and clientSync keep the action safely!
    }
  };

  const launchPredictionForReport = (r: Report) => {
    const depth = r.waterDepthFeet || (r.severity >= 4 ? 4.5 : 2.0);
    const rain = r.severity * 14;
    setCustomWaterDepth(depth);
    setCustomRainRate(rain);
    setSelectedHotspot('custom');
    setActiveTab('prediction');

    const landmark = r.landmark || `${r.category} near ${r.location.latitude.toFixed(3)}°N, ${r.location.longitude.toFixed(3)}°E`;
    const res = generateDisasterPrediction({
      landmark,
      cityName: 'Regional Operational Sector',
      stateName: 'India',
      category: r.category,
      currentWaterDepthFeet: depth,
      currentRainRateMmH: rain,
      lat: r.location.latitude,
      lng: r.location.longitude,
    });
    setPredictionResult(res);
    showToast(`🔮 Hydrodynamic simulation loaded for ${landmark.split(',')[0]}`);
  };

  const escalatedIncidents = incidents.filter(
    (i) =>
      i.state === 'ESCALATED' ||
      i.actionedDirective === 'CAP_ALERT_BROADCASTED' ||
      i.actionedDirective === 'MUNICIPAL_ORDER_DISPATCHED'
  );

  // Clean Workflow Categorization by First Action Taken & Verification Status
  const pendingVerificationReports = reports.filter(r => 
    recentlyActionedReports[r.id]?.targetTab === 'verification' ||
    ((!r.verificationStatus || r.verificationStatus === 'PENDING_VERIFICATION') &&
    r.status !== 'DISMISSED' &&
    r.status !== 'RESOLVED' &&
    (!r.currentActionCategory || r.currentActionCategory === 'Pending Verification'))
  );

  const falseAlarmReports = reports.filter(r => 
    recentlyActionedReports[r.id]?.targetTab === 'false_alarm' ||
    r.verificationStatus === 'FLAGGED_FALSE_REPORT' || 
    r.status === 'DISMISSED' || 
    r.firstActionTaken === 'Flagged False Alarm / Dismissed' ||
    r.currentActionCategory === 'Flagged False Alarm / Dismissed'
  );

  const verifiedPendingReports = reports.filter(r => 
    recentlyActionedReports[r.id]?.targetTab === 'verified_pending' ||
    (r.verificationStatus === 'VERIFIED_GENUINE' &&
    r.status !== 'DISMISSED' &&
    r.status !== 'RESOLVED' &&
    (!r.currentActionCategory || r.currentActionCategory === 'Verified Genuine — Pending Tactical Action' || r.currentActionCategory === 'Pending Verification'))
  );

  const evacuationReports = reports.filter(r => 
    recentlyActionedReports[r.id]?.targetTab === 'evacuation' ||
    (r.status !== 'DISMISSED' && r.status !== 'RESOLVED' &&
    (r.currentActionCategory === 'Evacuation Ordered' || (r.firstActionTaken === 'Evacuation Ordered' && r.currentActionCategory !== 'Hazard Resolved')))
  );

  const dewateringReports = reports.filter(r => 
    recentlyActionedReports[r.id]?.targetTab === 'dewatering' ||
    (r.status !== 'DISMISSED' && r.status !== 'RESOLVED' &&
    (r.currentActionCategory === 'Dewatering & Municipal Crew Dispatched' || (r.firstActionTaken === 'Dewatering & Municipal Crew Dispatched' && r.currentActionCategory !== 'Hazard Resolved')))
  );

  const capWarningReports = reports.filter(r => 
    recentlyActionedReports[r.id]?.targetTab === 'cap_warning' ||
    (r.status !== 'DISMISSED' && r.status !== 'RESOLVED' &&
    (r.currentActionCategory === 'Public Warning Issued (CAP 1.2)' || (r.firstActionTaken === 'Public Warning Issued (CAP 1.2)' && r.currentActionCategory !== 'Hazard Resolved')))
  );

  const sarReports = reports.filter(r => 
    recentlyActionedReports[r.id]?.targetTab === 'sar' ||
    (r.status !== 'DISMISSED' && r.status !== 'RESOLVED' &&
    (r.currentActionCategory === 'Search & Rescue Deployed' || (r.firstActionTaken === 'Search & Rescue Deployed' && r.currentActionCategory !== 'Hazard Resolved')))
  );

  const monitoringReports = reports.filter(r => 
    recentlyActionedReports[r.id]?.targetTab === 'monitoring' ||
    (r.status !== 'DISMISSED' && r.status !== 'RESOLVED' &&
    (r.currentActionCategory === 'Meteorological Monitoring' || (r.firstActionTaken === 'Meteorological Monitoring' && r.currentActionCategory !== 'Hazard Resolved')))
  );

  const resolvedReports = reports.filter(r => 
    recentlyActionedReports[r.id]?.targetTab === 'resolved' ||
    r.status === 'RESOLVED' || 
    r.currentActionCategory === 'Hazard Resolved' || 
    r.firstActionTaken === 'Hazard Resolved'
  );

  if (authenticated === null) {
    return (
      <div className={styles.page} style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div className="spinner spinner-lg" />
        <p style={{ marginTop: 16, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          Verifying executive security clearance for Disaster Administration Desk…
        </p>
      </div>
    );
  }

  if (authenticated === false) {
    return (
      <div className={styles.page} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#071524', padding: '24px' }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          background: 'linear-gradient(135deg, rgba(11, 31, 51, 0.95) 0%, rgba(7, 21, 36, 0.98) 100%)',
          border: '1px solid #38BDF8',
          borderRadius: '16px',
          padding: '36px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛡️</div>
          <h2 style={{ color: '#F7F6F2', margin: '0 0 8px', fontSize: '1.4rem' }}>
            Disaster Administration & Tactical Desk
          </h2>
          <p style={{ color: '#8A99A8', fontSize: '0.88rem', margin: '0 0 20px' }}>
            Executive clearance required for Municipal Disaster Coordinators & IMD Duty Reviewers.
          </p>

          {loginError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #EF4444',
              color: '#FEE2E2',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '0.84rem'
            }}>
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleInSituLogin(); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Command Operator Username
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#F7F6F2', fontSize: '0.92rem' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Security Passphrase
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#F7F6F2', fontSize: '0.92rem' }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '6px', fontWeight: 700 }}
            >
              {loginLoading ? 'Verifying Clearance…' : 'Authenticate & Enter Tactical Desk →'}
            </button>

            <button
              type="button"
              onClick={() => handleInSituLogin('admin', 'Suraksha@Setu2026!')}
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px dashed rgba(56, 189, 248, 0.5)',
                color: '#38BDF8',
                padding: '10px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: 600,
                marginTop: '4px'
              }}
            >
              ⚡ Instant Command Unlock (admin / Suraksha@Setu2026!)
            </button>
          </form>
        </div>
      </div>
    );
  }

  const getReportStageInfo = (report: Report) => {
    if (report.status === 'RESOLVED' || report.currentActionCategory === 'Hazard Resolved') {
      return { stageNum: 4, label: 'Stage 4: Hazard Resolved & Corridor Restored', badgeColor: '#34D399' };
    }
    if (report.status === 'DISMISSED' || report.verificationStatus === 'FLAGGED_FALSE_REPORT') {
      return { stageNum: 1, label: 'Stage 1: Flagged False Alarm', badgeColor: '#EF4444' };
    }
    const isActionActive = report.currentActionCategory && [
      'Evacuation Ordered',
      'Dewatering & Municipal Crew Dispatched',
      'Public Warning Issued (CAP 1.2)',
      'Search & Rescue Deployed',
      'Meteorological Monitoring',
    ].includes(report.currentActionCategory);

    if (isActionActive) {
      return { stageNum: 3, label: `Stage 3: Tactical Action Active (${report.currentActionCategory})`, badgeColor: '#38BDF8' };
    }

    if (report.verificationStatus === 'VERIFIED_GENUINE' || report.status === 'REVIEWED') {
      return { stageNum: 2, label: 'Stage 2: Verified Genuine (Pending Tactical Order)', badgeColor: '#10B981' };
    }

    return { stageNum: 1, label: 'Stage 1: Pending Ground Verification (Right/Wrong)', badgeColor: '#F59E0B' };
  };

  const renderReportCard = (report: Report, isVerificationTab = false) => {
    const hazard = HAZARD_CATEGORIES[report.category] || { icon: '⚠️', label: report.category };
    const isGenuine = report.verificationStatus === 'VERIFIED_GENUINE' || report.status === 'REVIEWED';
    const isFalseAlarm = report.verificationStatus === 'FLAGGED_FALSE_REPORT' || report.status === 'DISMISSED';
    const isResolved = report.status === 'RESOLVED' || report.currentActionCategory === 'Hazard Resolved';
    const stageInfo = getReportStageInfo(report);

    return (
      <div key={report.id} className={styles.escalationCard} style={{
        marginBottom: '22px',
        background: '#0B1926',
        border: '1px solid #1E3A5F',
        borderRadius: '12px',
        padding: '22px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
        color: '#FFFFFF'
      }}>
        {/* Card Header with Category, Severity & Live Stage */}
        <div className={styles.escalationHeader}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span className={`badge badge-${(report.severity && report.severity >= 4) ? 'critical' : report.severity === 3 ? 'high' : 'moderate'}`}>
                Level {report.severity || 3} · {SEVERITY_LABELS[report.severity || 3]?.label || 'Moderate'}
              </span>

              {(!report.verificationStatus || report.verificationStatus === 'PENDING_VERIFICATION') && report.status !== 'DISMISSED' && report.status !== 'RESOLVED' && (
                <span style={{
                  background: '#F59E0B',
                  color: '#000',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  ⚡ NEW SUBMISSION — TRIAGE
                </span>
              )}

              <span style={{
                background: `${stageInfo.badgeColor}25`,
                border: `1px solid ${stageInfo.badgeColor}`,
                color: stageInfo.badgeColor,
                fontSize: '11px',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageInfo.badgeColor }} />
                {stageInfo.label}
              </span>

              <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', fontWeight: 600 }}>
                ID: {report.id}
              </span>
            </div>

            <h4 style={{ margin: '8px 0 4px', fontSize: '1.25rem', color: '#FFFFFF', fontWeight: 800, letterSpacing: '-0.01em' }}>
              {hazard.icon} {report.landmark || `${hazard.label} near ${report.location?.latitude != null ? report.location.latitude.toFixed(3) : 'Regional'}°N, ${report.location?.longitude != null ? report.location.longitude.toFixed(3) : 'Sector'}°E`}
            </h4>
            <p style={{ margin: '4px 0', fontSize: '0.86rem', color: '#CBD5E1' }}>
              GPS: <strong style={{ color: '#38BDF8' }}>{report.location?.latitude != null ? `${report.location.latitude.toFixed(4)}°N, ${report.location.longitude?.toFixed(4)}°E` : 'GPS Coordinates Registered'}</strong> · Reported by <strong style={{ color: '#FFFFFF' }}>{report.reporterPseudonym || 'Citizen'}</strong>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>Reported:</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
              {report.createdAt ? new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
            </div>
          </div>
        </div>

        {/* 4-Step Visual Progress Stepper */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          margin: '14px 0',
          background: '#0F253B',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid #1E3A5F'
        }}>
          <div style={{
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: stageInfo.stageNum >= 1 ? '#38BDF8' : '#64748B',
            borderBottom: `2px solid ${stageInfo.stageNum >= 1 ? '#38BDF8' : 'rgba(255,255,255,0.1)'}`,
            paddingBottom: 4
          }}>
            1. Report Filed
          </div>
          <div style={{
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: stageInfo.stageNum >= 2 ? '#34D399' : '#64748B',
            borderBottom: `2px solid ${stageInfo.stageNum >= 2 ? '#34D399' : 'rgba(255,255,255,0.1)'}`,
            paddingBottom: 4
          }}>
            2. Ground Verified
          </div>
          <div style={{
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: stageInfo.stageNum >= 3 ? '#FBBF24' : '#64748B',
            borderBottom: `2px solid ${stageInfo.stageNum >= 3 ? '#FBBF24' : 'rgba(255,255,255,0.1)'}`,
            paddingBottom: 4
          }}>
            3. Tactical Deployed
          </div>
          <div style={{
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: stageInfo.stageNum >= 4 ? '#4ADE80' : '#64748B',
            borderBottom: `2px solid ${stageInfo.stageNum >= 4 ? '#4ADE80' : 'rgba(255,255,255,0.1)'}`,
            paddingBottom: 4
          }}>
            4. Hazard Resolved
          </div>
        </div>

        {/* Photographic Evidence & Ground Stats */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
          {report.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.mediaUrl}
              alt="Citizen ground evidence"
              style={{ width: '130px', height: '85px', borderRadius: '6px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
            />
          ) : (
            <div style={{
              width: 130,
              height: 85,
              borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              border: '1px dashed rgba(138,153,168,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem'
            }}>
              {hazard.icon}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ background: '#0F253B', padding: '8px 14px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <span style={{ fontSize: '0.72rem', color: '#93C5FD', display: 'block', fontWeight: 700, letterSpacing: '0.04em' }}>WATER DEPTH</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38BDF8' }}>
                {report.waterDepthFeet ? `${report.waterDepthFeet} ft` : 'Estimated 2.0 ft'}
              </span>
            </div>
            <div style={{ background: '#0F253B', padding: '8px 14px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span style={{ fontSize: '0.72rem', color: '#86EFAC', display: 'block', fontWeight: 700, letterSpacing: '0.04em' }}>CURRENT WORKFLOW</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#34D399' }}>
                {report.currentActionCategory || 'Pending Verification'}
              </span>
            </div>
            <div style={{ background: '#0F253B', padding: '8px 14px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <span style={{ fontSize: '0.72rem', color: '#FDE68A', display: 'block', fontWeight: 700, letterSpacing: '0.04em' }}>DOPPLER AWS CORROBORATION</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#FBBF24' }}>
                {report.severity >= 4 ? '52.0 dBZ Echo (Severe)' : '42.5 dBZ Echo (Moderate)'}
              </span>
            </div>
          </div>
        </div>

        <div style={{
          margin: '0 0 14px',
          fontSize: '0.92rem',
          fontWeight: 600,
          color: '#FFFFFF',
          background: '#152538',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderLeft: '4px solid #38BDF8',
          lineHeight: 1.55
        }}>
          &ldquo;{report.description}&rdquo;
        </div>

        {/* Prominent Action Performed & Live Audit History Trail */}
        <div style={{
          padding: '14px 18px',
          background: report.currentActionCategory && report.currentActionCategory !== 'Pending Verification' 
            ? '#08251B' 
            : '#261B07',
          border: report.currentActionCategory && report.currentActionCategory !== 'Pending Verification'
            ? '2px solid #10B981'
            : '2px solid #F59E0B',
          borderRadius: '10px',
          marginBottom: '16px',
          fontSize: '0.86rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.25rem' }}>
                {report.status === 'RESOLVED' ? '🏁' : report.currentActionCategory?.includes('Evacuation') ? '🚨' : report.currentActionCategory?.includes('Dewatering') ? '🚒' : report.currentActionCategory?.includes('Verified') ? '✅' : '⏳'}
              </span>
              <span style={{
                color: report.status === 'RESOLVED' ? '#34D399' : report.currentActionCategory && report.currentActionCategory !== 'Pending Verification' ? '#34D399' : '#FBBF24',
                fontWeight: 800,
                fontSize: '0.96rem',
                letterSpacing: '0.01em'
              }}>
                {report.currentActionCategory && report.currentActionCategory !== 'Pending Verification' 
                  ? `⚡ Action Performed: ${report.currentActionCategory}` 
                  : '⏳ Initial Action: Pending Ground Verification & Command Directive'}
              </span>
            </div>
            {report.actionHistory && report.actionHistory[0] && (
              <span style={{
                fontSize: '0.8rem',
                color: '#E2E8F0',
                fontWeight: 700,
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.45)',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                Executed: {new Date(report.actionHistory[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {report.actionHistory[0].actorName}
              </span>
            )}
          </div>

          {report.actionHistory && report.actionHistory[0]?.notes && (
            <p style={{
              margin: '8px 0 10px',
              color: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 600,
              background: '#0B1724',
              padding: '10px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              lineHeight: 1.55
            }}>
              <strong style={{ color: '#38BDF8', fontWeight: 800 }}>Operational Directive:</strong> &ldquo;{report.actionHistory[0].notes}&rdquo;
            </p>
          )}

          {/* Chronological Action History Trail if multiple actions exist */}
          {report.actionHistory && report.actionHistory.length > 1 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.18)' }}>
              <span style={{ fontSize: '0.78rem', color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                Workflow Action Trail ({report.actionHistory.length} Steps Recorded):
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {report.actionHistory.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: idx === 0 ? 'rgba(56, 189, 248, 0.18)' : 'rgba(0, 0, 0, 0.35)',
                      border: idx === 0 ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span style={{ color: idx === 0 ? '#38BDF8' : '#FBBF24', fontWeight: 800, fontSize: '0.9rem' }}>{idx === 0 ? '▶' : '•'}</span>
                    <span style={{ fontFamily: 'monospace', color: '#93C5FD', fontWeight: 700, fontSize: '0.82rem' }}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <strong style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.86rem' }}>
                      {item.action}
                    </strong>
                    <span style={{ color: '#CBD5E1', fontSize: '0.82rem', fontWeight: 500 }}>
                      ({item.actorName})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Real-Time Action Confirmation Banner */}
        {recentlyActionedReports[report.id] && (
          <div style={{
            margin: '0 0 16px',
            padding: '14px 18px',
            background: '#062B1D',
            border: '2px solid #10B981',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem' }}>✅</span>
              <div>
                <strong style={{ color: '#4ADE80', fontSize: '0.96rem', fontWeight: 800, display: 'block', letterSpacing: '0.01em' }}>
                  Action Synchronized: {recentlyActionedReports[report.id].action}
                </strong>
                <p style={{ margin: '3px 0 0', fontSize: '0.88rem', color: '#FFFFFF', fontWeight: 600 }}>
                  {recentlyActionedReports[report.id].message}
                </p>
              </div>
            </div>
            {recentlyActionedReports[report.id].targetTab !== activeTab && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveTab(recentlyActionedReports[report.id].targetTab)}
                style={{
                  fontSize: '0.82rem',
                  padding: '6px 14px',
                  fontWeight: 800,
                  background: '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                View in Dedicated Tab →
              </button>
            )}
          </div>
        )}

        {/* Action Controls Tailored by Stage & Hazard Category */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Stage 1: Verification (Right vs Wrong Check) */}
          {(!isGenuine && !isFalseAlarm && !isResolved) && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleTakeReportAction(report.id, 'Verified Genuine — Pending Tactical Action', 'Corroborated against Doppler radar reflectivity and automatic weather station telemetry.')}
                style={{ background: '#059669', borderColor: '#10B981', fontSize: '0.82rem', padding: '7px 14px', fontWeight: 700 }}
              >
                ✓ Verify Genuine (Right Report)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleTakeReportAction(report.id, 'Flagged False Alarm / Dismissed', 'Sensor cross-check shows no corroborating precipitation or runoff at coordinates.')}
                style={{ color: '#EF4444', borderColor: '#EF4444', fontSize: '0.82rem', padding: '7px 14px' }}
              >
                ✕ Flag as False Alarm (Wrong Report)
              </button>
            </>
          )}

          {/* Stage 2 & 3: Tailored Tactical Actions according to Hazard Type */}
          {(isGenuine && !isFalseAlarm && !isResolved) && (
            <>
              {report.category === 'WATERLOGGING' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleTakeReportAction(report.id, 'Dewatering & Municipal Crew Dispatched', 'Dispatched 3x 500HP Dewatering Pumps (45,000 LPM) and traffic police diversions.')}
                    style={{ background: '#0284C7', borderColor: '#38BDF8', fontSize: '0.8rem', padding: '6px 12px', fontWeight: 700 }}
                  >
                    🚒 Deploy Dewatering Pumps (500HP)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Public Warning Issued (CAP 1.2)', 'Published urban waterlogging advisory and transit detour recommendations.')}
                    style={{ color: '#F59E0B', borderColor: '#F59E0B', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    📢 Issue Waterlogging Advisory
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Evacuation Ordered', 'Submerged vehicles and deep water risk; ordered perimeter evacuation.')}
                    style={{ color: '#EF4444', borderColor: '#EF4444', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    🚨 Order Evacuation
                  </button>
                </>
              )}

              {report.category === 'FLOODING' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleTakeReportAction(report.id, 'Evacuation Ordered', 'Critical inundation depth; civil defense high-ground evacuation ordered immediately.')}
                    style={{ background: '#DC2626', borderColor: '#EF4444', fontSize: '0.8rem', padding: '6px 12px', fontWeight: 700 }}
                  >
                    🚨 Mandatory Evacuation Directive
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Search & Rescue Deployed', 'Mobilized NDRF/SDRF motorized inflatable rescue boats and paramedic units.')}
                    style={{ color: '#A78BFA', borderColor: '#A78BFA', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    🚤 Deploy NDRF/SDRF Rescue Boats
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Public Warning Issued (CAP 1.2)', 'Broadcasted official CAP 1.2 emergency flood warning to cellular networks.')}
                    style={{ color: '#F59E0B', borderColor: '#F59E0B', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    📢 Broadcast Flood Siren (CAP)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Dewatering & Municipal Crew Dispatched', 'Dispatched mobile high-volume barrier drainage pumps.')}
                    style={{ color: '#38BDF8', borderColor: '#38BDF8', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    🚒 Deploy Heavy Pumps
                  </button>
                </>
              )}

              {report.category === 'CLOUDBURST' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleTakeReportAction(report.id, 'Evacuation Ordered', 'Catastrophic flash flood velocity; immediate upstream/downstream evacuation ordered.')}
                    style={{ background: '#B91C1C', borderColor: '#EF4444', fontSize: '0.8rem', padding: '6px 12px', fontWeight: 700 }}
                  >
                    🚨 Immediate Flash Flood Evacuation
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Search & Rescue Deployed', 'Dispatched airborne and ground emergency search and rescue teams.')}
                    style={{ color: '#A78BFA', borderColor: '#A78BFA', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    🚤 Mobilize Rapid SAR Teams
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Public Warning Issued (CAP 1.2)', 'Issued RED SIREN emergency alert across all civil broadcasts.')}
                    style={{ color: '#F59E0B', borderColor: '#F59E0B', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    📢 Red Siren Alert Broadcast
                  </button>
                </>
              )}

              {report.category === 'SEVERE_RAIN' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleTakeReportAction(report.id, 'Public Warning Issued (CAP 1.2)', 'Issued severe rainfall advisory; cautioned against underpass transit.')}
                    style={{ background: '#D97706', borderColor: '#F59E0B', fontSize: '0.8rem', padding: '6px 12px', fontWeight: 700 }}
                  >
                    📢 Broadcast Severe Rain Advisory
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Meteorological Monitoring', 'Continuous Doppler AWS radar surveillance active; 5-minute telemetry scan.')}
                    style={{ color: '#38BDF8', borderColor: '#38BDF8', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    🛰️ Activate Doppler AWS Radar Watch
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Dewatering & Municipal Crew Dispatched', 'Standby municipal storm-water drainage units mobilized.')}
                    style={{ color: '#34D399', borderColor: '#34D399', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    🚒 Deploy Standby Dewatering
                  </button>
                </>
              )}

              {report.category === 'STRONG_WIND' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleTakeReportAction(report.id, 'Public Warning Issued (CAP 1.2)', 'Published high-wind and gale storm warning; structural precaution advisory.')}
                    style={{ background: '#4F46E5', borderColor: '#818CF8', fontSize: '0.8rem', padding: '6px 12px', fontWeight: 700 }}
                  >
                    📢 Gale Wind Civil Warning (CAP)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Evacuation Ordered', 'Evacuation ordered for temporary tin roofs and fragile structures.')}
                    style={{ color: '#EF4444', borderColor: '#EF4444', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    🚨 Evacuate Fragile Structures
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Meteorological Monitoring', 'Monitoring automated anemometer network and gust velocities.')}
                    style={{ color: '#38BDF8', borderColor: '#38BDF8', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    🛰️ Anemometer Wind Surveillance
                  </button>
                </>
              )}

              {report.category === 'HAIL' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleTakeReportAction(report.id, 'Public Warning Issued (CAP 1.2)', 'Broadcasted hailstorm impact advisory; vehicle and livestock shelter directive.')}
                    style={{ background: '#7C3AED', borderColor: '#A78BFA', fontSize: '0.8rem', padding: '6px 12px', fontWeight: 700 }}
                  >
                    🚗 Hailstorm Shelter Advisory
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Meteorological Monitoring', 'Tracking severe hail core on Doppler dual-polarization radar.')}
                    style={{ color: '#38BDF8', borderColor: '#38BDF8', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    🛰️ Dual-Polarization Hail Tracking
                  </button>
                </>
              )}

              {report.category === 'OTHER' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleTakeReportAction(report.id, 'Meteorological Monitoring', 'Ground reconnaissance team dispatched for situation assessment.')}
                    style={{ background: '#0284C7', borderColor: '#38BDF8', fontSize: '0.8rem', padding: '6px 12px', fontWeight: 700 }}
                  >
                    🔍 Deploy Field Reconnaissance
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTakeReportAction(report.id, 'Public Warning Issued (CAP 1.2)', 'Published precautionary citizen advisory.')}
                    style={{ color: '#F59E0B', borderColor: '#F59E0B', fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    📢 Public Advisory
                  </button>
                </>
              )}

              {/* Universal Resolution Button */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleTakeReportAction(report.id, 'Hazard Resolved', 'Danger subsided, municipal dewatering/relief complete, corridor restored to safety.')}
                style={{ color: '#34D399', borderColor: '#34D399', fontSize: '0.8rem', padding: '6px 10px' }}
              >
                ✅ Mark Resolved & Clear Corridor
              </button>
            </>
          )}

          {isResolved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: '#34D399', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✅</span> Corridor fully drained and restored to safe public transit.
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const inc = incidents.find(i => i.reports.some(r => r.id === report.id));
                  if (inc) {
                    handleReopenIncident(inc.id);
                  } else {
                    handleTakeReportAction(report.id, 'Pending Verification', 'Hazard re-opened for review.');
                  }
                }}
                style={{ fontSize: '0.78rem', padding: '5px 12px', color: '#F59E0B', borderColor: '#F59E0B', fontWeight: 600 }}
                title="Re-open resolved hazard back to Stage 1 Verification"
              >
                ↩️ Re-open Hazard to Stage 1
              </button>
            </div>
          )}

          {isFalseAlarm && (
            <span style={{ color: '#EF4444', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✕</span> Flagged as inaccurate/false alarm and archived from public feeds.
            </span>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => launchPredictionForReport(report)}
            style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', borderColor: '#38BDF8', fontSize: '0.8rem', padding: '6px 12px', marginLeft: 'auto' }}
          >
            🔮 Predict Future Situation (ML)
          </button>

          <Link
            href={report.location?.latitude != null && report.location?.longitude != null ? `/map?lat=${report.location.latitude}&lng=${report.location.longitude}` : '/map'}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            🗺️ Live Map
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <StaffSidebar activeTab="admin" role="Admin" />

      <main className={styles.main}>
        {/* Toast Notification */}
        {toastMessage && (
          <div className="toast-container">
            <div className="toast glass-card" style={{ background: '#071524', border: '1px solid #38BDF8', color: '#F7F6F2' }}>
              {toastMessage}
            </div>
          </div>
        )}

        {/* Executive Header */}
        <header className={styles.pageHeader}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className={styles.pageTitle} style={{ margin: 0 }}>⚙️ Emergency Administration & Tactical Desk</h1>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38BDF8',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '999px'
              }}>
                Disaster Command Center
              </span>
            </div>
            <p className={styles.pageSubtitle}>
              Workflows segregated by Initial Tactical Action & Ground Truth Verification with Machine-Learning Predictive Disaster Solutions
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchData()}
              disabled={isRefreshing}
              style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>{isRefreshing ? '⏳' : '🔄'}</span>
              <span>{isRefreshing ? 'Syncing…' : 'Sync Live'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextState = !autoSync;
                setAutoSync(nextState);
                showToast(nextState ? 'Auto-Sync enabled (15s gentle interval).' : 'Auto-Sync deactivated.');
              }}
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1px solid ${autoSync ? '#10B981' : 'rgba(148, 163, 184, 0.4)'}`,
                background: autoSync ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                color: autoSync ? '#34D399' : '#94A3B8',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Toggle automatic background sync every 15s"
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: autoSync ? '#10B981' : '#64748B' }} />
              <span>Auto-Sync: {autoSync ? 'ON (15s)' : 'OFF'}</span>
            </button>

            {lastSyncTime && (
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontFamily: 'monospace' }}>
                Synced: {lastSyncTime}
              </span>
            )}

            <button
              type="button"
              onClick={handlePurgeData}
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#FCA5A5',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Clear all test data and return to clean zero-data state"
            >
              <span>🧹</span>
              <span>Purge Demo Data</span>
            </button>

            <Link href="/map" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              🗺️ Open Live Map
            </Link>
            <Link href="/staff/queue" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              📋 Reviewer Queue
            </Link>
          </div>
        </header>

        {/* 🇮🇳 Compact Pan-India Sentinel Executive Bar */}
        <div style={{
          margin: '0 24px 12px',
          background: '#0F172A',
          border: `1px solid ${(indiaRiskScan?.criticalZonesCount || 0) > 0 ? '#EF4444' : '#1E293B'}`,
          borderRadius: '8px',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>🇮🇳</span>
            <div>
              <span style={{ fontSize: '0.88rem', fontWeight: 500, color: '#F8FAFC' }}>
                <strong style={{ color: (indiaRiskScan?.criticalZonesCount || 0) > 0 ? '#F87171' : '#38BDF8', fontWeight: 700 }}>
                  {(indiaRiskScan?.criticalZonesCount || 0) > 0 ? '🚨 SEVERE WEATHER DETECTED' : 'Pan-India Sentinel'}:
                </strong>{' '}
                <span style={{ color: '#E2E8F0' }}>
                  {indiaRiskScan?.nationalExecutiveBriefing || 'Pan-India meteorological surveillance active: Atmospheric conditions are stable across all major hubs.'}
                </span>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '999px',
              background: (indiaRiskScan?.criticalZonesCount || 0) > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.2)',
              color: (indiaRiskScan?.criticalZonesCount || 0) > 0 ? '#FCA5A5' : '#4ADE80',
              border: `1px solid ${(indiaRiskScan?.criticalZonesCount || 0) > 0 ? '#EF4444' : '#22C55E'}`
            }}>
              {(indiaRiskScan?.criticalZonesCount || 0) > 0 ? `🚨 ${indiaRiskScan.criticalZonesCount} Critical Zone(s)` : '✅ 11 Hubs Monitored'}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setActiveTab('sentinel')}
              style={{
                fontSize: '0.78rem',
                padding: '5px 12px',
                borderColor: '#38BDF8',
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.12)',
                fontWeight: 700,
                borderRadius: '6px'
              }}
            >
              Open Dedicated Sentinel Desk →
            </button>
          </div>
        </div>

        {/* Categorized Workflow Navigation Tabs */}
        <div className={styles.adminTabsNav} style={{ overflowX: 'auto', display: 'flex', gap: '6px', paddingBottom: '8px' }}>
          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'all' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <span>🌐 0. Master Feed</span>
            <span className={styles.tabBadge}>{reports.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'sentinel' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('sentinel')}
            style={{
              borderColor: (indiaRiskScan?.criticalZonesCount || 0) > 0 ? '#EF4444' : '#38BDF8',
              background: activeTab === 'sentinel' ? undefined : (indiaRiskScan?.criticalZonesCount || 0) > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.08)'
            }}
          >
            <span>🇮🇳 Dedicated Sentinel (11 Hubs)</span>
            <span className={styles.tabBadge} style={{
              background: (indiaRiskScan?.criticalZonesCount || 0) > 0 ? '#EF4444' : undefined,
              color: (indiaRiskScan?.criticalZonesCount || 0) > 0 ? '#FFF' : undefined
            }}>
              {(indiaRiskScan?.criticalZonesCount || 0) > 0 ? `🚨 ${indiaRiskScan.criticalZonesCount} Alert` : '11 Hubs'}
            </span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'verification' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('verification')}
          >
            <span>🔍 1. Verification (Right/Wrong)</span>
            <span className={styles.tabBadge}>{pendingVerificationReports.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'verified_pending' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('verified_pending')}
          >
            <span>✅ 2. Verified Genuine</span>
            <span className={styles.tabBadge}>{verifiedPendingReports.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'evacuation' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('evacuation')}
          >
            <span>🚨 3. Evacuation Ordered</span>
            <span className={styles.tabBadge}>{evacuationReports.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'dewatering' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('dewatering')}
          >
            <span>🚒 4. Dewatering Dispatched</span>
            <span className={styles.tabBadge}>{dewateringReports.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'cap_warning' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('cap_warning')}
          >
            <span>📢 5. CAP Warning Issued</span>
            <span className={styles.tabBadge}>{capWarningReports.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'sar' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('sar')}
          >
            <span>🚤 6. SAR Deployed</span>
            <span className={styles.tabBadge}>{sarReports.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'monitoring' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('monitoring')}
          >
            <span>🛰️ 7. Sensor Watch</span>
            <span className={styles.tabBadge}>{monitoringReports.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'resolved' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('resolved')}
          >
            <span>🏁 8. Hazard Resolved</span>
            <span className={styles.tabBadge}>{resolvedReports.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'false_alarm' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('false_alarm')}
          >
            <span>❌ 9. False Alarms</span>
            <span className={styles.tabBadge}>{falseAlarmReports.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'prediction' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('prediction')}
          >
            <span>🔮 10. ML Prediction Engine (A to Z)</span>
          </button>

          <button
            type="button"
            className={`${styles.adminTabBtn} ${activeTab === 'system' ? styles.adminTabBtnActive : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <span>📊 11. System Health</span>
          </button>
        </div>

        {/* Section 0: Master Operational Feed (All Reported Hazards) */}
        {activeTab === 'all' && (() => {
          const tacticalCount = evacuationReports.length + dewateringReports.length + capWarningReports.length + sarReports.length + monitoringReports.length;
          const displayedReports = reports.filter(r => {
            if (feedFilter === 'all') return true;
            if (Boolean(recentlyActionedReports[r.id])) return true;
            if (feedFilter === 'pending') return pendingVerificationReports.some(p => p.id === r.id);
            if (feedFilter === 'verified') return verifiedPendingReports.some(p => p.id === r.id);
            if (feedFilter === 'tactical') return (
              evacuationReports.some(p => p.id === r.id) ||
              dewateringReports.some(p => p.id === r.id) ||
              capWarningReports.some(p => p.id === r.id) ||
              sarReports.some(p => p.id === r.id) ||
              monitoringReports.some(p => p.id === r.id)
            );
            if (feedFilter === 'resolved') return resolvedReports.some(p => p.id === r.id);
            if (feedFilter === 'false_alarm') return falseAlarmReports.some(p => p.id === r.id);
            return true;
          });

          return (
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div style={{
                background: '#F0F9FF',
                border: '1px solid #BAE6FD',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '16px',
                boxShadow: '0 1px 3px rgba(2, 132, 199, 0.06)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ margin: 0, color: '#0369A1', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                    <span>🌐</span> Master Operational Command Feed ({reports.length} Total Hazards)
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#0284C7', fontWeight: 600 }}>
                    On-Demand &amp; Configurable Auto-Sync · Instant Stage Transitions
                  </span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55 }}>
                  Unified real-time disaster tactical desk. Every reported hazard is displayed with its active workflow stage, ground photos, and dynamic response actions tailored to hazard classification.
                </p>
              </div>

              {/* Quick Filter Sub-Pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => setFeedFilter('all')}
                  style={{
                    background: feedFilter === 'all' ? '#38BDF8' : 'rgba(11, 31, 51, 0.7)',
                    color: feedFilter === 'all' ? '#071524' : '#E2E8F0',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  All ({reports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('pending')}
                  style={{
                    background: feedFilter === 'pending' ? '#F59E0B' : 'rgba(11, 31, 51, 0.7)',
                    color: feedFilter === 'pending' ? '#000' : '#E2E8F0',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  1. Verification Needed ({pendingVerificationReports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('verified')}
                  style={{
                    background: feedFilter === 'verified' ? '#10B981' : 'rgba(11, 31, 51, 0.7)',
                    color: feedFilter === 'verified' ? '#000' : '#E2E8F0',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  2. Verified Genuine ({verifiedPendingReports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('tactical')}
                  style={{
                    background: feedFilter === 'tactical' ? '#38BDF8' : 'rgba(11, 31, 51, 0.7)',
                    color: feedFilter === 'tactical' ? '#071524' : '#E2E8F0',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  3. Tactical Active ({tacticalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('resolved')}
                  style={{
                    background: feedFilter === 'resolved' ? '#34D399' : 'rgba(11, 31, 51, 0.7)',
                    color: feedFilter === 'resolved' ? '#071524' : '#E2E8F0',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  4. Resolved ({resolvedReports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('false_alarm')}
                  style={{
                    background: feedFilter === 'false_alarm' ? '#EF4444' : 'rgba(11, 31, 51, 0.7)',
                    color: feedFilter === 'false_alarm' ? '#FFF' : '#E2E8F0',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  False Alarms ({falseAlarmReports.length})
                </button>
              </div>

              {displayedReports.length === 0 ? (
                <div className="empty-state" style={{ padding: '48px', background: 'rgba(11, 31, 51, 0.6)', borderRadius: '12px', textAlign: 'center' }}>
                  <span className="empty-state-icon">📡</span>
                  <h3 style={{ color: '#38BDF8' }}>
                    {feedFilter === 'all' ? 'System Standing By · Zero Reported Hazards' : `No hazards matching filter "${feedFilter}"`}
                  </h3>
                  <p style={{ color: '#8A99A8', maxWidth: '460px', margin: '8px auto' }}>
                    Reports filed via the citizen portal or mobile telemetry appear here in real time.
                  </p>
                  {feedFilter !== 'all' ? (
                    <button type="button" onClick={() => setFeedFilter('all')} className="btn btn-secondary" style={{ marginTop: '12px' }}>
                      Show All Hazards ({reports.length})
                    </button>
                  ) : (
                    <Link href="/report" className="btn btn-primary" style={{ marginTop: '12px' }}>
                      + File Ground Truth Report
                    </Link>
                  )}
                </div>
              ) : (
                displayedReports.map(r => renderReportCard(r))
              )}
            </div>
          );
        })()}

        {/* Dedicated Section: Pan-India Real-Time Weather Risk Sentinel (11 Indian Basin Hubs) */}
        {activeTab === 'sentinel' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            {/* Header & Status Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(7, 21, 36, 0.98) 0%, rgba(15, 30, 50, 0.95) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '2rem' }}>🇮🇳</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#F7F6F2', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>Pan-India Real-Time Weather Risk Sentinel</span>
                      <span style={{
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid #22C55E',
                        color: '#22C55E',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }}></span>
                        11 Major Basin Hubs Monitored
                      </span>
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: '#94A3B8' }}>
                      Continuous Doppler radar, satellite precipitation, and wind telemetry across India's most disaster-vulnerable urban, coastal, and river basin sectors.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => fetchSentinelRisk()}
                    style={{ fontSize: '0.82rem', padding: '6px 14px', borderColor: '#38BDF8', color: '#38BDF8', fontWeight: 600 }}
                  >
                    🔄 Refresh Radar Telemetry
                  </button>
                  <Link href="/map" className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                    🗺️ Pan-India Live Map
                  </Link>
                </div>
              </div>

              {/* National Executive Briefing */}
              {indiaRiskScan?.nationalExecutiveBriefing && (
                <div style={{
                  background: (indiaRiskScan?.criticalZonesCount || 0) > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.08)',
                  borderLeft: `4px solid ${(indiaRiskScan?.criticalZonesCount || 0) > 0 ? '#EF4444' : '#38BDF8'}`,
                  padding: '12px 18px',
                  borderRadius: '0 8px 8px 0',
                  marginBottom: '16px',
                  fontSize: '0.9rem',
                  color: '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <strong style={{ color: (indiaRiskScan?.criticalZonesCount || 0) > 0 ? '#FCA5A5' : '#38BDF8' }}>
                      Executive Weather Intelligence:
                    </strong>{' '}
                    {indiaRiskScan.nationalExecutiveBriefing}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                    Telemetry Scan: {new Date(indiaRiskScan.scanTimestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}

              {/* 4 Summary Counters */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginTop: '10px'
              }}>
                <div style={{ background: 'rgba(11, 31, 51, 0.7)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase' }}>Active Hubs</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8' }}>11 Indian Basins</div>
                </div>
                <div style={{ background: 'rgba(11, 31, 51, 0.7)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase' }}>Severe / Critical Alert Hubs</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: (indiaRiskScan?.criticalZonesCount || 0) > 0 ? '#EF4444' : '#34D399' }}>
                    {indiaRiskScan?.criticalZonesCount || 0} Zone(s)
                  </div>
                </div>
                <div style={{ background: 'rgba(11, 31, 51, 0.7)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase' }}>Doppler Radar Network</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F59E0B' }}>Dual-Polarization Live</div>
                </div>
                <div style={{ background: 'rgba(11, 31, 51, 0.7)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: '8px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase' }}>Data Freshness</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34D399' }}>Live Telemetry 60s</div>
                </div>
              </div>
            </div>

            {/* Hub Category Filter Sub-Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setSentinelFilter('all')}
                style={{
                  background: sentinelFilter === 'all' ? '#38BDF8' : 'rgba(11, 31, 51, 0.7)',
                  color: sentinelFilter === 'all' ? '#071524' : '#E2E8F0',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                All 11 Indian Hubs ({indiaRiskScan?.zones?.length || 11})
              </button>
              <button
                type="button"
                onClick={() => setSentinelFilter('critical')}
                style={{
                  background: sentinelFilter === 'critical' ? '#EF4444' : 'rgba(11, 31, 51, 0.7)',
                  color: sentinelFilter === 'critical' ? '#FFF' : '#E2E8F0',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🚨 Critical / High Risk Only ({indiaRiskScan?.zones?.filter((z: any) => z.riskLevel === 'CRITICAL' || z.riskLevel === 'HIGH')?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSentinelFilter('coastal')}
                style={{
                  background: sentinelFilter === 'coastal' ? '#0284C7' : 'rgba(11, 31, 51, 0.7)',
                  color: sentinelFilter === 'coastal' ? '#FFF' : '#E2E8F0',
                  border: '1px solid rgba(2, 132, 199, 0.4)',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🌊 Coastal & Cyclone Sectors (Mumbai, Chennai, Kochi, Bhubaneswar)
              </button>
              <button
                type="button"
                onClick={() => setSentinelFilter('river')}
                style={{
                  background: sentinelFilter === 'river' ? '#10B981' : 'rgba(11, 31, 51, 0.7)',
                  color: sentinelFilter === 'river' ? '#000' : '#E2E8F0',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🏞️ River & Urban Drainage (Kolkata, Guwahati, Hyderabad, Ahmedabad, Bengaluru)
              </button>
              <button
                type="button"
                onClick={() => setSentinelFilter('northern')}
                style={{
                  background: sentinelFilter === 'northern' ? '#F59E0B' : 'rgba(11, 31, 51, 0.7)',
                  color: sentinelFilter === 'northern' ? '#000' : '#E2E8F0',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '6px 14px',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ⛰️ Northern & Mountain Belts (Delhi NCR, Shimla)
              </button>
            </div>

            {/* Grid of Hub Telemetry Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px'
            }}>
              {indiaRiskScan?.zones?.filter((zone: any) => {
                if (sentinelFilter === 'critical') return zone.riskLevel === 'CRITICAL' || zone.riskLevel === 'HIGH';
                if (sentinelFilter === 'coastal') return ['mumbai', 'chennai', 'kochi', 'bhubaneswar'].includes(zone.zoneId);
                if (sentinelFilter === 'river') return ['kolkata', 'guwahati', 'hyderabad', 'ahmedabad', 'bengaluru'].includes(zone.zoneId);
                if (sentinelFilter === 'northern') return ['delhi', 'shimla'].includes(zone.zoneId);
                return true;
              }).map((zone: any) => {
                const isCritical = zone.riskLevel === 'CRITICAL';
                const isHigh = zone.riskLevel === 'HIGH';
                const isModerate = zone.riskLevel === 'MODERATE';
                const statusColor = isCritical ? '#EF4444' : isHigh ? '#F59E0B' : isModerate ? '#38BDF8' : '#34D399';

                return (
                  <div
                    key={zone.zoneId}
                    style={{
                      background: isCritical
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)'
                        : isHigh
                        ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(15, 23, 42, 0.95) 100%)'
                        : 'linear-gradient(135deg, rgba(11, 31, 51, 0.85) 0%, rgba(7, 21, 36, 0.95) 100%)',
                      border: `1px solid ${statusColor}50`,
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#F7F6F2' }}>{zone.zoneName}</h4>
                          <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{zone.state} · {zone.vulnerabilityType?.replace('_', ' ')}</span>
                        </div>
                        <span style={{
                          background: `${statusColor}20`,
                          color: statusColor,
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${statusColor}80`
                        }}>
                          {zone.riskLevel}
                        </span>
                      </div>

                      {/* Live Sensors Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '6px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '8px',
                        borderRadius: '6px',
                        margin: '10px 0',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '0.68rem', color: '#8A99A8', display: 'block' }}>RAIN RATE</span>
                          <strong style={{ color: zone.currentWeather?.rainRateMmH > 5 ? '#EF4444' : '#38BDF8' }}>
                            {zone.currentWeather?.rainRateMmH} mm/h
                          </strong>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '0.68rem', color: '#8A99A8', display: 'block' }}>WIND GUST</span>
                          <strong style={{ color: zone.currentWeather?.windGustKmh > 35 ? '#F59E0B' : '#E2E8F0' }}>
                            {zone.currentWeather?.windGustKmh} km/h
                          </strong>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '0.68rem', color: '#8A99A8', display: 'block' }}>TEMP / HUM</span>
                          <strong style={{ color: '#E2E8F0' }}>
                            {zone.currentWeather?.tempC}°C ({zone.currentWeather?.humidityPct}%)
                          </strong>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginBottom: '6px' }}>
                        <strong>Doppler Status:</strong> {zone.currentWeather?.conditionText}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#94A3B8', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px', borderLeft: `3px solid ${statusColor}` }}>
                        {zone.threatSummary}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <Link
                        href={`/map?lat=${zone.lat}&lng=${zone.lng}`}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '0.78rem', padding: '6px 10px', textAlign: 'center' }}
                      >
                        🗺️ Inspect on Map
                      </Link>
                      <Link
                        href={`/staff/alerts?compose=true&headline=${encodeURIComponent('🚨 REGIONAL ADVISORY: ' + zone.zoneName)}&area=${encodeURIComponent(zone.zoneName)}&severity=${isCritical ? 5 : isHigh ? 4 : 3}&category=SEVERE_RAIN`}
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          fontSize: '0.78rem',
                          padding: '6px 10px',
                          textAlign: 'center',
                          background: isCritical ? '#DC2626' : '#0284C7',
                          borderColor: isCritical ? '#EF4444' : '#38BDF8'
                        }}
                      >
                        📢 Alert Hub
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 1: Verification & Ground Truth Validation (Right vs Wrong Check) */}
        {activeTab === 'verification' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.06)'
            }}>
              <h3 style={{ margin: 0, color: '#0369A1', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                <span>🔍</span> Section 1: Citizen Report Ground Truth Verification (Right vs Wrong Triage)
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55 }}>
                <strong style={{ color: '#075985' }}>Meteorologist Operational Guidance:</strong> Compare newly reported citizen claims against nearest Doppler radar echo and automated rain gauge (AWS) stations. Confirm if the report is <strong style={{ color: '#075985' }}>RIGHT (Genuine Hazard)</strong> or <strong style={{ color: '#075985' }}>WRONG (False Alarm / Exaggeration)</strong>. Once verified, the complainer is updated and tactical responders can order evacuation or dewatering.
              </p>
            </div>

            {pendingVerificationReports.length === 0 && verifiedPendingReports.length === 0 ? (
              <div className="empty-state" style={{ padding: '36px 24px', background: 'rgba(11, 31, 51, 0.6)', borderRadius: '12px', textAlign: 'center' }}>
                <span className="empty-state-icon">✅</span>
                <h3 style={{ color: '#34D399', margin: '8px 0' }}>All Incoming Reports Verified</h3>
                <p style={{ color: '#8A99A8', maxWidth: '480px', margin: '4px auto 16px', fontSize: '0.86rem' }}>
                  No unverified citizen hazard submissions pending. All claims have been corroborated against Doppler AWS radar.
                </p>

                {/* Pipeline Cross-Stage Directory so reports never seem lost */}
                {reports.length > 0 && (
                  <div style={{
                    maxWidth: '640px',
                    margin: '0 auto 20px',
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    padding: '14px',
                    textAlign: 'left'
                  }}>
                    <div style={{ fontSize: '0.78rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Active Hazard Pipeline Status ({reports.length} Reports on Record):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {reports.map((r) => {
                        const stage = getReportStageInfo(r);
                        return (
                          <div key={r.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            background: 'rgba(11, 31, 51, 0.6)',
                            border: `1px solid ${stage.badgeColor}40`,
                            borderRadius: '8px',
                            padding: '8px 12px',
                            flexWrap: 'wrap'
                          }}>
                            <div>
                              <strong style={{ color: '#F7F6F2', fontSize: '0.86rem' }}>
                                📍 {r.landmark || r.category}
                              </strong>
                              <div style={{ fontSize: '0.75rem', color: stage.badgeColor, marginTop: '2px', fontWeight: 600 }}>
                                ● {stage.label}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                  if (r.status === 'RESOLVED') setActiveTab('resolved');
                                  else if (r.status === 'DISMISSED') setActiveTab('false_alarm');
                                  else if (r.verificationStatus === 'VERIFIED_GENUINE') {
                                    if (r.currentActionCategory?.includes('Evacuation')) setActiveTab('evacuation');
                                    else if (r.currentActionCategory?.includes('Dewatering')) setActiveTab('dewatering');
                                    else if (r.currentActionCategory?.includes('Warning')) setActiveTab('cap_warning');
                                    else if (r.currentActionCategory?.includes('SAR') || r.currentActionCategory?.includes('Search')) setActiveTab('sar');
                                    else if (r.currentActionCategory?.includes('Monitoring')) setActiveTab('monitoring');
                                    else setActiveTab('verified_pending');
                                  } else {
                                    setActiveTab('all');
                                  }
                                }}
                                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                              >
                                Jump to Tab →
                              </button>
                              {(r.status === 'RESOLVED' || r.status === 'DISMISSED' || r.verificationStatus === 'VERIFIED_GENUINE') && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    const inc = incidents.find(i => i.reports.some(rep => rep.id === r.id));
                                    if (inc) {
                                      handleReopenIncident(inc.id);
                                    } else {
                                      handleTakeReportAction(r.id, 'Pending Verification', 'Re-opened for ground verification.');
                                    }
                                  }}
                                  style={{ fontSize: '0.75rem', padding: '4px 10px', color: '#F59E0B', borderColor: '#F59E0B' }}
                                  title="Re-open to Stage 1 Verification"
                                >
                                  ↩️ Re-open to Stage 1
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('all')}
                    style={{ fontSize: '0.84rem', padding: '8px 16px' }}
                  >
                    🌐 Open Master Feed ({reports.length})
                  </button>
                </div>
              </div>
            ) : (
              <>
                {pendingVerificationReports.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.84rem', color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                      ⚡ Pending Ground Verification ({pendingVerificationReports.length})
                    </div>
                    {pendingVerificationReports.map(r => renderReportCard(r, true))}
                  </div>
                )}

                {verifiedPendingReports.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      borderRadius: '8px',
                      marginBottom: '14px',
                      flexWrap: 'wrap',
                      gap: '10px',
                      boxShadow: '0 1px 3px rgba(16, 185, 129, 0.06)'
                    }}>
                      <div>
                        <strong style={{ color: '#047857', fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>✅</span> Stage 2: Verified Genuine Hazards Ready for Tactical Action ({verifiedPendingReports.length})
                        </strong>
                        <div style={{ fontSize: '0.82rem', color: '#0F172A', marginTop: '2px' }}>
                          Corroborated against Doppler radar. Deploy municipal pumps or evacuation orders directly below.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setActiveTab('verified_pending')}
                        style={{ fontSize: '0.78rem', padding: '4px 10px', borderColor: '#059669', color: '#047857', background: '#FFFFFF', fontWeight: 700 }}
                      >
                        Open Dedicated Stage 2 Tab ({verifiedPendingReports.length}) →
                      </button>
                    </div>
                    {verifiedPendingReports.map(r => renderReportCard(r))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Section 2: Verified Genuine — Ready for Tactical Order */}
        {activeTab === 'verified_pending' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(16, 185, 129, 0.06)'
            }}>
              <h3 style={{ margin: 0, color: '#047857', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                <span>✅</span> Section 2: Verified Genuine Hazards — Pending Initial Tactical Action
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55 }}>
                <strong style={{ color: '#065F46' }}>Earlier Action Taken:</strong> Confirmed Genuine Hazard by duty meteorologist. <br />
                <strong style={{ color: '#065F46' }}>Recommended Next Steps:</strong> Take the appropriate first action: Order Evacuation (for depth &gt; 3.5 ft), Dispatch 3x 500HP Dewatering Pumps, or Broadcast a Public CAP 1.2 Warning.
              </p>
            </div>

            {verifiedPendingReports.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px', background: 'rgba(11, 31, 51, 0.6)', borderRadius: '12px' }}>
                <span className="empty-state-icon">🛡️</span>
                <h3 style={{ color: '#34D399' }}>No Pending Verified Incidents</h3>
                <p style={{ color: '#8A99A8', maxWidth: '460px', margin: '8px auto' }}>
                  All genuine incidents have been actioned with tactical orders.
                </p>
              </div>
            ) : (
              verifiedPendingReports.map(r => renderReportCard(r))
            )}
          </div>
        )}

        {/* Section 3: First Action Taken: Evacuation Ordered */}
        {activeTab === 'evacuation' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(239, 68, 68, 0.06)'
            }}>
              <h3 style={{ margin: 0, color: '#B91C1C', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                <span>🚨</span> Section 3: First Action Taken — Evacuation Ordered ({evacuationReports.length})
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55 }}>
                <strong style={{ color: '#991B1B' }}>Earlier Action Taken:</strong> Civil authority issued mandatory evacuation for ground floors and commuters. <br />
                <strong style={{ color: '#991B1B' }}>Meteorologist Recommended Next Step:</strong> Run ML Predictive Hydrodynamics to project flood crest arrival time (T-peak). Confirm evacuation assembly shelters are located above +3.5m datum and disconnect local transformer lines.
              </p>
            </div>

            {evacuationReports.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px', background: 'rgba(11, 31, 51, 0.6)', borderRadius: '12px' }}>
                <span className="empty-state-icon">🛡️</span>
                <h3 style={{ color: '#F7F6F2' }}>No Active Evacuation Sectors</h3>
                <p style={{ color: '#8A99A8', maxWidth: '460px', margin: '8px auto' }}>
                  No incidents currently require mandatory citizen evacuation.
                </p>
              </div>
            ) : (
              evacuationReports.map(r => renderReportCard(r))
            )}
          </div>
        )}

        {/* Section 4: First Action Taken: Dewatering & Municipal Pumps Dispatched */}
        {activeTab === 'dewatering' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(56, 189, 248, 0.06)'
            }}>
              <h3 style={{ margin: 0, color: '#0369A1', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                <span>🚒</span> Section 4: First Action Taken — Dewatering & Municipal Crew Dispatched ({dewateringReports.length})
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55 }}>
                <strong style={{ color: '#075985' }}>Earlier Action Taken:</strong> Mobilized 3x 500HP Diesel Pumps (Discharge: 45,000 LPM) and road barricades. <br />
                <strong style={{ color: '#075985' }}>Meteorologist Recommended Next Step:</strong> Track ongoing precipitation rate (mm/h) vs dewatering extraction rate. Ensure 3-tier sandbag barriers hold against sheet flow.
              </p>
            </div>

            {dewateringReports.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px', background: 'rgba(11, 31, 51, 0.6)', borderRadius: '12px' }}>
                <span className="empty-state-icon">🚒</span>
                <h3 style={{ color: '#F7F6F2' }}>No Active Dewatering Missions</h3>
                <p style={{ color: '#8A99A8', maxWidth: '460px', margin: '8px auto' }}>
                  No active dewatering orders currently deployed.
                </p>
              </div>
            ) : (
              dewateringReports.map(r => renderReportCard(r))
            )}
          </div>
        )}

        {/* Section 5: First Action Taken: Public Warning Issued (CAP 1.2) */}
        {activeTab === 'cap_warning' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(245, 158, 11, 0.06)'
            }}>
              <h3 style={{ margin: 0, color: '#B45309', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                <span>📢</span> Section 5: First Action Taken — Public Warning Issued (CAP 1.2) ({capWarningReports.length})
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55 }}>
                <strong style={{ color: '#92400E' }}>Earlier Action Taken:</strong> Broadcasted Common Alerting Protocol (CAP 1.2) alert to public stream. <br />
                <strong style={{ color: '#92400E' }}>Meteorologist Recommended Next Step:</strong> Monitor citizen cell feedback and traffic diversions. If rainfall exceeds 35 mm/h, escalate directly to Phase 2 dewatering or evacuation.
              </p>
            </div>

            {capWarningReports.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px', background: 'rgba(11, 31, 51, 0.6)', borderRadius: '12px' }}>
                <span className="empty-state-icon">📢</span>
                <h3 style={{ color: '#F7F6F2' }}>No Active Public Warnings</h3>
                <p style={{ color: '#8A99A8', maxWidth: '460px', margin: '8px auto' }}>
                  No warnings currently categorized under this primary action.
                </p>
              </div>
            ) : (
              capWarningReports.map(r => renderReportCard(r))
            )}
          </div>
        )}

        {/* Section 6: First Action Taken: Search & Rescue Deployed */}
        {activeTab === 'sar' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              background: '#F5F3FF',
              border: '1px solid #DDD6FE',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(124, 58, 237, 0.06)'
            }}>
              <h3 style={{ margin: 0, color: '#6D28D9', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                <span>🚤</span> Section 6: First Action Taken — Search & Rescue / SDRF Deployed ({sarReports.length})
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55 }}>
                <strong style={{ color: '#5B21B6' }}>Earlier Action Taken:</strong> SDRF rescue boats and emergency triage medical camp staged. <br />
                <strong style={{ color: '#5B21B6' }}>Meteorologist Recommended Next Step:</strong> Maintain continuous 10-minute Doppler wind gust watch to protect rescue personnel in open flood currents.
              </p>
            </div>

            {sarReports.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px', background: 'rgba(11, 31, 51, 0.6)', borderRadius: '12px' }}>
                <span className="empty-state-icon">🚤</span>
                <h3 style={{ color: '#F7F6F2' }}>No Active SAR Deployments</h3>
                <p style={{ color: '#8A99A8', maxWidth: '460px', margin: '8px auto' }}>
                  No emergency boat rescue deployments required at this moment.
                </p>
              </div>
            ) : (
              sarReports.map(r => renderReportCard(r))
            )}
          </div>
        )}

        {/* Section 7: First Action Taken: Meteorological Monitoring */}
        {activeTab === 'monitoring' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.06)'
            }}>
              <h3 style={{ margin: 0, color: '#0369A1', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                <span>🛰️</span> Section 7: First Action Taken — Meteorological Sensor Watch ({monitoringReports.length})
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55 }}>
                <strong style={{ color: '#075985' }}>Earlier Action Taken:</strong> Established high-frequency telemetry polling. <br />
                <strong style={{ color: '#075985' }}>Meteorologist Recommended Next Step:</strong> Re-run SCS-CN soil saturation index if precipitation intensifies past 25mm/h.
              </p>
            </div>

            {monitoringReports.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px', background: 'rgba(11, 31, 51, 0.6)', borderRadius: '12px' }}>
                <span className="empty-state-icon">🛰️</span>
                <h3 style={{ color: '#F7F6F2' }}>No Dedicated Monitoring Watchlists</h3>
                <p style={{ color: '#8A99A8', maxWidth: '460px', margin: '8px auto' }}>
                  All sensory data is streaming normally.
                </p>
              </div>
            ) : (
              monitoringReports.map(r => renderReportCard(r))
            )}
          </div>
        )}

        {/* Section 8: First Action Taken: Hazard Resolved & Cleared */}
        {activeTab === 'resolved' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(16, 185, 129, 0.06)'
            }}>
              <h3 style={{ margin: 0, color: '#047857', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                <span>🏁</span> Section 8: First Action Taken — Hazard Resolved & Corridor Restored ({resolvedReports.length})
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55 }}>
                <strong style={{ color: '#065F46' }}>Earlier Action Taken:</strong> Hazard marked as resolved and corridor cleared. <br />
                <strong style={{ color: '#065F46' }}>Meteorologist Recommended Next Step:</strong> Verify post-recession silt clearance and confirm electrical safety clearance before de-escalation archive.
              </p>
            </div>

            {resolvedReports.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px', background: 'rgba(11, 31, 51, 0.6)', borderRadius: '12px' }}>
                <span className="empty-state-icon">🏁</span>
                <h3 style={{ color: '#F7F6F2' }}>No Resolved Incidents In Current Shift</h3>
                <p style={{ color: '#8A99A8', maxWidth: '460px', margin: '8px auto' }}>
                  Incidents marked as resolved will appear here with complete audit trail.
                </p>
              </div>
            ) : (
              resolvedReports.map(r => renderReportCard(r))
            )}
          </div>
        )}

        {/* Section 9: Flagged False Alarm / Dismissed (Wrong Report) */}
        {activeTab === 'false_alarm' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(100, 116, 139, 0.06)'
            }}>
              <h3 style={{ margin: 0, color: '#334155', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                <span>❌</span> Section 9: Flagged as False Alarm / Dismissed (Wrong Citizen Reports) ({falseAlarmReports.length})
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '0.86rem', color: '#0F172A', lineHeight: 1.55 }}>
                <strong style={{ color: '#1E293B' }}>Reviewer Finding:</strong> Reports rejected as inaccurate, duplicate, or absent hazard upon Doppler AWS radar cross-reference. Complainer tracking displays the explanation and no municipal resources were wasted.
              </p>
            </div>

            {falseAlarmReports.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px', background: 'rgba(11, 31, 51, 0.6)', borderRadius: '12px' }}>
                <span className="empty-state-icon">🛡️</span>
                <h3 style={{ color: '#F7F6F2' }}>No False Alarms Flagged</h3>
                <p style={{ color: '#8A99A8', maxWidth: '460px', margin: '8px auto' }}>
                  No spurious or false hazard reports on record.
                </p>
              </div>
            ) : (
              falseAlarmReports.map(r => renderReportCard(r))
            )}
          </div>
        )}

        {/* Tab 3: Predictive Future Situation & Solutions Engine (A to Z) */}
        {activeTab === 'prediction' && (
          <div className={styles.predictionContainer}>
            {/* Simulation Header & Selector */}
            <div className={styles.predictionHeaderBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.4rem' }}>🔮</span>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#F7F6F2' }}>
                      Hydrodynamic Future Disaster Prediction & A-to-Z Action Engine
                    </h2>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#94A3B8', maxWidth: '780px' }}>
                    Calculates real-time hydrodynamic runoff, depression inundation accumulation, and flood cresting trajectories (+1h, +3h, +6h, +12h, +24h) with an end-to-end municipal and citizen solution playbook.
                  </p>
                </div>
                <div style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  textAlign: 'right'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#8A99A8', textTransform: 'uppercase' }}>Model Confidence</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34D399' }}>
                    {predictionResult?.modelConfidencePct || 94}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#38BDF8' }}>SCS-CN + Hydrodynamic ML</div>
                </div>
              </div>

              {/* Live Open-Meteo High-Resolution Atmospheric Sync Banner */}
              {predictionResult?.liveWeatherTelemetry && (
                <div style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginTop: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px #22C55E' }}></span>
                    <strong style={{ color: '#22C55E', fontSize: '12px' }}>
                      LIVE METEOROLOGICAL TELEMETRY SYNCED (Open-Meteo High-Resolution Model)
                    </strong>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#E2E8F0', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    <span>🌡️ Temp: <strong>{predictionResult.liveWeatherTelemetry.temperatureC}°C</strong></span>
                    <span>💧 Humidity: <strong>{predictionResult.liveWeatherTelemetry.relativeHumidity}%</strong></span>
                    <span>💨 Wind: <strong>{predictionResult.liveWeatherTelemetry.windSpeedKmh} km/h</strong></span>
                    <span>🌧️ Live Rain: <strong>{predictionResult.liveWeatherTelemetry.rainRateMmH} mm/h</strong></span>
                    <span>📊 24h Projected Rain: <strong>{predictionResult.liveWeatherTelemetry.forecast24hTotalMm} mm</strong></span>
                  </div>
                </div>
              )}

              {/* Simulation Controls */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(138, 153, 168, 0.2)'
              }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8A99A8', textTransform: 'uppercase' }}>
                    Select Hazard Hotspot
                  </label>
                  <select
                    className="input select"
                    style={{ width: '100%', marginTop: '6px', fontSize: '0.85rem' }}
                    value={selectedHotspot}
                    onChange={(e) => {
                      setSelectedHotspot(e.target.value);
                      if (e.target.value === 'minto') { setCustomWaterDepth(4.5); setCustomRainRate(58); }
                      if (e.target.value === 'hindmata') { setCustomWaterDepth(3.5); setCustomRainRate(62); }
                      if (e.target.value === 'bellandur') { setCustomWaterDepth(3.2); setCustomRainRate(48); }
                      if (e.target.value === 'shimla') { setCustomWaterDepth(1.5); setCustomRainRate(74); }
                    }}
                  >
                    <option value="minto">📍 Delhi — Minto Bridge Underpass (Bowl Depression)</option>
                    <option value="hindmata">📍 Mumbai — Hindmata Dadar Flyover Basin (Coastal Tide)</option>
                    <option value="bellandur">📍 Bengaluru — Bellandur ORR Tech Corridor (Lake Overflow)</option>
                    <option value="shimla">📍 Shimla — Dhalli Tunnel Highway NH-5 (Hillslope Debris)</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8A99A8', textTransform: 'uppercase' }}>
                      Current Water Depth: {customWaterDepth} ft
                    </label>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="8.0"
                    step="0.1"
                    value={customWaterDepth}
                    onChange={(e) => setCustomWaterDepth(parseFloat(e.target.value))}
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8A99A8', textTransform: 'uppercase' }}>
                      Rainfall Intensity: {customRainRate} mm/h
                    </label>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="1"
                    value={customRainRate}
                    onChange={(e) => setCustomRainRate(parseFloat(e.target.value))}
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                </div>
              </div>
            </div>

            {predictionResult && (
              <>
                {/* Future Inundation Trajectory Cards (+1h, +3h, +6h, +12h, +24h) */}
                <div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: '#F7F6F2' }}>
                    📈 Inundation & Receding Trajectory Forecast (+1h to +24h)
                  </h3>
                  <div className={styles.trajectoryGrid}>
                    {predictionResult.trajectory.map((point) => {
                      const isDanger = point.inundationDangerLevel === 'LIFE_THREATENING';
                      const isWarning = point.inundationDangerLevel === 'DANGEROUS';
                      const color = isDanger ? '#EF4444' : isWarning ? '#F59E0B' : '#38BDF8';

                      return (
                        <div
                          key={point.timeHorizon}
                          className={styles.trajectoryCard}
                          style={{ borderColor: isDanger ? 'rgba(239, 68, 68, 0.4)' : undefined }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color }}>{point.timeHorizon}</span>
                            <span style={{ fontSize: '0.75rem', color: '#8A99A8' }}>{point.timestamp}</span>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#8A99A8' }}>FORECAST DEPTH</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>
                              {point.forecastWaterDepthFeet} ft
                            </div>
                            <div style={{ fontSize: '0.72rem', color: point.depthDeltaFeet >= 0 ? '#EF4444' : '#34D399' }}>
                              {point.depthDeltaFeet >= 0 ? `▲ +${point.depthDeltaFeet} ft surge` : `▼ ${point.depthDeltaFeet} ft receding`}
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid rgba(138,153,168,0.15)', paddingTop: '6px' }}>
                            <div style={{ fontSize: '0.68rem', color: '#8A99A8' }}>RAIN RATE</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F7F6F2' }}>
                              {point.forecastRainMmH} mm/h
                            </div>
                          </div>

                          <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '3px 6px',
                            borderRadius: '4px',
                            background: isDanger ? 'rgba(239,68,68,0.2)' : 'rgba(56,189,248,0.15)',
                            color,
                            marginTop: '4px'
                          }}>
                            {point.roadPassability.replace(/_/g, ' ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cascading Risk Scorer */}
                <div style={{
                  background: 'rgba(11, 31, 51, 0.75)',
                  border: '1px solid rgba(138, 153, 168, 0.2)',
                  borderRadius: '10px',
                  padding: '16px'
                }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#F7F6F2' }}>
                    ⚡ Cascading Secondary Disaster Probability Model
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>⚡ Electrocution / Substation Trip</span>
                        <strong style={{ color: '#EF4444' }}>{predictionResult.cascadingRisks.electrocutionRiskPct}%</strong>
                      </div>
                      <div className="confidence-bar">
                        <div className="confidence-bar-fill" style={{ width: `${predictionResult.cascadingRisks.electrocutionRiskPct}%`, background: '#EF4444' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>🚗 Vehicle Float & Submergence</span>
                        <strong style={{ color: '#F59E0B' }}>{predictionResult.cascadingRisks.vehicleFloatRiskPct}%</strong>
                      </div>
                      <div className="confidence-bar">
                        <div className="confidence-bar-fill" style={{ width: `${predictionResult.cascadingRisks.vehicleFloatRiskPct}%`, background: '#F59E0B' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>🏔️ Slope / Structural Scouring</span>
                        <strong style={{ color: '#38BDF8' }}>{predictionResult.cascadingRisks.structuralSlopeFailurePct}%</strong>
                      </div>
                      <div className="confidence-bar">
                        <div className="confidence-bar-fill" style={{ width: `${predictionResult.cascadingRisks.structuralSlopeFailurePct}%`, background: '#38BDF8' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>🧪 Waterborne Disease / Sewage Backflow</span>
                        <strong style={{ color: '#A78BFA' }}>{predictionResult.cascadingRisks.waterborneContaminationPct}%</strong>
                      </div>
                      <div className="confidence-bar">
                        <div className="confidence-bar-fill" style={{ width: `${predictionResult.cascadingRisks.waterborneContaminationPct}%`, background: '#A78BFA' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* A to Z Action Solution Playbook */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#F7F6F2' }}>
                      🛡️ Comprehensive A-to-Z Prescriptive Solutions Playbook
                    </h3>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => showToast('📢 Public Safety Directive broadcasted to all citizen channels!')}
                    >
                      📢 Broadcast Complete Solution Advisory to Citizens
                    </button>
                  </div>

                  <div className={styles.solutionPlaybookGrid}>
                    {/* Phase A: Citizen Life Protection */}
                    <div className={styles.solutionCard} style={{ borderLeft: '3px solid #EF4444' }}>
                      <h4 style={{ margin: '0 0 8px', color: '#EF4444', fontSize: '0.95rem' }}>
                        {predictionResult.solutions.phaseA_Citizen.title}
                      </h4>
                      <p style={{ fontSize: '0.82rem', color: '#E2E8F0', lineHeight: 1.45 }}>
                        {predictionResult.solutions.phaseA_Citizen.immediateEvacuationAdvisory}
                      </p>
                      <div style={{ marginTop: '8px' }}>
                        <strong style={{ fontSize: '0.75rem', color: '#FBBF24' }}>ACTION CHECKLIST:</strong>
                        <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '0.78rem', color: '#CBD5E1' }}>
                          {predictionResult.solutions.phaseA_Citizen.dosAndDonts.map((item, idx) => (
                            <li key={idx} style={{ marginBottom: '3px' }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Phase B: Municipal Dewatering */}
                    <div className={styles.solutionCard} style={{ borderLeft: '3px solid #38BDF8' }}>
                      <h4 style={{ margin: '0 0 8px', color: '#38BDF8', fontSize: '0.95rem' }}>
                        {predictionResult.solutions.phaseB_MunicipalDewatering.title}
                      </h4>
                      <div style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        padding: '8px',
                        borderRadius: '6px',
                        marginBottom: '8px',
                        fontSize: '0.82rem'
                      }}>
                        <strong>Engineering Specification:</strong> Deploy{' '}
                        <span style={{ color: '#38BDF8', fontWeight: 800 }}>
                          {predictionResult.solutions.phaseB_MunicipalDewatering.pumpUnitsRecommended}x{' '}
                          {predictionResult.solutions.phaseB_MunicipalDewatering.pumpCapacityHpRequired} HP
                        </span>{' '}
                        High-Pressure Diesel Dewatering Pumps ({predictionResult.solutions.phaseB_MunicipalDewatering.dischargeCapacityLpm.toLocaleString()} LPM capacity).
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#CBD5E1', margin: 0 }}>
                        {predictionResult.solutions.phaseB_MunicipalDewatering.sandbagBarrierLine}
                      </p>
                    </div>

                    {/* Phase C: Traffic Police Road Interdiction */}
                    <div className={styles.solutionCard} style={{ borderLeft: '3px solid #F59E0B' }}>
                      <h4 style={{ margin: '0 0 8px', color: '#F59E0B', fontSize: '0.95rem' }}>
                        {predictionResult.solutions.phaseC_TrafficPolice.title}
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {predictionResult.solutions.phaseC_TrafficPolice.exactBlockadeLocations.map((loc, idx) => (
                          <div key={idx}>🛑 <strong>Barricade:</strong> {loc}</div>
                        ))}
                        {predictionResult.solutions.phaseC_TrafficPolice.arterialDiversionRoutes.map((route, idx) => (
                          <div key={idx}>↪️ <strong>Diversion:</strong> {route}</div>
                        ))}
                      </div>
                    </div>

                    {/* Phase D: Search and Rescue */}
                    <div className={styles.solutionCard} style={{ borderLeft: '3px solid #34D399' }}>
                      <h4 style={{ margin: '0 0 8px', color: '#34D399', fontSize: '0.95rem' }}>
                        {predictionResult.solutions.phaseD_SearchAndRescue.title}
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {predictionResult.solutions.phaseD_SearchAndRescue.sdrfBoatStagingLocations.map((stg, idx) => (
                          <div key={idx}>🚤 {stg}</div>
                        ))}
                        <div>🏥 <strong>Triage Relief:</strong> {predictionResult.solutions.phaseD_SearchAndRescue.emergencyMedicalReliefStation}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 4: System Health & Zero API Key Transparency */}
        {activeTab === 'system' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            {/* Free Service Transparency Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 78, 59, 0.2))',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <span style={{ fontSize: '2rem' }}>🌐</span>
              <div>
                <h4 style={{ margin: 0, color: '#34D399', fontSize: '1.05rem' }}>
                  100% Free Open Service Architecture — Zero API Keys Required
                </h4>
                <p style={{ margin: '4px 0 0', color: '#E2E8F0', fontSize: '0.82rem' }}>
                  All platform tiles and forecasts are powered by completely free, open-access public endpoints. No commercial API keys, credits, or paid subscriptions are needed.
                </p>
              </div>
            </div>

            <div className={styles.adminGrid} style={{ padding: 0 }}>
              {/* Free API Transparency Matrix */}
              <div className={styles.adminCard}>
                <h3 className={styles.adminCardTitle}>📡 Free Open API Services</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { name: 'Street View Tiles', provider: 'CartoDB Voyager', key: '0 Keys (Free & Open)', status: 'ACTIVE' },
                    { name: 'Satellite Photography', provider: 'Esri World Imagery', key: '0 Keys (Free & Open)', status: 'ACTIVE' },
                    { name: 'Tactical Radar Tiles', provider: 'CartoDB Dark Matter', key: '0 Keys (Free & Open)', status: 'ACTIVE' },
                    { name: 'Live Weather Telemetry', provider: 'Open-Meteo Global Models', key: '0 Keys (Free Open Data)', status: 'ACTIVE' },
                    { name: 'Indian Geocoding', provider: 'Open-Meteo Indian Gazetteer', key: '0 Keys (Free Open Data)', status: 'ACTIVE' },
                  ].map((service) => (
                    <div key={service.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(138,153,168,0.15)' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F7F6F2' }}>{service.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#8A99A8' }}>{service.provider} · {service.key}</div>
                      </div>
                      <span className="badge badge-success">{service.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Platform Stats */}
              <div className={styles.adminCard}>
                <h3 className={styles.adminCardTitle}>📊 Real-Time Operations</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Total Citizen Reports', value: reports.length },
                    { label: 'Pending Incident Candidates', value: stats.pendingReview || 0 },
                    { label: 'Active Public Alerts', value: stats.activeAlerts || 0 },
                    { label: 'Escalated Emergencies', value: escalatedIncidents.length },
                    { label: 'Median Verification Latency', value: '4.2 min' },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(138,153,168,0.15)' }}>
                      <span style={{ fontSize: '0.82rem', color: '#8A99A8' }}>{item.label}</span>
                      <strong style={{ fontSize: '0.95rem', color: '#38BDF8' }}>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Log */}
              <div className={styles.adminCard} style={{ gridColumn: '1 / -1' }}>
                <h3 className={styles.adminCardTitle}>📜 Audit Trail</h3>
                <div className={styles.auditLogList}>
                  {auditLog.slice(0, 15).map((event) => (
                    <div key={event.id} className={styles.auditLogItem}>
                      <span style={{ color: '#38BDF8', fontWeight: 700 }}>{event.action}</span>
                      <span>{event.entityType}/{event.entityId.slice(0, 10)}</span>
                      <span style={{ color: '#8A99A8', marginLeft: 'auto' }}>
                        {new Date(event.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
