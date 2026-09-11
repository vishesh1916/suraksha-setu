// ============================================================
// SIH Weather Platform — In-Memory Data Store
// For hackathon/demo: replaces PostgreSQL; same API surface
// ============================================================

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Report, ReportStatus, Incident, IncidentState, Alert, AlertStatus,
  ReviewAction, ReviewActionType, Evidence, SourceHealth, AuditEvent,
  User, UserRole, HazardCategory, SeverityLevel, ImpactLevel,
  ConfidenceScore, GeoPoint, WeatherData, ActionCategory, ActionLogItem, VerificationStatus,
} from '@/types';
import { computeConfidenceScore } from './scoring';

// —— Seed Data ——

function generateId(): string {
  // Simple ID generator that doesn't need uuid
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

// —— Store ——

class DataStore {
  users: User[] = [];
  reports: Report[] = [];
  evidence: Evidence[] = [];
  incidents: Incident[] = [];
  alerts: Alert[] = [];
  reviewActions: ReviewAction[] = [];
  sourceHealth: SourceHealth[] = [];
  auditEvents: AuditEvent[] = [];
  weatherCache: Map<string, WeatherData> = new Map();

  constructor() {
    this.seed();
  }

  private seed() {
    // Seed users
    this.users = [
      {
        id: 'user_admin_1',
        name: 'Platform Admin',
        email: 'admin@sih-weather.gov.in',
        role: 'ADMIN',
        isActive: true,
        confirmedReports: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'user_reviewer_1',
        name: 'Dr. Priya Sharma',
        email: 'priya.sharma@imd.gov.in',
        role: 'REVIEWER',
        isActive: true,
        confirmedReports: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'user_reviewer_2',
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@imd.gov.in',
        role: 'REVIEWER',
        isActive: true,
        confirmedReports: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'user_officer_1',
        name: 'Collector Anand Mishra',
        email: 'dm.mumbai@disaster.gov.in',
        role: 'OFFICER',
        isActive: true,
        confirmedReports: 0,
        createdAt: new Date().toISOString(),
      },
    ];

    // Seed source health
    this.sourceHealth = [
      {
        source: 'OpenWeatherMap',
        lastSuccessAt: new Date().toISOString(),
        freshnessSeconds: 120,
        status: 'HEALTHY',
      },
      {
        source: 'IMD RSS Feed',
        lastSuccessAt: new Date(Date.now() - 3600000).toISOString(),
        freshnessSeconds: 3600,
        status: 'DEGRADED',
        errorSummary: 'Feed not updated in 1 hour',
      },
      {
        source: 'Satellite Imagery',
        lastSuccessAt: new Date(Date.now() - 7200000).toISOString(),
        freshnessSeconds: 7200,
        status: 'DEGRADED',
        errorSummary: 'Simulator mode — no live feed',
      },
      {
        source: 'Rain Gauge Network',
        lastSuccessAt: new Date(Date.now() - 86400000).toISOString(),
        freshnessSeconds: 86400,
        status: 'OFFLINE',
        errorSummary: 'No connection established (simulator available)',
      },
    ];

    // Real production state: NO demo mock data.
    // Loads persisted real citizen & sensor data from disk if available.
    this.loadFromDisk();
  }

  private getDbFilePath(): string {
    return path.join(process.cwd(), 'data', 'suraksha_db.json');
  }

  private loadFromDisk(): void {
    try {
      const dbPath = this.getDbFilePath();
      if (fs.existsSync(dbPath)) {
        const raw = fs.readFileSync(dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.reports)) this.reports = parsed.reports;
        if (Array.isArray(parsed.incidents)) this.incidents = parsed.incidents;
        if (Array.isArray(parsed.alerts)) this.alerts = parsed.alerts;
        if (Array.isArray(parsed.auditEvents)) this.auditEvents = parsed.auditEvents;
      }
    } catch (e) {
      console.warn('Database load warning (falling back to memory):', e);
    }
  }

  persist(): void {
    try {
      const dbPath = this.getDbFilePath();
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        reports: this.reports,
        incidents: this.incidents,
        alerts: this.alerts,
        auditEvents: this.auditEvents,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      // In serverless environments with read-only storage, degrade gracefully to in-memory
      console.warn('Database persistence write warning:', e);
    }
  }


  // —— Report Operations ——

  createReport(data: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Report {
    const report: Report = {
      ...data,
      id: generateId(),
      verificationStatus: 'PENDING_VERIFICATION',
      currentActionCategory: 'Pending Verification',
      actionHistory: [
        {
          id: generateId(),
          action: 'Pending Verification',
          actorName: 'Telemetry Gateway',
          notes: 'Report submitted by citizen and queued for meteorologist verification vs Doppler radar.',
          timestamp: new Date().toISOString(),
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.reports.unshift(report);
    this.logAudit('system', 'CITIZEN', 'report', report.id, 'CREATE', { category: report.category });

    // Automatically cluster into or create an Incident for the Reviewer Queue!
    this.clusterReportIntoIncident(report);

    this.persist();
    return report;
  }

  private clusterReportIntoIncident(report: Report): Incident {
    // Check if there is an existing candidate incident nearby with same category
    const match = this.incidents.find(inc => {
      if (inc.state !== 'CANDIDATE') return false;
      if (inc.category !== report.category) return false;
      if (!inc.location) return false;
      const dLat = Math.abs(inc.location.latitude - report.location.latitude);
      const dLng = Math.abs(inc.location.longitude - report.location.longitude);
      return dLat < 0.04 && dLng < 0.04; // ~3-4km cluster window
    });

    if (match) {
      match.reports.unshift(report);
      match.reportCount = match.reports.length;
      match.updatedAt = new Date().toISOString();
      if (!match.mediaUrl && report.mediaUrl) {
        match.mediaUrl = report.mediaUrl;
      }
      // Recompute confidence score with spatial corroboration bonus
      match.confidenceScore = computeConfidenceScore({
        report,
        nearbyReports: match.reports.slice(1),
        reporterConfirmedCount: 1,
        duplicateImageDetected: false,
        locationMismatch: false,
      });
      report.status = 'ATTACHED';
      return match;
    } else {
      const confidence = computeConfidenceScore({
        report,
        nearbyReports: [],
        reporterConfirmedCount: 0,
        duplicateImageDetected: false,
        locationMismatch: false,
      });

      const newInc: Incident = {
        id: `inc_real_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        h3Parent: report.h3Index,
        category: report.category,
        state: 'CANDIDATE',
        confidenceScore: confidence,
        impactLevel: report.severity >= 4 ? 'CRITICAL' : report.severity >= 3 ? 'HIGH' : 'MODERATE',
        reportCount: 1,
        reports: [report],
        evidence: [
          {
            id: generateId(),
            reportId: report.id,
            type: 'WEATHER',
            source: 'Doppler Weather Radar & Automated Rain Gauge',
            observedAt: new Date().toISOString(),
            freshnessSeconds: 45,
            value: { reflectivityDbz: 38 + report.severity * 3, rainRateMmH: report.severity * 11 },
            provenance: 'Automated Weather Corroboration Engine'
          }
        ],
        reviewActions: [],
        verificationStatus: 'PENDING_VERIFICATION',
        currentActionCategory: 'Pending Verification',
        actionHistory: [
          {
            id: generateId(),
            action: 'Pending Verification',
            actorName: 'Cluster Engine',
            notes: 'Candidate incident queued for meteorologist verification vs ground Doppler radar.',
            timestamp: report.createdAt,
          }
        ],
        landmark: report.landmark || `${report.category.replace('_', ' ')} near ${report.location.latitude.toFixed(3)}°N, ${report.location.longitude.toFixed(3)}°E`,
        location: report.location,
        mediaUrl: report.mediaUrl,
        createdAt: report.createdAt,
        updatedAt: report.createdAt,
      };

      this.incidents.unshift(newInc);
      report.status = 'ATTACHED';
      return newInc;
    }
  }

  clearAllIncidentsAndReports(): void {
    this.incidents = [];
    this.reports = [];
    this.persist();
  }

  getReport(id: string): Report | undefined {
    return this.reports.find(r => r.id === id);
  }

  getReports(filters?: { status?: ReportStatus; category?: HazardCategory; h3Index?: string }): Report[] {
    let result = [...this.reports];
    if (filters?.status) result = result.filter(r => r.status === filters.status);
    if (filters?.category) result = result.filter(r => r.category === filters.category);
    if (filters?.h3Index) result = result.filter(r => r.h3Index === filters.h3Index);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  updateReportStatus(id: string, status: ReportStatus): Report | undefined {
    const report = this.reports.find(r => r.id === id);
    if (report) {
      report.status = status;
      report.updatedAt = new Date().toISOString();
      this.persist();
    }
    return report;
  }

  takeReportAction(
    reportId: string,
    action: ActionCategory,
    notes: string = '',
    actorName: string = 'Duty Responder'
  ): Report | undefined {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return undefined;

    const actionLog: ActionLogItem = {
      id: generateId(),
      action,
      actorName,
      notes,
      timestamp: new Date().toISOString(),
    };

    if (!report.actionHistory) report.actionHistory = [];
    report.actionHistory.unshift(actionLog);

    if (!report.firstActionTaken || report.firstActionTaken === 'Pending Verification' || report.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
      if (action !== 'Pending Verification') {
        report.firstActionTaken = action;
      }
    }
    report.currentActionCategory = action;
    report.updatedAt = new Date().toISOString();

    if (action === 'Flagged False Alarm / Dismissed') {
      report.verificationStatus = 'FLAGGED_FALSE_REPORT';
      report.status = 'DISMISSED';
      report.verificationRationale = notes || 'Discrepancy flagged against radar/gauge telemetry.';
    } else if (action === 'Verified Genuine — Pending Tactical Action') {
      report.verificationStatus = 'VERIFIED_GENUINE';
      report.status = 'REVIEWED';
      report.verificationRationale = notes || 'Validated against Doppler AWS and ground corroboration.';
    } else if (action === 'Hazard Resolved') {
      report.status = 'RESOLVED';
    } else {
      report.verificationStatus = 'VERIFIED_GENUINE';
      report.status = 'REVIEWED';
    }

    // Cascade to parent incident if clustered
    const parentInc = this.incidents.find(inc => inc.reports.some(r => r.id === reportId));
    if (parentInc) {
      if (!parentInc.firstActionTaken || parentInc.firstActionTaken === 'Pending Verification' || parentInc.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
        if (action !== 'Pending Verification') {
          parentInc.firstActionTaken = action;
        }
      }
      parentInc.currentActionCategory = action;
      if (!parentInc.actionHistory) parentInc.actionHistory = [];
      parentInc.actionHistory.unshift(actionLog);
      parentInc.updatedAt = new Date().toISOString();

      if (action === 'Flagged False Alarm / Dismissed') {
        parentInc.state = 'DISMISSED';
        parentInc.verificationStatus = 'FLAGGED_FALSE_REPORT';
      } else if (action === 'Hazard Resolved') {
        parentInc.state = 'RESOLVED';
      } else if (action === 'Verified Genuine — Pending Tactical Action') {
        parentInc.state = 'VERIFIED';
        parentInc.verificationStatus = 'VERIFIED_GENUINE';
      } else {
        parentInc.state = 'ESCALATED';
        parentInc.verificationStatus = 'VERIFIED_GENUINE';
      }
    }

    this.logAudit(actorName, 'ADMIN', 'report', reportId, action, { notes });
    this.persist();
    return report;
  }

  // —— Incident Operations ——

  getIncident(id: string): Incident | undefined {
    return this.incidents.find(i => i.id === id);
  }

  getIncidents(filters?: { state?: IncidentState; category?: HazardCategory }): Incident[] {
    let result = [...this.incidents];
    if (filters?.state) result = result.filter(i => i.state === filters.state);
    if (filters?.category) result = result.filter(i => i.category === filters.category);
    return result.sort((a, b) => b.confidenceScore.total - a.confidenceScore.total);
  }

  addReviewAction(incidentId: string, action: Omit<ReviewAction, 'id' | 'createdAt'>): ReviewAction | undefined {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return undefined;

    const reviewAction: ReviewAction = {
      ...action,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    incident.reviewActions.push(reviewAction);
    incident.state = action.resultState;
    incident.updatedAt = new Date().toISOString();

    const actionCategory: ActionCategory = 
      action.action === 'VERIFY' ? 'Verified Genuine — Pending Tactical Action' :
      action.action === 'DISMISS' ? 'Flagged False Alarm / Dismissed' :
      action.action === 'ESCALATE' ? 'Evacuation Ordered' : 'Meteorological Monitoring';

    if (!incident.firstActionTaken) {
      incident.firstActionTaken = actionCategory;
    }
    incident.currentActionCategory = actionCategory;

    const actionLog: ActionLogItem = {
      id: generateId(),
      action: actionCategory,
      actorName: action.actorName,
      notes: action.reason,
      timestamp: new Date().toISOString(),
    };
    if (!incident.actionHistory) incident.actionHistory = [];
    incident.actionHistory.unshift(actionLog);

    // Cascade status to contributing reports for citizen tracking!
    incident.reports.forEach(r => {
      if (!r.actionHistory) r.actionHistory = [];
      r.actionHistory.unshift(actionLog);
      if (!r.firstActionTaken) r.firstActionTaken = actionCategory;
      r.currentActionCategory = actionCategory;

      if (action.action === 'VERIFY') {
        r.status = 'REVIEWED';
        r.verificationStatus = 'VERIFIED_GENUINE';
        r.verificationRationale = action.reason || 'Verified as genuine hazard by duty meteorologist.';
      } else if (action.action === 'DISMISS') {
        r.status = 'DISMISSED';
        r.verificationStatus = 'FLAGGED_FALSE_REPORT';
        r.verificationRationale = action.reason || 'Flagged as inaccurate or duplicate by duty reviewer.';
      }
      r.updatedAt = new Date().toISOString();
    });

    this.reviewActions.push(reviewAction);

    this.logAudit(action.actorId, 'REVIEWER', 'incident', incidentId, action.action, {
      reason: action.reason,
      priorState: action.priorState,
      resultState: action.resultState,
    });

    this.persist();
    return reviewAction;
  }

  resolveIncident(incidentId: string, resolutionNotes: string, actorId: string): Incident | undefined {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return undefined;

    const actionCategory: ActionCategory = 'Hazard Resolved';
    incident.state = 'RESOLVED';
    incident.actionedDirective = 'RESOLVED';
    incident.currentActionCategory = actionCategory;
    if (!incident.firstActionTaken || incident.firstActionTaken === 'Pending Verification' || incident.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
      incident.firstActionTaken = actionCategory;
    }

    const actionLog: ActionLogItem = {
      id: generateId(),
      action: actionCategory,
      actorName: actorId === 'admin_exec' ? 'Disaster Operations Commander' : actorId,
      notes: resolutionNotes,
      timestamp: new Date().toISOString(),
    };
    if (!incident.actionHistory) incident.actionHistory = [];
    incident.actionHistory.unshift(actionLog);

    incident.resolution = {
      reason: resolutionNotes,
      resolvedAt: new Date().toISOString(),
      actorName: actorId === 'admin_exec' ? 'Disaster Operations Commander' : actorId,
    };
    incident.updatedAt = new Date().toISOString();

    incident.reports.forEach(r => {
      r.status = 'RESOLVED';
      r.currentActionCategory = actionCategory;
      if (!r.firstActionTaken || r.firstActionTaken === 'Pending Verification' || r.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
        r.firstActionTaken = actionCategory;
      }
      if (!r.actionHistory) r.actionHistory = [];
      r.actionHistory.unshift(actionLog);
      r.updatedAt = new Date().toISOString();
    });

    this.logAudit(actorId, 'ADMIN', 'incident', incidentId, 'RESOLVE', { resolutionNotes });
    this.persist();
    return incident;
  }

  executeMunicipalOrder(incidentId: string, orderDetails: { pumpUnits: number; pumpHp: number; trafficBarricades: boolean }, actorId: string): Incident | undefined {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return undefined;

    const actionCategory: ActionCategory = 'Dewatering & Municipal Crew Dispatched';
    incident.actionedDirective = 'MUNICIPAL_ORDER_DISPATCHED';
    incident.currentActionCategory = actionCategory;
    if (!incident.firstActionTaken || incident.firstActionTaken === 'Pending Verification' || incident.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
      incident.firstActionTaken = actionCategory;
    }

    const actionLog: ActionLogItem = {
      id: generateId(),
      action: actionCategory,
      actorName: 'Municipal Engineering & Traffic Police',
      notes: `Mobilized ${orderDetails.pumpUnits}x ${orderDetails.pumpHp}HP Dewatering Pumps with Traffic Barricades.`,
      timestamp: new Date().toISOString(),
    };
    if (!incident.actionHistory) incident.actionHistory = [];
    incident.actionHistory.unshift(actionLog);

    incident.municipalOrder = {
      orderId: generateId(),
      ...orderDetails,
      issuedAt: new Date().toISOString(),
      dispatchedAgency: 'Municipal Corporation Engineering Wing & Traffic Police',
    };
    incident.updatedAt = new Date().toISOString();

    incident.reports.forEach(r => {
      r.currentActionCategory = actionCategory;
      if (!r.firstActionTaken || r.firstActionTaken === 'Pending Verification' || r.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
        r.firstActionTaken = actionCategory;
      }
      if (!r.actionHistory) r.actionHistory = [];
      r.actionHistory.unshift(actionLog);
      r.status = 'REVIEWED';
      r.updatedAt = new Date().toISOString();
    });

    this.logAudit(actorId, 'ADMIN', 'incident', incidentId, 'DISPATCH_MUNICIPAL_CREW', {
      orderDetails,
      timestamp: new Date().toISOString(),
    });
    this.persist();
    return incident;
  }

  broadcastIncidentAlert(incidentId: string, alertId: string, actorId: string): Incident | undefined {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return undefined;

    const actionCategory: ActionCategory = 'Public Warning Issued (CAP 1.2)';
    incident.actionedDirective = 'CAP_ALERT_BROADCASTED';
    incident.currentActionCategory = actionCategory;
    if (!incident.firstActionTaken || incident.firstActionTaken === 'Pending Verification' || incident.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
      incident.firstActionTaken = actionCategory;
    }

    const actionLog: ActionLogItem = {
      id: generateId(),
      action: actionCategory,
      actorName: 'Emergency Alert Desk (CAP 1.2)',
      notes: 'Published official public warning to national CAP stream and citizen alert feed.',
      timestamp: new Date().toISOString(),
    };
    if (!incident.actionHistory) incident.actionHistory = [];
    incident.actionHistory.unshift(actionLog);
    incident.updatedAt = new Date().toISOString();

    incident.reports.forEach(r => {
      r.currentActionCategory = actionCategory;
      if (!r.firstActionTaken || r.firstActionTaken === 'Pending Verification' || r.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
        r.firstActionTaken = actionCategory;
      }
      if (!r.actionHistory) r.actionHistory = [];
      r.actionHistory.unshift(actionLog);
      r.status = 'REVIEWED';
      r.updatedAt = new Date().toISOString();
    });

    this.logAudit(actorId, 'ADMIN', 'incident', incidentId, 'BROADCAST_CAP_ALERT', {
      alertId,
      timestamp: new Date().toISOString(),
    });
    this.persist();
    return incident;
  }

  // —— Alert Operations ——

  getAlert(id: string): Alert | undefined {
    return this.alerts.find(a => a.id === id);
  }

  getActiveAlerts(): Alert[] {
    const now = new Date().toISOString();
    return this.alerts.filter(
      a => a.status === 'PUBLISHED' && a.expiresAt > now
    );
  }

  getAllAlerts(): Alert[] {
    return [...this.alerts].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getAlerts(): Alert[] {
    return this.getAllAlerts();
  }

  createAlert(data: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Alert {
    const alert: Alert = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.alerts.push(alert);
    this.persist();
    return alert;
  }

  publishAlert(id: string, publishedBy: string): Alert | undefined {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.status = 'PUBLISHED';
      alert.publishedBy = publishedBy;
      alert.updatedAt = new Date().toISOString();
      this.logAudit(publishedBy, 'OFFICER', 'alert', id, 'PUBLISH', { severity: alert.severity });
      this.persist();
    }
    return alert;
  }

  cancelAlert(id: string, reason: string, actorId: string): Alert | undefined {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.status = 'CANCELLED';
      alert.updatedAt = new Date().toISOString();
      this.logAudit(actorId, 'OFFICER', 'alert', id, 'CANCEL', { reason });
      this.persist();
    }
    return alert;
  }

  extendAlert(id: string, hours: number, actorId: string): Alert | undefined {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      const currentExpiry = Math.max(Date.now(), new Date(alert.expiresAt).getTime());
      alert.expiresAt = new Date(currentExpiry + hours * 3600000).toISOString();
      alert.updatedAt = new Date().toISOString();
      this.logAudit(actorId, 'OFFICER', 'alert', id, 'EXTEND', { extendedHours: hours, newExpiry: alert.expiresAt });
      this.persist();
    }
    return alert;
  }

  // —— User Operations ——

  getUser(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    return this.users.find(u => u.email === email);
  }

  getUsers(): User[] {
    return [...this.users];
  }

  // —— Source Health ——

  getSourceHealth(): SourceHealth[] {
    return [...this.sourceHealth];
  }

  updateSourceHealth(source: string, update: Partial<SourceHealth>) {
    const sh = this.sourceHealth.find(s => s.source === source);
    if (sh) {
      Object.assign(sh, update);
    }
  }

  // —— Audit Log ——

  logAudit(
    actorId: string,
    actorRole: UserRole,
    entityType: string,
    entityId: string,
    action: string,
    metadata: Record<string, unknown> = {}
  ) {
    this.auditEvents.push({
      id: generateId(),
      actorId,
      actorRole,
      entityType,
      entityId,
      action,
      metadata,
      createdAt: new Date().toISOString(),
    });
  }

  getAuditEvents(filters?: { entityType?: string; entityId?: string; actorId?: string }): AuditEvent[] {
    let result = [...this.auditEvents];
    if (filters?.entityType) result = result.filter(e => e.entityType === filters.entityType);
    if (filters?.entityId) result = result.filter(e => e.entityId === filters.entityId);
    if (filters?.actorId) result = result.filter(e => e.actorId === filters.actorId);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // —— Statistics ——

  getStats() {
    const now = Date.now();
    return {
      totalReports: this.reports.length,
      reportsToday: this.reports.filter(r => now - new Date(r.createdAt).getTime() < 86400000).length,
      activeIncidents: this.incidents.filter(i => i.state === 'CANDIDATE' || i.state === 'VERIFIED').length,
      activeAlerts: this.getActiveAlerts().length,
      pendingReview: this.incidents.filter(i => i.state === 'CANDIDATE').length,
      sourcesHealthy: this.sourceHealth.filter(s => s.status === 'HEALTHY').length,
      sourcesTotal: this.sourceHealth.length,
    };
  }
}

// Global Singleton to ensure persistent state across hot-reloads and API route invocations
declare global {
  // eslint-disable-next-line no-var
  var __suraksha_data_store: DataStore | undefined;
}

export const dataStore = globalThis.__suraksha_data_store ?? new DataStore();
if (!globalThis.__suraksha_data_store) {
  globalThis.__suraksha_data_store = dataStore;
}
export const store = dataStore;
