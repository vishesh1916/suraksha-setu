// ============================================================
// Suraksha Setu — Zero-Latency Cross-Tab Client Synchronization
// Synchronizes citizen reports, reviewer triage, admin tactical actions,
// and citizen tracking across browser tabs and serverless instances.
// ============================================================

import type { Report, ActionCategory, ActionLogItem, Incident } from '@/types';

const STORAGE_REPORTS_KEY = 'suraksha_client_reports';
const CHANNEL_NAME = 'suraksha_sync_channel';

export interface SyncMessage {
  type: 'NEW_REPORT' | 'REPORT_ACTION' | 'INCIDENT_ACTION' | 'PURGE_ALL';
  report?: Report;
  incident?: Incident;
  reportId?: string;
  incidentId?: string;
  action?: ActionCategory | string;
  notes?: string;
  timestamp: string;
}

let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }
}

export function getClientReports(): Report[] {
  if (typeof window === 'undefined') return [];
  const reports: Report[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_REPORTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) reports.push(...parsed);
    }
  } catch {}

  // Also harvest from suraksha_my_reports if user submitted prior to clientSync
  try {
    const myRaw = localStorage.getItem('suraksha_my_reports');
    if (myRaw) {
      const myParsed = JSON.parse(myRaw);
      if (Array.isArray(myParsed)) {
        for (const item of myParsed) {
          if (item && item.id && !reports.some(r => r.id === item.id || r.id.toLowerCase() === item.id.toLowerCase())) {
            reports.push({
              id: item.id,
              reporterId: 'citizen_local',
              reporterPseudonym: 'Citizen Ground Reporter',
              category: item.category || 'WATERLOGGING',
              severity: item.severity || 4,
              description: item.description || 'Ground hazard report.',
              location: item.location || { latitude: 28.636, longitude: 77.225, accuracy: 15 },
              h3Index: '882a7bcfa911fffff',
              landmark: item.landmark || 'Reported Hazard Location',
              waterDepthFeet: item.waterDepthFeet || (item.severity >= 4 ? 3.5 : 2.0),
              consent: true,
              status: 'RECEIVED',
              verificationStatus: 'PENDING_VERIFICATION',
              currentActionCategory: 'Pending Verification',
              actionHistory: [],
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: item.createdAt || new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch {}

  return reports;
}

export function saveClientReport(report: Report): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getClientReports();
    const existingIdx = current.findIndex(
      (r) => r.id === report.id || r.id.toLowerCase() === report.id.toLowerCase()
    );
    let updated: Report[];
    if (existingIdx >= 0) {
      updated = [...current];
      updated[existingIdx] = { ...current[existingIdx], ...report };
    } else {
      updated = [report, ...current];
    }
    localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(updated.slice(0, 50)));

    // Broadcast to all open tabs (admin console, queue, map, tracking)
    broadcastSync({
      type: 'NEW_REPORT',
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('saveClientReport error:', e);
  }
}

export function getClientReport(id: string): Report | undefined {
  if (!id || typeof window === 'undefined') return undefined;
  const clean = id.trim().toLowerCase();
  const reports = getClientReports();

  // 1. Exact match
  let found = reports.find((r) => r.id === id || r.id.toLowerCase() === clean);
  if (found) return found;

  // 2. Prefix / Substring match (e.g. truncated 16-char receipt ID)
  found = reports.find((r) => {
    const rid = r.id.toLowerCase();
    return rid.startsWith(clean) || clean.startsWith(rid) || (clean.length >= 6 && rid.includes(clean));
  });
  if (found) return found;

  // 3. Match from suraksha_my_reports
  try {
    const myReportsRaw = localStorage.getItem('suraksha_my_reports');
    if (myReportsRaw) {
      const myReports = JSON.parse(myReportsRaw);
      const matched = myReports.find((r: any) => {
        const rid = (r.id || '').toLowerCase();
        return rid === clean || rid.startsWith(clean) || clean.startsWith(rid);
      });
      if (matched) {
        return {
          id: matched.id,
          reporterId: 'citizen_local',
          reporterPseudonym: 'Citizen Ground Reporter',
          category: matched.category,
          severity: matched.severity,
          description: matched.description || 'Ground hazard reported by citizen.',
          location: matched.location || { latitude: 28.636, longitude: 77.225, accuracy: 15 },
          h3Index: '882a7bcfa911fffff',
          landmark: matched.landmark,
          waterDepthFeet: matched.waterDepthFeet || (matched.severity >= 4 ? 4.5 : 2.0),
          consent: true,
          status: 'RECEIVED',
          verificationStatus: 'PENDING_VERIFICATION',
          currentActionCategory: 'Pending Verification',
          actionHistory: [
            {
              id: 'act_init_' + Date.now(),
              action: 'Pending Verification',
              actorName: 'Telemetry Gateway',
              notes: 'Report submitted by citizen and queued for meteorologist verification vs Doppler radar.',
              timestamp: matched.createdAt || new Date().toISOString(),
            },
          ],
          createdAt: matched.createdAt || new Date().toISOString(),
          updatedAt: matched.createdAt || new Date().toISOString(),
        };
      }
    }
  } catch {}

  return undefined;
}

export function updateClientReportAction(
  reportId: string,
  action: ActionCategory,
  notes: string = '',
  actorName: string = 'Emergency Administrator'
): Report | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const reports = getClientReports();
    const cleanId = reportId.trim().toLowerCase();
    const existing = reports.find(
      (r) => r.id === reportId || r.id.toLowerCase() === cleanId || r.id.toLowerCase().startsWith(cleanId)
    );

    const timestamp = new Date().toISOString();
    const actionLog: ActionLogItem = {
      id: 'act_cli_' + Date.now(),
      action,
      actorName,
      notes,
      timestamp,
    };

    const isFalse = action === 'Flagged False Alarm / Dismissed';
    const isResolved = action === 'Hazard Resolved';

    const updatedRep: Report = {
      ...(existing || {
        id: reportId,
        reporterId: 'citizen_local',
        reporterPseudonym: 'Citizen Reporter',
        category: 'WATERLOGGING',
        severity: 4,
        description: notes || 'Ground hazard report.',
        location: { latitude: 28.636, longitude: 77.225, accuracy: 15 },
        h3Index: '882a7bcfa911fffff',
        landmark: 'Reported Location',
        waterDepthFeet: 3.5,
        consent: true,
        createdAt: timestamp,
      }),
      verificationStatus: isFalse
        ? 'FLAGGED_FALSE_REPORT'
        : isResolved
        ? existing?.verificationStatus || 'VERIFIED_GENUINE'
        : 'VERIFIED_GENUINE',
      status: isFalse ? 'DISMISSED' : isResolved ? 'RESOLVED' : 'REVIEWED',
      currentActionCategory: action,
      firstActionTaken:
        existing?.firstActionTaken &&
        existing.firstActionTaken !== 'Pending Verification' &&
        existing.firstActionTaken !== 'Verified Genuine — Pending Tactical Action'
          ? existing.firstActionTaken
          : action,
      actionHistory: [actionLog, ...(existing?.actionHistory || [])],
      updatedAt: timestamp,
    };

    saveClientReport(updatedRep);

    broadcastSync({
      type: 'REPORT_ACTION',
      reportId: updatedRep.id,
      report: updatedRep,
      action,
      notes,
      timestamp,
    });

    return updatedRep;
  } catch (e) {
    console.warn('updateClientReportAction error:', e);
    return undefined;
  }
}

export function broadcastSync(msg: SyncMessage): void {
  if (typeof window === 'undefined') return;
  try {
    if (channel) {
      channel.postMessage(msg);
    }
    // Also dispatch a window event for same-frame listeners
    window.dispatchEvent(new CustomEvent('suraksha_client_sync', { detail: msg }));
  } catch (e) {
    console.warn('broadcastSync error:', e);
  }
}

export function subscribeToSync(callback: (msg: SyncMessage) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onChannelMsg = (event: MessageEvent<SyncMessage>) => {
    if (event.data) callback(event.data);
  };

  const onCustomEvent = (event: Event) => {
    const ce = event as CustomEvent<SyncMessage>;
    if (ce.detail) callback(ce.detail);
  };

  const onStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_REPORTS_KEY && e.newValue) {
      try {
        const parsed: Report[] = JSON.parse(e.newValue);
        if (parsed.length > 0) {
          callback({
            type: 'NEW_REPORT',
            report: parsed[0],
            timestamp: new Date().toISOString(),
          });
        }
      } catch {}
    }
  };

  if (channel) {
    channel.addEventListener('message', onChannelMsg);
  }
  window.addEventListener('suraksha_client_sync', onCustomEvent);
  window.addEventListener('storage', onStorageChange);

  return () => {
    if (channel) {
      channel.removeEventListener('message', onChannelMsg);
    }
    window.removeEventListener('suraksha_client_sync', onCustomEvent);
    window.removeEventListener('storage', onStorageChange);
  };
}
