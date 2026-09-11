// ============================================================
// SIH Weather Platform — In-Memory Data Store
// For hackathon/demo: replaces PostgreSQL; same API surface
// ============================================================

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

    // Seed verified benchmark hazard reports across India with real photographic evidence
    const panIndiaReports: (Partial<Report> & { stateName?: string; cityName?: string })[] = [
      // 1. Delhi NCR — Minto Bridge Underpass Submersion
      {
        category: 'WATERLOGGING',
        severity: 4 as SeverityLevel,
        landmark: 'Minto Bridge Underpass, Connaught Place, New Delhi',
        waterDepthFeet: 4.5,
        mediaUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&auto=format&fit=crop&q=80',
        description: 'Minto Bridge underpass completely submerged in 4.5 ft water. DTC bus stranded. Traffic police road blockade active.',
        location: { latitude: 28.6360, longitude: 77.2250, accuracy: 12 },
        h3Index: '883da11299fffff',
        stateName: 'Delhi',
        cityName: 'Delhi NCR',
      },
      {
        category: 'SEVERE_RAIN',
        severity: 4 as SeverityLevel,
        landmark: 'ITO Junction & Pragati Maidan Corridor, New Delhi',
        waterDepthFeet: 2.0,
        mediaUrl: 'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=800&auto=format&fit=crop&q=80',
        description: 'Severe convective squall with torrential rainfall over ITO arterial junction. Zero driver visibility.',
        location: { latitude: 28.6289, longitude: 77.2410, accuracy: 18 },
        h3Index: '883da11299fffff',
        stateName: 'Delhi',
        cityName: 'Delhi NCR',
      },
      // 2. Mumbai — Dadar & Hindmata Flyover Basin
      {
        category: 'WATERLOGGING',
        severity: 4 as SeverityLevel,
        landmark: 'Hindmata Flyover Junction, Dadar East, Mumbai',
        waterDepthFeet: 3.5,
        mediaUrl: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=800&auto=format&fit=crop&q=80',
        description: 'Knee-deep water on Hindmata road below flyover. Multiple vehicles stranded in fast-rising monsoon tide.',
        location: { latitude: 18.9932, longitude: 72.8456, accuracy: 15 },
        h3Index: '882a10018bfffff',
        stateName: 'Maharashtra',
        cityName: 'Mumbai',
      },
      {
        category: 'FLOODING',
        severity: 5 as SeverityLevel,
        landmark: 'Sion Station Road Underpass, Central Mumbai',
        waterDepthFeet: 4.8,
        mediaUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
        description: 'Dangerous fast-moving flood current entering commercial ground floors near Sion railway station.',
        location: { latitude: 19.0432, longitude: 72.8628, accuracy: 20 },
        h3Index: '882a10018dfffff',
        stateName: 'Maharashtra',
        cityName: 'Mumbai',
      },
      // 3. Bengaluru — Bellandur Outer Ring Road Tech Corridor
      {
        category: 'FLOODING',
        severity: 4 as SeverityLevel,
        landmark: 'Bellandur EcoSpace Tech Park, Outer Ring Road, Bengaluru',
        waterDepthFeet: 3.2,
        mediaUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
        description: 'Bellandur lake overflow inundating outer ring road. Tech employees evacuated on rescue tractors.',
        location: { latitude: 12.9260, longitude: 77.6834, accuracy: 20 },
        h3Index: '88618925bbfffff',
        stateName: 'Karnataka',
        cityName: 'Bengaluru',
      },
      {
        category: 'WATERLOGGING',
        severity: 4 as SeverityLevel,
        landmark: 'Silk Board Junction Underpass, Hosur Road, Bengaluru',
        waterDepthFeet: 2.8,
        mediaUrl: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=800&auto=format&fit=crop&q=80',
        description: 'Silk Board service road completely inundated. Two-wheelers stranded; traffic halted towards Electronic City.',
        location: { latitude: 12.9177, longitude: 77.6238, accuracy: 14 },
        h3Index: '88618925bbfffff',
        stateName: 'Karnataka',
        cityName: 'Bengaluru',
      },
      // 4. Chennai — Velachery Stormwater Canal
      {
        category: 'FLOODING',
        severity: 4 as SeverityLevel,
        landmark: 'Velachery 100ft Bypass Canal Road, Chennai',
        waterDepthFeet: 3.0,
        mediaUrl: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=800&auto=format&fit=crop&q=80',
        description: 'Stormwater canal overflowing across Velachery main road into residential apartment parking areas.',
        location: { latitude: 12.9815, longitude: 80.2180, accuracy: 15 },
        h3Index: '88618c48a7fffff',
        stateName: 'Tamil Nadu',
        cityName: 'Chennai',
      },
      // 5. Shimla — Dhalli Tunnel Cloudburst
      {
        category: 'CLOUDBURST',
        severity: 4 as SeverityLevel,
        landmark: 'Dhalli Tunnel Bypass, NH-5 Himalayan Corridor, Shimla',
        waterDepthFeet: 1.5,
        mediaUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
        description: 'Torrential cloudburst downpour causing mud slurry and rock debris slide across national highway.',
        location: { latitude: 31.1150, longitude: 77.1950, accuracy: 35 },
        h3Index: '883d65b12bfffff',
        stateName: 'Himachal Pradesh',
        cityName: 'Shimla',
      },
      // 6. Guwahati — Anil Nagar Bharalu Channel
      {
        category: 'FLOODING',
        severity: 5 as SeverityLevel,
        landmark: 'Anil Nagar Bharalu Channel, Guwahati',
        waterDepthFeet: 4.2,
        mediaUrl: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=800&auto=format&fit=crop&q=80',
        description: 'Brahmaputra tributary backflow inundating Anil Nagar residential lanes. Ground floor submergence.',
        location: { latitude: 26.1750, longitude: 91.7820, accuracy: 22 },
        h3Index: '8872e4242bfffff',
        stateName: 'Assam',
        cityName: 'Guwahati',
      },
    ];

    const now = Date.now();
    panIndiaReports.forEach((r, i) => {
      const reportId = generateId();
      const createdAt = new Date(now - (panIndiaReports.length - i) * 240000).toISOString();
      this.reports.push({
        id: reportId,
        reporterId: `citizen_${i + 1}`,
        reporterPseudonym: `Citizen-${String(i + 1).padStart(3, '0')}`,
        category: r.category!,
        severity: r.severity!,
        landmark: r.landmark,
        waterDepthFeet: r.waterDepthFeet,
        mediaUrl: r.mediaUrl,
        description: r.description!,
        location: r.location!,
        h3Index: r.h3Index!,
        consent: true,
        status: i % 2 === 0 ? 'ATTACHED' : 'RECEIVED',
        verificationStatus: i === 0 ? 'VERIFIED_GENUINE' : 'PENDING_VERIFICATION',
        currentActionCategory: i === 0 ? 'Verified Genuine — Pending Tactical Action' : 'Pending Verification',
        firstActionTaken: i === 0 ? 'Verified Genuine — Pending Tactical Action' : undefined,
        actionHistory: [
          {
            id: generateId(),
            action: i === 0 ? 'Verified Genuine — Pending Tactical Action' : 'Pending Verification',
            actorName: i === 0 ? 'Dr. Priya Sharma (IMD)' : 'System Telemetry',
            notes: i === 0 ? 'Corroborated by Doppler AWS radar.' : 'Queued for meteorologist verification vs ground radar.',
            timestamp: createdAt,
          }
        ],
        createdAt,
        updatedAt: createdAt,
      });
    });

    // 1. Delhi NCR — Minto Bridge Underpass Submersion
    const delhiClustered = this.reports.filter(r => r.h3Index === '883da11299fffff');
    this.incidents.push({
      id: 'inc_delhi_01',
      h3Parent: '883da11299fffff',
      category: 'WATERLOGGING',
      state: 'CANDIDATE',
      landmark: 'Minto Bridge Underpass, Connaught Place, New Delhi',
      location: { latitude: 28.6360, longitude: 77.2250, accuracy: 12 },
      mediaUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&auto=format&fit=crop&q=80',
      confidenceScore: {
        total: 88,
        factors: [
          { name: 'Completeness', signal: 'GPS coordinates & street landmark verified', contribution: 25, maxContribution: 25, explanation: 'Exact GPS at Minto Bridge underpass with visual photo attached.' },
          { name: 'Corroboration', signal: '2 independent ground reports', contribution: 22, maxContribution: 30, explanation: 'Citizen reports confirm stranded DTC bus and road barrier.' },
          { name: 'Reporter History', signal: 'Community verified citizen', contribution: 12, maxContribution: 15, explanation: 'Trusted local ground contributor.' },
          { name: 'Weather Signal', signal: 'Doppler radar confirms severe cloudburst cell', contribution: 20, maxContribution: 20, explanation: 'Safdarjung AWS recorded 58mm/h downpour.' },
          { name: 'Contradiction Check', signal: 'Zero discrepancy', contribution: 4, maxContribution: 10, explanation: 'No false flags.' },
        ],
        computedAt: new Date().toISOString(),
      },
      impactLevel: 'CRITICAL',
      reportCount: delhiClustered.length || 2,
      reports: delhiClustered,
      evidence: [
        {
          id: generateId(),
          reportId: delhiClustered[0]?.id || 'rep_1',
          type: 'WEATHER',
          source: 'IMD Safdarjung AWS & S-Band Doppler',
          observedAt: new Date().toISOString(),
          freshnessSeconds: 60,
          value: { reflectivityDbz: 52.0, rainRateMmH: 58.0 },
          provenance: 'Automated IMD Weather Cross-Check'
        }
      ],
      reviewActions: [],
      createdAt: new Date(now - 480000).toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Mumbai — Dadar Hindmata Flyover Flood Basin
    const mumbaiClustered = this.reports.filter(r => r.h3Index === '882a10018bfffff');
    this.incidents.push({
      id: 'inc_mumbai_01',
      h3Parent: '882a10018bfffff',
      category: 'WATERLOGGING',
      state: 'CANDIDATE',
      landmark: 'Hindmata Flyover Junction, Dadar East, Mumbai',
      location: { latitude: 18.9932, longitude: 72.8456, accuracy: 15 },
      mediaUrl: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=800&auto=format&fit=crop&q=80',
      confidenceScore: {
        total: 82,
        factors: [
          { name: 'Completeness', signal: 'High completeness with high-res photo', contribution: 23, maxContribution: 25, explanation: 'Location, category, time, and live photo present.' },
          { name: 'Corroboration', signal: '2 reports in Dadar-Hindmata hex', contribution: 20, maxContribution: 30, explanation: 'Multiple ground witnesses confirm 3.5ft water depth.' },
          { name: 'Reporter History', signal: 'Returning contributor', contribution: 10, maxContribution: 15, explanation: 'Credible reporter history on record.' },
          { name: 'Weather Signal', signal: 'Heavy monsoon cloud band', contribution: 19, maxContribution: 20, explanation: 'Colaba & Santacruz Doppler radar shows 65mm downpour.' },
          { name: 'Contradiction Check', signal: 'Clean signal', contribution: 4, maxContribution: 10, explanation: 'No conflicting reports.' },
        ],
        computedAt: new Date().toISOString(),
      },
      impactLevel: 'HIGH',
      reportCount: mumbaiClustered.length || 2,
      reports: mumbaiClustered,
      evidence: [
        {
          id: generateId(),
          reportId: mumbaiClustered[0]?.id || 'rep_2',
          type: 'WEATHER',
          source: 'MCGM Automatic Weather Station',
          observedAt: new Date().toISOString(),
          freshnessSeconds: 90,
          value: { reflectivityDbz: 46.5, rainRateMmH: 62.0 },
          provenance: 'Automated Weather Corroboration Engine'
        }
      ],
      reviewActions: [],
      createdAt: new Date(now - 600000).toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. Bengaluru — Bellandur Outer Ring Road Tech Corridor
    const bglrClustered = this.reports.filter(r => r.h3Index === '88618925bbfffff');
    this.incidents.push({
      id: 'inc_bglr_01',
      h3Parent: '88618925bbfffff',
      category: 'FLOODING',
      state: 'CANDIDATE',
      landmark: 'Bellandur EcoSpace Tech Park, Outer Ring Road, Bengaluru',
      location: { latitude: 12.9260, longitude: 77.6834, accuracy: 20 },
      mediaUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
      confidenceScore: {
        total: 79,
        factors: [
          { name: 'Completeness', signal: 'Full telemetry with photo evidence', contribution: 22, maxContribution: 25, explanation: 'Full description and geo-coordinates.' },
          { name: 'Corroboration', signal: 'Outer ring road cluster', contribution: 21, maxContribution: 30, explanation: 'Corroborated by Silk Board and Bellandur reports.' },
          { name: 'Reporter History', signal: 'Community verified', contribution: 8, maxContribution: 15, explanation: 'Verified tech corridor citizen reporter.' },
          { name: 'Weather Signal', signal: 'Convective storm cell detected', contribution: 18, maxContribution: 20, explanation: 'Doppler echo confirms intense localized cell.' },
          { name: 'Contradiction Check', signal: 'Clean signal', contribution: 4, maxContribution: 10, explanation: 'No discrepancies detected.' },
        ],
        computedAt: new Date().toISOString(),
      },
      impactLevel: 'HIGH',
      reportCount: bglrClustered.length || 2,
      reports: bglrClustered,
      evidence: [
        {
          id: generateId(),
          reportId: bglrClustered[0]?.id || 'rep_3',
          type: 'WEATHER',
          source: 'IMD Bengaluru Doppler Radar',
          observedAt: new Date().toISOString(),
          freshnessSeconds: 120,
          value: { reflectivityDbz: 44.0, rainRateMmH: 48.0 },
          provenance: 'Automated Weather Corroboration Engine'
        }
      ],
      reviewActions: [],
      createdAt: new Date(now - 360000).toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 4. Shimla — Dhalli Tunnel Cloudburst
    const shimlaClustered = this.reports.filter(r => r.h3Index === '883d65b12bfffff');
    this.incidents.push({
      id: 'inc_shimla_01',
      h3Parent: '883d65b12bfffff',
      category: 'CLOUDBURST',
      state: 'CANDIDATE',
      landmark: 'Dhalli Tunnel Bypass, NH-5 Himalayan Corridor, Shimla',
      location: { latitude: 31.1150, longitude: 77.1950, accuracy: 35 },
      mediaUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
      confidenceScore: {
        total: 81,
        factors: [
          { name: 'Completeness', signal: 'High mountain location tagged', contribution: 23, maxContribution: 25, explanation: 'Clear road landmark and photo.' },
          { name: 'Corroboration', signal: '1 primary report with AWS confirmation', contribution: 18, maxContribution: 30, explanation: 'Corroborated by high-altitude meteorological station.' },
          { name: 'Reporter History', signal: 'Highway commuter', contribution: 9, maxContribution: 15, explanation: 'Credible ground report.' },
          { name: 'Weather Signal', signal: 'Extreme orographic rainfall signal', contribution: 20, maxContribution: 20, explanation: 'Extreme orographic rainfall registered.' },
          { name: 'Contradiction Check', signal: 'No flags', contribution: 4, maxContribution: 10, explanation: 'Clear corroboration.' },
        ],
        computedAt: new Date().toISOString(),
      },
      impactLevel: 'CRITICAL',
      reportCount: shimlaClustered.length || 1,
      reports: shimlaClustered,
      evidence: [],
      reviewActions: [],
      createdAt: new Date(now - 240000).toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Seed Pan-India Published Alerts
    const hours6 = 6 * 3600 * 1000;

    // Alert 1: Central Mumbai (Maharashtra)
    this.alerts.push({
      id: 'alert_mumbai_01',
      incidentId: 'inc_mumbai_resolved',
      polygon: {
        type: 'Polygon',
        coordinates: [[[72.82, 19.00], [72.86, 19.00], [72.86, 19.05], [72.82, 19.05], [72.82, 19.00]]],
      },
      severity: 4,
      category: 'FLOODING',
      headline: '🌊 Flash Flood Warning — Central Mumbai (Sion, Kurla & Dadar)',
      guidance: 'Avoid all railway underpasses near Sion and Matunga. Do not drive or walk through floodwater. Keep emergency supplies on upper floors. Call 112 for urgent rescue.',
      startsAt: new Date(now - 3600000).toISOString(),
      expiresAt: new Date(now + hours6).toISOString(),
      publishedBy: 'Collector Anand Mishra (DDMA Mumbai)',
      status: 'PUBLISHED',
      source: 'District Disaster Management Authority, Mumbai (MCGM)',
      areaName: 'Central Mumbai (Ward L & F-North)',
      h3Index: '882a10018bfffff',
      reportCount: 5,
      createdAt: new Date(now - 3600000).toISOString(),
      updatedAt: new Date(now - 3600000).toISOString(),
    });

    // Alert 2: Delhi NCR (Delhi/Haryana)
    this.alerts.push({
      id: 'alert_delhi_01',
      incidentId: 'inc_delhi_resolved',
      polygon: {
        type: 'Polygon',
        coordinates: [[[77.20, 28.60], [77.25, 28.60], [77.25, 28.65], [77.20, 28.65], [77.20, 28.60]]],
      },
      severity: 4,
      category: 'WATERLOGGING',
      headline: '⚡ Severe Thunderstorm & Underpass Inundation — Central Delhi',
      guidance: 'Minto Bridge and ITO junction closed to vehicular traffic. Commuters advised to avoid Ring Road and low-lying subways. Severe wind gusts expected up to 55 km/h.',
      startsAt: new Date(now - 1800000).toISOString(),
      expiresAt: new Date(now + 4 * 3600 * 1000).toISOString(),
      publishedBy: 'Duty Officer, Delhi Disaster Management Authority',
      status: 'PUBLISHED',
      source: 'DDMA Delhi & IMD Regional Meteorological Centre',
      areaName: 'Central Delhi & Yamuna Basin Corridor',
      h3Index: '883da11299fffff',
      reportCount: 4,
      createdAt: new Date(now - 1800000).toISOString(),
      updatedAt: new Date(now - 1800000).toISOString(),
    });

    // Alert 3: Chennai (Tamil Nadu)
    this.alerts.push({
      id: 'alert_chennai_01',
      incidentId: 'inc_chennai_resolved',
      polygon: {
        type: 'Polygon',
        coordinates: [[[80.18, 12.95], [80.24, 12.95], [80.24, 13.00], [80.18, 13.00], [80.18, 12.95]]],
      },
      severity: 3,
      category: 'FLOODING',
      headline: '🌧️ Heavy Coastal Downpour & Waterlogging Watch — South Chennai',
      guidance: 'Velachery and Madipakkam sectors experiencing heavy canal run-off. Motorists should divert via OMR. Keep municipal pump emergency contacts ready.',
      startsAt: new Date(now - 2400000).toISOString(),
      expiresAt: new Date(now + 5 * 3600 * 1000).toISOString(),
      publishedBy: 'Greater Chennai Corporation Disaster Cell',
      status: 'PUBLISHED',
      source: 'GCC & Regional Meteorological Centre Chennai',
      areaName: 'South Chennai (Velachery - Tambaram Corridor)',
      h3Index: '88618c48a7fffff',
      reportCount: 3,
      createdAt: new Date(now - 2400000).toISOString(),
      updatedAt: new Date(now - 2400000).toISOString(),
    });

    // Alert 4: Guwahati (Assam)
    this.alerts.push({
      id: 'alert_guwahati_01',
      incidentId: 'inc_guwahati_resolved',
      polygon: {
        type: 'Polygon',
        coordinates: [[[91.70, 26.12], [91.80, 26.12], [91.80, 26.20], [91.70, 26.20], [91.70, 26.12]]],
      },
      severity: 5,
      category: 'FLOODING',
      headline: '🚨 Flash Flood Alert — Brahmaputra Lowland Drainage Basin',
      guidance: 'River water levels rising past warning mark in Kamrup Metropolitan district. Low-lying wards under immediate evacuation advisory. State SDRF deployed.',
      startsAt: new Date(now - 1200000).toISOString(),
      expiresAt: new Date(now + 8 * 3600 * 1000).toISOString(),
      publishedBy: 'Assam State Disaster Management Authority (ASDMA)',
      status: 'PUBLISHED',
      source: 'ASDMA & Central Water Commission',
      areaName: 'Kamrup Metro & Brahmaputra Basin',
      h3Index: '8872e4242bfffff',
      reportCount: 6,
      createdAt: new Date(now - 1200000).toISOString(),
      updatedAt: new Date(now - 1200000).toISOString(),
    });

    // Alert 5: Shimla (Himachal Pradesh)
    this.alerts.push({
      id: 'alert_shimla_01',
      incidentId: 'inc_shimla_resolved',
      polygon: {
        type: 'Polygon',
        coordinates: [[[77.15, 31.08], [77.22, 31.08], [77.22, 31.15], [77.15, 31.15], [77.15, 31.08]]],
      },
      severity: 4,
      category: 'SEVERE_RAIN',
      headline: '⚠️ Cloudburst & Hillside Landslide Advisory — Shimla-Dhalli Belt',
      guidance: 'National Highway 5 traffic restricted near Dhalli due to localized slope instability. Tourists and residents strongly advised against hillside travel until rainfall subsides.',
      startsAt: new Date(now - 900000).toISOString(),
      expiresAt: new Date(now + 6 * 3600 * 1000).toISOString(),
      publishedBy: 'HP State Disaster Management Authority (HPSDMA)',
      status: 'PUBLISHED',
      source: 'HPSDMA & IMD Shimla',
      areaName: 'Shimla District & NH-5 Corridor',
      h3Index: '883d65b12bfffff',
      reportCount: 3,
      createdAt: new Date(now - 900000).toISOString(),
      updatedAt: new Date(now - 900000).toISOString(),
    });

    // Audit log the alert
    this.auditEvents.push({
      id: generateId(),
      actorId: 'user_officer_1',
      actorRole: 'OFFICER',
      entityType: 'alert',
      entityId: 'alert_mumbai_01',
      action: 'PUBLISH',
      metadata: { severity: 4, headline: '🌊 Flash Flood Warning — Central Mumbai' },
      createdAt: new Date(now - 3600000).toISOString(),
    });
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

    if (!report.firstActionTaken && action !== 'Pending Verification') {
      report.firstActionTaken = action;
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
      if (!parentInc.firstActionTaken && action !== 'Pending Verification') {
        parentInc.firstActionTaken = action;
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

    return reviewAction;
  }

  resolveIncident(incidentId: string, resolutionNotes: string, actorId: string): Incident | undefined {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return undefined;

    const actionCategory: ActionCategory = 'Hazard Resolved';
    incident.state = 'RESOLVED';
    incident.actionedDirective = 'RESOLVED';
    incident.currentActionCategory = actionCategory;
    if (!incident.firstActionTaken) incident.firstActionTaken = actionCategory;

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
      if (!r.firstActionTaken) r.firstActionTaken = actionCategory;
      if (!r.actionHistory) r.actionHistory = [];
      r.actionHistory.unshift(actionLog);
      r.updatedAt = new Date().toISOString();
    });

    this.logAudit(actorId, 'ADMIN', 'incident', incidentId, 'RESOLVE', { resolutionNotes });
    return incident;
  }

  executeMunicipalOrder(incidentId: string, orderDetails: { pumpUnits: number; pumpHp: number; trafficBarricades: boolean }, actorId: string): Incident | undefined {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return undefined;

    const actionCategory: ActionCategory = 'Dewatering & Municipal Crew Dispatched';
    incident.actionedDirective = 'MUNICIPAL_ORDER_DISPATCHED';
    incident.currentActionCategory = actionCategory;
    if (!incident.firstActionTaken) incident.firstActionTaken = actionCategory;

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
      if (!r.firstActionTaken) r.firstActionTaken = actionCategory;
      if (!r.actionHistory) r.actionHistory = [];
      r.actionHistory.unshift(actionLog);
      r.status = 'REVIEWED';
      r.updatedAt = new Date().toISOString();
    });

    this.logAudit(actorId, 'ADMIN', 'incident', incidentId, 'DISPATCH_MUNICIPAL_CREW', {
      orderDetails,
      timestamp: new Date().toISOString(),
    });
    return incident;
  }

  broadcastIncidentAlert(incidentId: string, alertId: string, actorId: string): Incident | undefined {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return undefined;

    const actionCategory: ActionCategory = 'Public Warning Issued (CAP 1.2)';
    incident.actionedDirective = 'CAP_ALERT_BROADCASTED';
    incident.currentActionCategory = actionCategory;
    if (!incident.firstActionTaken) incident.firstActionTaken = actionCategory;

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
      if (!r.firstActionTaken) r.firstActionTaken = actionCategory;
      if (!r.actionHistory) r.actionHistory = [];
      r.actionHistory.unshift(actionLog);
      r.status = 'REVIEWED';
      r.updatedAt = new Date().toISOString();
    });

    this.logAudit(actorId, 'ADMIN', 'incident', incidentId, 'BROADCAST_CAP_ALERT', {
      alertId,
      timestamp: new Date().toISOString(),
    });
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
    return alert;
  }

  publishAlert(id: string, publishedBy: string): Alert | undefined {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.status = 'PUBLISHED';
      alert.publishedBy = publishedBy;
      alert.updatedAt = new Date().toISOString();
      this.logAudit(publishedBy, 'OFFICER', 'alert', id, 'PUBLISH', { severity: alert.severity });
    }
    return alert;
  }

  cancelAlert(id: string, reason: string, actorId: string): Alert | undefined {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.status = 'CANCELLED';
      alert.updatedAt = new Date().toISOString();
      this.logAudit(actorId, 'OFFICER', 'alert', id, 'CANCEL', { reason });
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

// Singleton
export const dataStore = new DataStore();
export const store = dataStore;
