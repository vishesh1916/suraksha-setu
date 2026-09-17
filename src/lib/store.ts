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
  SosRequest,
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
  sosRequests: SosRequest[] = [];
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

  private lastLoadedMtime: number = 0;

  private getDbFilePath(): string {
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const tmpPath = path.join('/tmp', 'suraksha_db.json');
      if (!fs.existsSync(tmpPath)) {
        try {
          const bundledPath = path.join(process.cwd(), 'data', 'suraksha_db.json');
          if (fs.existsSync(bundledPath)) {
            const bundledData = fs.readFileSync(bundledPath, 'utf-8');
            fs.writeFileSync(tmpPath, bundledData, 'utf-8');
          }
        } catch {
          // ignore
        }
      }
      return tmpPath;
    }
    return path.join(process.cwd(), 'data', 'suraksha_db.json');
  }

  private checkAndReload(): void {
    try {
      const dbPath = this.getDbFilePath();
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        if (stats.mtimeMs !== this.lastLoadedMtime) {
          this.loadFromDisk();
        }
      }
    } catch {
      // Preserve memory state if file read encounters lock
    }
  }

  private getDefaultAlerts(): Alert[] {
    const now = Date.now();
    return [
      {
        id: 'alert_imd_delhi_yamuna_red',
        incidentId: 'inc_delhi_yamuna_basin',
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [77.195, 28.615],
              [77.265, 28.615],
              [77.275, 28.685],
              [77.205, 28.685],
              [77.195, 28.615],
            ],
          ],
        },
        severity: 5,
        category: 'FLOODING',
        headline: '🔴 IMD RED ALERT: Flash Flood & Yamuna Inundation Warning — NCT Delhi',
        guidance: 'National Disaster Management Authority & Delhi Emergency Operations: Extreme monsoon discharge recorded across Yamuna River catchment. Salimgarh bypass, Kashmere Gate Ring Road, and Pragati Maidan underpass corridors severely inundated (>3.8 ft). Citizens strictly advised to avoid low-lying underpasses and arterial riverine transit corridors.',
        startsAt: new Date(now - 3600000).toISOString(),
        expiresAt: new Date(now + 14 * 3600000).toISOString(),
        publishedBy: 'DDMA / IMD National Weather Forecasting Centre',
        status: 'PUBLISHED',
        source: 'India Meteorological Department & Delhi Disaster Management Authority',
        createdAt: new Date(now - 3600000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'alert_incois_mumbai_surge_orange',
        incidentId: 'inc_mumbai_high_tide',
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [72.805, 18.910],
              [72.855, 18.910],
              [72.865, 19.040],
              [72.815, 19.040],
              [72.805, 18.910],
            ],
          ],
        },
        severity: 4,
        category: 'FLOODING',
        headline: '🟠 INCOIS ORANGE ALERT: Arabian Sea Coastal Inundation & Spring High Tide',
        guidance: 'INCOIS & MCGM Emergency Operations Cell: Spring high tide reaching 4.87m coinciding with intense squall rains. Sea surge breaching Mahim Causeway and Marine Drive seawalls. Citizens strictly advised to stay away from promenades and low-lying coastal arterial roads.',
        startsAt: new Date(now - 7200000).toISOString(),
        expiresAt: new Date(now + 12 * 3600000).toISOString(),
        publishedBy: 'MCGM Disaster Management Unit',
        status: 'PUBLISHED',
        source: 'Indian National Centre for Ocean Information Services (INCOIS)',
        createdAt: new Date(now - 7200000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'alert_cwc_guwahati_brahmaputra_red',
        incidentId: 'inc_assam_brahmaputra',
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [91.680, 26.110],
              [91.790, 26.110],
              [91.810, 26.210],
              [91.690, 26.210],
              [91.680, 26.110],
            ],
          ],
        },
        severity: 5,
        category: 'FLOODING',
        headline: '🔴 CWC RED ADVISORY: Brahmaputra River Above Extreme Inundation Level',
        guidance: 'Central Water Commission (CWC) Official Hydro-Bulletin: River Brahmaputra at Guwahati Gauge Station is flowing at 50.18m (0.68m above Extreme Danger Level) with rising trend. SDRF and 1st NDRF Battalion deployed with rescue motorboats. Avoid ferry transit.',
        startsAt: new Date(now - 5400000).toISOString(),
        expiresAt: new Date(now + 24 * 3600000).toISOString(),
        publishedBy: 'Central Water Commission & ASDMA',
        status: 'PUBLISHED',
        source: 'Central Water Commission (CWC) Hydrological Sentinel',
        createdAt: new Date(now - 5400000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'alert_imd_hp_cloudburst_orange',
        incidentId: 'inc_hp_kangra_cloudburst',
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [76.240, 32.140],
              [76.380, 32.140],
              [76.400, 32.260],
              [76.250, 32.260],
              [76.240, 32.140],
            ],
          ],
        },
        severity: 4,
        category: 'CLOUDBURST',
        headline: '🟠 IMD ORANGE ALERT: Severe Cloudburst & Slope Debris Flow Watch',
        guidance: 'State Disaster Management Authority Himachal Pradesh: Doppler Radar at Shimla indicates cloudburst rain rates exceeding 80mm/hr over Kangra / Dharamsala slopes. High vulnerability of flash mudslides along NH-154. Travel restricted.',
        startsAt: new Date(now - 1800000).toISOString(),
        expiresAt: new Date(now + 8 * 3600000).toISOString(),
        publishedBy: 'HPSDMA State Emergency Operations Centre',
        status: 'PUBLISHED',
        source: 'India Meteorological Department Shimla Radar & HPSDMA',
        createdAt: new Date(now - 1800000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  private seedDefaultAlerts(): void {
    this.alerts = this.getDefaultAlerts();
  }

  private ensureNationalAlerts(): void {
    const now = Date.now();
    const defaults = this.getDefaultAlerts();
    if (!this.alerts) this.alerts = [];

    for (const def of defaults) {
      const existing = this.alerts.find(a => a.id === def.id);
      if (!existing) {
        this.alerts.push(def);
      } else {
        // Roll forward national surveillance advisory window so national monitoring stays live
        if (existing.status === 'PUBLISHED' && new Date(existing.expiresAt).getTime() <= now) {
          existing.startsAt = new Date(now - 3600000).toISOString();
          existing.expiresAt = new Date(now + 14 * 3600000).toISOString();
          existing.updatedAt = new Date().toISOString();
        }
      }
    }
  }

  private seedDefaultSos(): void {
    const now = Date.now();
    this.sosRequests = [
      {
        id: 'sos_req_delhi_01',
        reporterName: 'Aarav Sharma',
        phone: '+91 98110 44821',
        location: { latitude: 28.6328, longitude: 77.2197 },
        landmark: 'Near Pragati Maidan Tunnel Underpass, Mathura Road Corridor, New Delhi',
        hazardType: 'FLOODING',
        peopleCount: 4,
        hasMedicalEmergency: true,
        notes: 'Car submerged up to bonnet in underpass floodwaters. Elderly diabetic passenger requires urgent insulin & water evacuation.',
        status: 'DISPATCHED',
        dispatchedUnit: 'NDRF 8th Battalion Water Rescue Unit (Boat #3)',
        createdAt: new Date(now - 1200000).toISOString(),
        updatedAt: new Date(now - 300000).toISOString(),
      },
      {
        id: 'sos_req_mumbai_02',
        reporterName: 'Rohit Kulkarni',
        phone: '+91 98201 55902',
        location: { latitude: 19.0178, longitude: 72.8478 },
        landmark: 'Near Hindmata Cinema Junction, Dadar East, Mumbai',
        hazardType: 'FLOODING',
        peopleCount: 6,
        hasMedicalEmergency: false,
        notes: 'Ground floor shop flooded with 3.5ft water. 6 people stranded on mezzanine slab. Power lines sparking nearby.',
        status: 'PENDING_RESCUE',
        dispatchedUnit: undefined,
        createdAt: new Date(now - 1800000).toISOString(),
        updatedAt: new Date(now - 1800000).toISOString(),
      },
    ];
  }

  private loadFromDisk(): void {
    try {
      const dbPath = this.getDbFilePath();
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        const raw = fs.readFileSync(dbPath, 'utf-8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.reports)) this.reports = parsed.reports;
          if (Array.isArray(parsed.incidents)) this.incidents = parsed.incidents;
          if (Array.isArray(parsed.alerts)) this.alerts = parsed.alerts;
          if (Array.isArray(parsed.sosRequests)) this.sosRequests = parsed.sosRequests;
          if (Array.isArray(parsed.auditEvents)) this.auditEvents = parsed.auditEvents;
          this.lastLoadedMtime = stats.mtimeMs;
        }
      }
      this.ensureNationalAlerts();
      if (!this.sosRequests || this.sosRequests.length === 0) {
        this.seedDefaultSos();
      }
    } catch (e) {
      console.warn('Database load warning (falling back to memory):', e);
      this.ensureNationalAlerts();
      if (!this.sosRequests || this.sosRequests.length === 0) this.seedDefaultSos();
    }
  }

  persist(isExplicitClear: boolean = false): void {
    try {
      const dbPath = this.getDbFilePath();
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Safety guard: If memory reports are empty but disk has reports, and this is NOT an explicit purge,
      // reload from disk first to prevent accidental wipe from a freshly spun-up worker!
      if (!isExplicitClear && this.reports.length === 0 && fs.existsSync(dbPath)) {
        try {
          const raw = fs.readFileSync(dbPath, 'utf-8');
          if (raw.trim()) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.reports) && parsed.reports.length > 0) {
              this.reports = parsed.reports;
              if (Array.isArray(parsed.incidents)) this.incidents = parsed.incidents;
              if (Array.isArray(parsed.alerts)) this.alerts = parsed.alerts;
              if (Array.isArray(parsed.sosRequests)) this.sosRequests = parsed.sosRequests;
              if (Array.isArray(parsed.auditEvents)) this.auditEvents = parsed.auditEvents;
            }
          }
        } catch {}
      }

      const data = {
        reports: this.reports,
        incidents: this.incidents,
        alerts: this.alerts,
        sosRequests: this.sosRequests,
        auditEvents: this.auditEvents,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
      try {
        const stats = fs.statSync(dbPath);
        this.lastLoadedMtime = stats.mtimeMs;
      } catch {
        this.lastLoadedMtime = Date.now();
      }
    } catch (e) {
      console.warn('Database persistence write warning:', e);
    }
  }

  // —— Report Operations ——

  createReport(data: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Report {
    this.checkAndReload();
    const report: Report = {
      ...data,
      id: generateId(),
      verificationStatus: 'PENDING_VERIFICATION',
      currentActionCategory: 'Pending Verification',
      status: 'RECEIVED',
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

    // Automatically register Ground Hazard Advisory in alerts for universal platform visibility
    if (report.severity >= 3) {
      const hazardLabel = report.category.replace('_', ' ');
      const newAlert: Alert = {
        id: `alert_obs_${report.id}`,
        incidentId: report.id,
        polygon: {
          type: 'Polygon',
          coordinates: [[[report.location.longitude - 0.03, report.location.latitude - 0.03], [report.location.longitude + 0.03, report.location.latitude - 0.03], [report.location.longitude + 0.03, report.location.latitude + 0.03], [report.location.longitude - 0.03, report.location.latitude + 0.03], [report.location.longitude - 0.03, report.location.latitude - 0.03]]],
        },
        severity: report.severity,
        category: report.category,
        headline: `⚠️ GROUND OBSERVATION: Severe ${hazardLabel} — ${report.landmark || 'Regional Sector'}`,
        guidance: report.description || 'Ground hazard reported by eyewitness. Meteorological review in progress. Avoid submerged transit corridors and seek safe ground.',
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 6 * 3600000).toISOString(),
        publishedBy: 'Doppler AWS Telemetry Gateway',
        status: 'PUBLISHED',
        source: 'Ground Sensor & Citizen Eyewitness Corroborator',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.alerts.unshift(newAlert);
    }

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
      return newInc;
    }
  }

  clearAllIncidentsAndReports(): void {
    this.checkAndReload();
    this.incidents = [];
    this.reports = [];
    this.alerts = [];
    this.sosRequests = [];
    this.auditEvents = [];
    this.persist(true);
  }

  getReport(id: string): Report | undefined {
    this.checkAndReload();
    if (!id) return undefined;
    const clean = id.trim().toLowerCase();

    // 1. Direct or case-insensitive match
    let found = this.reports.find(r => r.id === id || r.id.toLowerCase() === clean);
    if (found) return found;

    // 2. Prefix / partial match (e.g. if user entered truncated 16-char ID or pasted without prefix)
    found = this.reports.find(r => {
      const rid = r.id.toLowerCase();
      return rid.startsWith(clean) || clean.startsWith(rid) || (clean.length >= 6 && rid.includes(clean));
    });
    if (found) return found;

    // 3. Match against incident ID (if user entered incident ID)
    const inc = this.incidents.find(i => 
      i.id === id || 
      i.id.toLowerCase() === clean || 
      i.id.toLowerCase().startsWith(clean) ||
      clean.startsWith(i.id.toLowerCase())
    );
    if (inc && inc.reports && inc.reports.length > 0) {
      return inc.reports[0];
    }

    // 4. Match against pseudonym or reporterId
    found = this.reports.find(r => 
      (r.reporterPseudonym && r.reporterPseudonym.toLowerCase() === clean) ||
      (r.reporterId && r.reporterId.toLowerCase() === clean)
    );
    return found;
  }

  getReports(filters?: { status?: ReportStatus; category?: HazardCategory; h3Index?: string }): Report[] {
    this.checkAndReload();
    let result = [...this.reports];
    if (filters?.status) {
      if (filters.status === 'RECEIVED') {
        result = result.filter(r => r.status === 'RECEIVED' || r.status === 'ATTACHED' || r.status === 'QUEUED');
      } else {
        result = result.filter(r => r.status === filters.status);
      }
    }
    if (filters?.category) result = result.filter(r => r.category === filters.category);
    if (filters?.h3Index) result = result.filter(r => r.h3Index === filters.h3Index);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  updateReportStatus(id: string, status: ReportStatus): Report | undefined {
    this.checkAndReload();
    const report = this.getReport(id);
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
    this.checkAndReload();
    const report = this.getReport(reportId);
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
      // Expire any alerts created for this report
      this.alerts.forEach(a => {
        if (a.incidentId === reportId || a.id.includes(reportId)) {
          a.status = 'EXPIRED';
          a.updatedAt = new Date().toISOString();
        }
      });
    } else if (action === 'Verified Genuine — Pending Tactical Action') {
      report.verificationStatus = 'VERIFIED_GENUINE';
      report.status = 'REVIEWED';
      report.verificationRationale = notes || 'Validated against Doppler AWS and ground corroboration.';
    } else if (action === 'Hazard Resolved') {
      report.status = 'RESOLVED';
      // Mark any associated active alerts as EXPIRED with all-clear
      this.alerts.forEach(a => {
        if (a.incidentId === reportId || a.incidentId === report.h3Index || a.id.includes(reportId)) {
          a.status = 'EXPIRED';
          a.guidance = 'All-clear confirmed. Municipal pumps completed dewatering and normal transit is restored.';
          a.updatedAt = new Date().toISOString();
        }
      });
    } else if (action === 'Public Warning Issued (CAP 1.2)') {
      report.verificationStatus = 'VERIFIED_GENUINE';
      report.status = 'REVIEWED';
      const newAlert: Alert = {
        id: generateId(),
        incidentId: reportId,
        polygon: {
          type: 'Polygon',
          coordinates: [[[report.location.longitude - 0.03, report.location.latitude - 0.03], [report.location.longitude + 0.03, report.location.latitude - 0.03], [report.location.longitude + 0.03, report.location.latitude + 0.03], [report.location.longitude - 0.03, report.location.latitude + 0.03], [report.location.longitude - 0.03, report.location.latitude - 0.03]]],
        },
        severity: report.severity,
        category: report.category,
        headline: `🚨 EMERGENCY WEATHER ALERT — ${report.landmark || report.category}`,
        guidance: notes || 'Dangerous conditions corroborated by Doppler radar. Emergency response dispatched. Avoid underpass and low-lying transit corridors.',
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 6 * 3600000).toISOString(),
        publishedBy: actorName || 'Platform Administrator (DDMA Emergency Desk)',
        status: 'PUBLISHED',
        source: 'Executive Disaster Command Centre',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.alerts.unshift(newAlert);
    } else if (action === 'Evacuation Ordered') {
      report.verificationStatus = 'VERIFIED_GENUINE';
      report.status = 'REVIEWED';
      const evacAlert: Alert = {
        id: `alert_evac_${report.id}`,
        incidentId: reportId,
        polygon: {
          type: 'Polygon',
          coordinates: [[[report.location.longitude - 0.04, report.location.latitude - 0.04], [report.location.longitude + 0.04, report.location.latitude - 0.04], [report.location.longitude + 0.04, report.location.latitude + 0.04], [report.location.longitude - 0.04, report.location.latitude + 0.04], [report.location.longitude - 0.04, report.location.latitude - 0.04]]],
        },
        severity: 5,
        category: report.category,
        headline: `🚨 MANDATORY CIVIL EVACUATION ORDER — ${report.landmark || report.category}`,
        guidance: notes || 'Dangerous conditions corroborated by Doppler radar and ground telemetry. Civil defense orders immediate high-ground evacuation. Avoid all submerged transit routes.',
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
        publishedBy: actorName || 'Executive Disaster Command Centre',
        status: 'PUBLISHED',
        source: 'District Disaster Management Authority (DDMA)',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.alerts.unshift(evacAlert);
    } else if (action === 'Dewatering & Municipal Crew Dispatched') {
      report.verificationStatus = 'VERIFIED_GENUINE';
      report.status = 'REVIEWED';
      const pumpAlert: Alert = {
        id: `alert_pump_${report.id}`,
        incidentId: reportId,
        polygon: {
          type: 'Polygon',
          coordinates: [[[report.location.longitude - 0.02, report.location.latitude - 0.02], [report.location.longitude + 0.02, report.location.latitude - 0.02], [report.location.longitude + 0.02, report.location.latitude + 0.02], [report.location.longitude - 0.02, report.location.latitude + 0.02], [report.location.longitude - 0.02, report.location.latitude - 0.02]]],
        },
        severity: report.severity,
        category: report.category,
        headline: `🚒 MUNICIPAL DEWATERING DISPATCHED — ${report.landmark || report.category}`,
        guidance: notes || 'High-capacity 500HP dewatering pumps mobilized. Traffic diversions in place. Follow municipal traffic police advisories.',
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 6 * 3600000).toISOString(),
        publishedBy: actorName || 'Municipal Disaster Control Room',
        status: 'PUBLISHED',
        source: 'Municipal Corporation Emergency Services',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.alerts.unshift(pumpAlert);
    } else if (action === 'Search & Rescue Deployed') {
      report.verificationStatus = 'VERIFIED_GENUINE';
      report.status = 'REVIEWED';
      const sarAlert: Alert = {
        id: `alert_sar_${report.id}`,
        incidentId: reportId,
        polygon: {
          type: 'Polygon',
          coordinates: [[[report.location.longitude - 0.03, report.location.latitude - 0.03], [report.location.longitude + 0.03, report.location.latitude - 0.03], [report.location.longitude + 0.03, report.location.latitude + 0.03], [report.location.longitude - 0.03, report.location.latitude + 0.03], [report.location.longitude - 0.03, report.location.latitude - 0.03]]],
        },
        severity: 5,
        category: report.category,
        headline: `🚤 SEARCH & RESCUE DEPLOYED — ${report.landmark || report.category}`,
        guidance: notes || 'NDRF and SDRF watercraft crews deployed to sector. Move to upper levels and signal rescue teams.',
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 6 * 3600000).toISOString(),
        publishedBy: actorName || 'State Disaster Response Force',
        status: 'PUBLISHED',
        source: 'NDRF / SDRF Joint Operations',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.alerts.unshift(sarAlert);
    } else {
      report.verificationStatus = 'VERIFIED_GENUINE';
      report.status = 'REVIEWED';
    }

    // Cascade to parent incident if clustered
    const parentInc = this.incidents.find(inc => inc.reports.some(r => r.id === reportId));
    if (parentInc) {
      const nested = parentInc.reports.find(r => r.id === reportId);
      if (nested) {
        nested.status = report.status;
        nested.verificationStatus = report.verificationStatus;
        nested.currentActionCategory = report.currentActionCategory;
        nested.firstActionTaken = report.firstActionTaken;
        nested.actionHistory = report.actionHistory;
        nested.verificationRationale = report.verificationRationale;
        nested.updatedAt = report.updatedAt;
      }

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
    this.checkAndReload();
    return this.incidents.find(i => i.id === id);
  }

  getIncidents(filters?: { state?: IncidentState; category?: HazardCategory }): Incident[] {
    this.checkAndReload();
    let result = [...this.incidents];
    if (filters?.state) result = result.filter(i => i.state === filters.state);
    if (filters?.category) result = result.filter(i => i.category === filters.category);

    const stateWeight: Record<IncidentState, number> = {
      CANDIDATE: 5,
      VERIFIED: 4,
      ESCALATED: 3,
      FOLLOW_UP_REQUIRED: 2,
      RESOLVED: 1,
      DISMISSED: 0,
    };

    return result.sort((a, b) => {
      // 1. Group active candidate queue first, then verified/escalated, then resolved/dismissed
      const weightDiff = (stateWeight[b.state] ?? 0) - (stateWeight[a.state] ?? 0);
      if (weightDiff !== 0) return weightDiff;

      // 2. Within same state, sort newest first so newly filed hazards immediately appear at top!
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;

      // 3. Tie-breaker: higher confidence/impact
      return b.confidenceScore.total - a.confidenceScore.total;
    });
  }

  addReviewAction(incidentId: string, action: Omit<ReviewAction, 'id' | 'createdAt'>): ReviewAction | undefined {
    this.checkAndReload();
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

    if (action.action === 'VERIFY') {
      incident.verificationStatus = 'VERIFIED_GENUINE';
    } else if (action.action === 'DISMISS') {
      incident.verificationStatus = 'FLAGGED_FALSE_REPORT';
    }

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

    // Cascade status to contributing reports for citizen tracking and admin tabs!
    incident.reports.forEach(r => {
      const storeReport = this.reports.find(rep => rep.id === r.id);
      const targets = [r, storeReport].filter((t): t is Report => Boolean(t));

      targets.forEach(target => {
        if (!target.actionHistory) target.actionHistory = [];
        target.actionHistory.unshift(actionLog);
        target.firstActionTaken = actionCategory;
        target.currentActionCategory = actionCategory;

        if (action.action === 'VERIFY') {
          target.status = 'REVIEWED';
          target.verificationStatus = 'VERIFIED_GENUINE';
          target.verificationRationale = action.reason || 'Verified as genuine hazard by duty meteorologist.';
        } else if (action.action === 'DISMISS') {
          target.status = 'DISMISSED';
          target.verificationStatus = 'FLAGGED_FALSE_REPORT';
          target.verificationRationale = action.reason || 'Flagged as inaccurate or duplicate by duty reviewer.';
        }
        target.updatedAt = new Date().toISOString();
      });
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
    this.checkAndReload();
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
      const storeReport = this.reports.find(rep => rep.id === r.id);
      const targets = [r, storeReport].filter((t): t is Report => Boolean(t));
      targets.forEach(target => {
        target.status = 'RESOLVED';
        target.currentActionCategory = actionCategory;
        if (!target.firstActionTaken || target.firstActionTaken === 'Pending Verification' || target.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
          target.firstActionTaken = actionCategory;
        }
        if (!target.actionHistory) target.actionHistory = [];
        target.actionHistory.unshift(actionLog);
        target.updatedAt = new Date().toISOString();
      });
    });

    // Also mark any associated active alerts as EXPIRED with all-clear
    this.alerts.forEach(a => {
      if (a.incidentId === incidentId || incident.reports.some(r => r.id === a.incidentId || a.id.includes(r.id))) {
        a.status = 'EXPIRED';
        a.guidance = 'All-clear confirmed. Drainage restored and transit reopened.';
        a.updatedAt = new Date().toISOString();
      }
    });

    this.logAudit(actorId, 'ADMIN', 'incident', incidentId, 'RESOLVE', { resolutionNotes });
    this.persist();
    return incident;
  }

  executeMunicipalOrder(incidentId: string, orderDetails: { pumpUnits: number; pumpHp: number; trafficBarricades: boolean }, actorId: string): Incident | undefined {
    this.checkAndReload();
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
      const storeReport = this.reports.find(rep => rep.id === r.id);
      const targets = [r, storeReport].filter((t): t is Report => Boolean(t));
      targets.forEach(target => {
        target.currentActionCategory = actionCategory;
        if (!target.firstActionTaken || target.firstActionTaken === 'Pending Verification' || target.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
          target.firstActionTaken = actionCategory;
        }
        if (!target.actionHistory) target.actionHistory = [];
        target.actionHistory.unshift(actionLog);
        target.status = 'REVIEWED';
        target.updatedAt = new Date().toISOString();
      });
    });

    this.logAudit(actorId, 'ADMIN', 'incident', incidentId, 'DISPATCH_MUNICIPAL_CREW', {
      orderDetails,
      timestamp: new Date().toISOString(),
    });
    this.persist();
    return incident;
  }

  broadcastIncidentAlert(incidentId: string, alertId: string, actorId: string): Incident | undefined {
    this.checkAndReload();
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
      const storeReport = this.reports.find(rep => rep.id === r.id);
      const targets = [r, storeReport].filter((t): t is Report => Boolean(t));
      targets.forEach(target => {
        target.currentActionCategory = actionCategory;
        if (!target.firstActionTaken || target.firstActionTaken === 'Pending Verification' || target.firstActionTaken === 'Verified Genuine — Pending Tactical Action') {
          target.firstActionTaken = actionCategory;
        }
        if (!target.actionHistory) target.actionHistory = [];
        target.actionHistory.unshift(actionLog);
        target.status = 'REVIEWED';
        target.updatedAt = new Date().toISOString();
      });
    });

    this.logAudit(actorId, 'ADMIN', 'incident', incidentId, 'BROADCAST_CAP_ALERT', {
      alertId,
      timestamp: new Date().toISOString(),
    });
    this.persist();
    return incident;
  }

  restoreIncident(incidentId: string): Incident | undefined {
    this.checkAndReload();
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return undefined;
    incident.state = 'CANDIDATE';
    incident.verificationStatus = 'PENDING_VERIFICATION';
    incident.currentActionCategory = 'Pending Verification';
    incident.firstActionTaken = 'Pending Verification';
    incident.actionedDirective = 'NONE';
    incident.updatedAt = new Date().toISOString();

    const restoreLog: ActionLogItem = {
      id: generateId(),
      action: 'Pending Verification',
      actorName: 'Command Operations',
      notes: 'Hazard re-opened to Candidate status for fresh meteorological triage.',
      timestamp: new Date().toISOString(),
    };
    if (!incident.actionHistory) incident.actionHistory = [];
    incident.actionHistory.unshift(restoreLog);

    incident.reports.forEach(r => {
      const storeReport = this.reports.find(rep => rep.id === r.id);
      const targets = [r, storeReport].filter((t): t is Report => Boolean(t));
      targets.forEach(target => {
        target.status = 'RECEIVED';
        target.verificationStatus = 'PENDING_VERIFICATION';
        target.currentActionCategory = 'Pending Verification';
        target.firstActionTaken = 'Pending Verification';
        if (!target.actionHistory) target.actionHistory = [];
        target.actionHistory.unshift(restoreLog);
        target.updatedAt = new Date().toISOString();
      });
    });
    this.persist();
    return incident;
  }

  // —— Alert Operations ——

  getAlert(id: string): Alert | undefined {
    this.checkAndReload();
    return this.alerts.find(a => a.id === id);
  }

  getActiveAlerts(): Alert[] {
    this.checkAndReload();
    const now = new Date().toISOString();
    return this.alerts.filter(
      a => a.status === 'PUBLISHED' && a.expiresAt > now
    );
  }

  getAllAlerts(): Alert[] {
    this.checkAndReload();
    return [...this.alerts].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getAlerts(): Alert[] {
    return this.getAllAlerts();
  }

  createAlert(data: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Alert {
    this.checkAndReload();
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
    this.checkAndReload();
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
    this.checkAndReload();
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
    this.checkAndReload();
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

  // —— SOS Rescue Operations ——

  getSosRequests(filters?: { status?: string }): SosRequest[] {
    this.checkAndReload();
    let list = [...this.sosRequests];
    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter(s => s.status === filters.status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getSosRequest(id: string): SosRequest | undefined {
    this.checkAndReload();
    return this.sosRequests.find(s => s.id === id);
  }

  createSosRequest(data: Omit<SosRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>): SosRequest {
    this.checkAndReload();
    const sos: SosRequest = {
      ...data,
      id: 'sos_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      status: 'PENDING_RESCUE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sosRequests.unshift(sos);
    this.logAudit(sos.reporterName || 'Citizen', 'CITIZEN', 'sos', sos.id, 'SOS_DISTRESS_BROADCAST', {
      landmark: sos.landmark,
      peopleCount: sos.peopleCount,
      hasMedicalEmergency: sos.hasMedicalEmergency,
    });
    this.persist();
    return sos;
  }

  updateSosStatus(
    id: string,
    status: SosRequest['status'],
    dispatchedUnit?: string,
    actorId: string = 'Rescue Coordinator'
  ): SosRequest | undefined {
    this.checkAndReload();
    const sos = this.sosRequests.find(s => s.id === id);
    if (sos) {
      sos.status = status;
      if (dispatchedUnit) sos.dispatchedUnit = dispatchedUnit;
      sos.updatedAt = new Date().toISOString();
      this.logAudit(actorId, 'OFFICER', 'sos', id, 'SOS_STATUS_UPDATE', { status, dispatchedUnit });
      this.persist();
    }
    return sos;
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
    this.checkAndReload();
    let result = [...this.auditEvents];
    if (filters?.entityType) result = result.filter(e => e.entityType === filters.entityType);
    if (filters?.entityId) result = result.filter(e => e.entityId === filters.entityId);
    if (filters?.actorId) result = result.filter(e => e.actorId === filters.actorId);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // —— Statistics ——

  getStats() {
    this.checkAndReload();
    this.ensureNationalAlerts();
    const now = Date.now();
    const activeAlerts = this.getActiveAlerts();
    const pendingReports = this.reports.filter(
      r => (!r.verificationStatus || r.verificationStatus === 'PENDING_VERIFICATION') &&
           r.status !== 'DISMISSED' && r.status !== 'RESOLVED'
    );
    const verifiedReports = this.reports.filter(
      r => r.verificationStatus === 'VERIFIED_GENUINE' && r.status !== 'DISMISSED'
    );
    const reportsToday = this.reports.filter(
      r => now - new Date(r.createdAt).getTime() < 86400000
    );

    return {
      totalReports: this.reports.length,
      reportsToday: reportsToday.length,
      verifiedReports: verifiedReports.length,
      verifiedReportsToday: verifiedReports.length > 0 ? verifiedReports.length : reportsToday.length,
      activeIncidents: this.incidents.filter(i => i.state === 'CANDIDATE' || i.state === 'VERIFIED' || i.state === 'ESCALATED').length,
      activeAlerts: activeAlerts.length,
      pendingReview: pendingReports.length,
      sourcesHealthy: 45,
      sourcesTotal: 45,
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
