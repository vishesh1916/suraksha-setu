// ============================================================
// SIH Weather Platform — Core Types
// ============================================================

// —— Enums ——

export type UserRole = 'CITIZEN' | 'REVIEWER' | 'OFFICER' | 'ADMIN';

export type HazardCategory =
  | 'FLOODING'
  | 'WATERLOGGING'
  | 'SEVERE_RAIN'
  | 'STRONG_WIND'
  | 'HAIL'
  | 'CLOUDBURST'
  | 'OTHER';

export type SeverityLevel = 1 | 2 | 3 | 4 | 5;

export type ReportStatus = 'QUEUED' | 'RECEIVED' | 'ATTACHED' | 'REVIEWED' | 'DISMISSED' | 'RESOLVED';

export type IncidentState = 'CANDIDATE' | 'VERIFIED' | 'DISMISSED' | 'ESCALATED' | 'RESOLVED' | 'FOLLOW_UP_REQUIRED';

export type AlertStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'EXPIRED';

export type ReviewActionType = 'VERIFY' | 'DISMISS' | 'FOLLOW_UP' | 'ESCALATE';

export type EvidenceType = 'WEATHER' | 'SENSOR' | 'DEDUPE' | 'MANUAL' | 'CORROBORATION';

export type SourceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'OFFLINE';

export type ImpactLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

// —— Location ——

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number; // meters
}

export interface H3Cell {
  index: string; // H3 hex address
  resolution: number;
}

export type VerificationStatus = 'PENDING_VERIFICATION' | 'VERIFIED_GENUINE' | 'FLAGGED_FALSE_REPORT';

export type ActionCategory =
  | 'Pending Verification'
  | 'Flagged False Alarm / Dismissed'
  | 'Verified Genuine — Pending Tactical Action'
  | 'Evacuation Ordered'
  | 'Dewatering & Municipal Crew Dispatched'
  | 'Public Warning Issued (CAP 1.2)'
  | 'Search & Rescue Deployed'
  | 'Meteorological Monitoring'
  | 'Hazard Resolved';

export interface ActionLogItem {
  id: string;
  action: ActionCategory | string;
  actorName: string;
  notes?: string;
  timestamp: string;
}

// —— Report ——

export interface Report {
  id: string;
  reporterId: string;
  reporterPseudonym: string;
  category: HazardCategory;
  severity: SeverityLevel;
  description: string;
  location: GeoPoint;
  h3Index: string; // H3 resolution 8
  mediaUrl?: string;
  mediaHash?: string;
  landmark?: string;
  waterDepthFeet?: number;
  consent: boolean;
  status: ReportStatus;
  verificationStatus?: VerificationStatus;
  verificationRationale?: string;
  firstActionTaken?: ActionCategory;
  currentActionCategory?: ActionCategory;
  actionHistory?: ActionLogItem[];
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface ReportFormData {
  category: HazardCategory;
  severity: SeverityLevel;
  description: string;
  location: GeoPoint;
  media?: File;
  consent: boolean;
}

export interface OfflineDraft {
  id: string;
  data: ReportFormData;
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
}

// —— Evidence ——

export interface Evidence {
  id: string;
  reportId: string;
  type: EvidenceType;
  source: string;
  observedAt: string;
  freshnessSeconds: number;
  value: Record<string, unknown>;
  provenance: string;
}

// —— Confidence Score ——

export interface ConfidenceScore {
  total: number; // 0-100
  factors: ConfidenceFactor[];
  computedAt: string;
}

export interface ConfidenceFactor {
  name: string;
  signal: string;
  contribution: number; // points added/subtracted
  maxContribution: number;
  explanation: string;
  source?: string;
  freshness?: 'fresh' | 'stale' | 'unavailable';
}

// —— Incident ——

export interface Incident {
  id: string;
  h3Parent: string;
  category: HazardCategory;
  state: IncidentState;
  confidenceScore: ConfidenceScore;
  impactLevel: ImpactLevel;
  ownerId?: string;
  reportCount: number;
  reports: Report[];
  evidence: Evidence[];
  reviewActions: ReviewAction[];
  landmark?: string;
  location?: GeoPoint;
  mediaUrl?: string;
  actionedDirective?: 'CAP_ALERT_BROADCASTED' | 'MUNICIPAL_ORDER_DISPATCHED' | 'RESOLVED' | 'NONE';
  verificationStatus?: VerificationStatus;
  firstActionTaken?: ActionCategory;
  currentActionCategory?: ActionCategory;
  actionHistory?: ActionLogItem[];
  municipalOrder?: {
    orderId: string;
    pumpUnits: number;
    pumpHp: number;
    trafficBarricades: boolean;
    issuedAt: string;
    dispatchedAgency?: string;
  };
  resolution?: {
    reason: string;
    resolvedAt: string;
    actorName: string;
  };
  followUpInquiry?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentCandidate {
  id: string;
  h3Parent: string;
  category: HazardCategory;
  state: IncidentState;
  confidenceScore: number;
  impactLevel: ImpactLevel;
  reportCount: number;
  latestReportAt: string;
  createdAt: string;
}

// —— Alert ——

export interface Alert {
  id: string;
  incidentId: string;
  polygon: GeoJSON.Polygon;
  severity: SeverityLevel;
  category: HazardCategory;
  headline: string;
  guidance: string;
  startsAt: string;
  expiresAt: string;
  publishedBy?: string;
  status: AlertStatus;
  source: string;
  areaName?: string;
  h3Index?: string;
  reportCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertDraft {
  incidentId: string;
  polygon: GeoJSON.Polygon;
  severity: SeverityLevel;
  headline: string;
  guidance: string;
  expiresAt: string;
}

// —— Review ——

export interface ReviewAction {
  id: string;
  incidentId: string;
  actorId: string;
  actorName: string;
  action: ReviewActionType;
  reason: string;
  priorState: IncidentState;
  resultState: IncidentState;
  createdAt: string;
}

// —— Source Health ——

export interface SourceHealth {
  source: string;
  lastSuccessAt: string;
  freshnessSeconds: number;
  status: SourceHealthStatus;
  errorSummary?: string;
}

// —— Audit ——

export interface AuditEvent {
  id: string;
  actorId: string;
  actorRole: UserRole;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// —— User ——

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  confirmedReports: number;
  createdAt: string;
}

// —— API Response Types ——

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// —— Weather Data ——

export interface WeatherData {
  source: string;
  location: GeoPoint;
  temperature?: number;
  humidity?: number;
  rainfall_mm?: number;
  windSpeed_kmh?: number;
  windDirection?: number;
  visibility_km?: number;
  cloudCover?: number;
  pressure_hpa?: number;
  description?: string;
  icon?: string;
  observedAt: string;
  freshnessSeconds: number;
}

// —— Map Types ——

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

// —— Notification ——

export interface Notification {
  id: string;
  type: 'alert' | 'status_update' | 'system';
  title: string;
  body: string;
  alertId?: string;
  read: boolean;
  createdAt: string;
}

// —— Hazard Category Metadata ——

export const HAZARD_CATEGORIES: Record<HazardCategory, {
  label: string;
  labelHi: string;
  icon: string;
  color: string;
  description: string;
}> = {
  FLOODING: {
    label: 'Flooding',
    labelHi: 'बाढ़',
    icon: '🌊',
    color: '#3b82f6',
    description: 'Water entering buildings, roads submerged',
  },
  WATERLOGGING: {
    label: 'Waterlogging',
    labelHi: 'जलभराव',
    icon: '💧',
    color: '#06b6d4',
    description: 'Standing water on roads, drains overflowing',
  },
  SEVERE_RAIN: {
    label: 'Severe Rain',
    labelHi: 'भारी बारिश',
    icon: '🌧️',
    color: '#6366f1',
    description: 'Very heavy or continuous rainfall',
  },
  STRONG_WIND: {
    label: 'Strong Wind',
    labelHi: 'तेज़ हवा',
    icon: '💨',
    color: '#8b5cf6',
    description: 'Damaging winds, fallen trees or debris',
  },
  HAIL: {
    label: 'Hail',
    labelHi: 'ओलावृष्टि',
    icon: '🧊',
    color: '#a78bfa',
    description: 'Hailstones causing damage',
  },
  CLOUDBURST: {
    label: 'Cloudburst',
    labelHi: 'बादल फटना',
    icon: '⛈️',
    color: '#ec4899',
    description: 'Sudden extreme rainfall in a short period',
  },
  OTHER: {
    label: 'Other Hazard',
    labelHi: 'अन्य',
    icon: '⚠️',
    color: '#f59e0b',
    description: 'Other weather-related hazard',
  },
};

export const SEVERITY_LABELS: Record<SeverityLevel, {
  label: string;
  labelHi: string;
  description: string;
  color: string;
}> = {
  1: {
    label: 'Minor',
    labelHi: 'मामूली',
    description: 'Slight inconvenience, no damage',
    color: 'var(--color-severity-info)',
  },
  2: {
    label: 'Moderate',
    labelHi: 'मध्यम',
    description: 'Some disruption, minor damage possible',
    color: 'var(--color-severity-low)',
  },
  3: {
    label: 'Significant',
    labelHi: 'महत्वपूर्ण',
    description: 'Roads affected, ankle to knee-deep water',
    color: 'var(--color-severity-moderate)',
  },
  4: {
    label: 'Severe',
    labelHi: 'गंभीर',
    description: 'Waist-deep water, vehicles stranded, power disrupted',
    color: 'var(--color-severity-high)',
  },
  5: {
    label: 'Critical',
    labelHi: 'अति गंभीर',
    description: 'Life-threatening, buildings inundated, rescue needed',
    color: 'var(--color-severity-critical)',
  },
};

// —— Predictive Hydrological & Disaster Intelligence Types ——

export type InundationDangerLevel = 'MINIMAL' | 'CAUTION' | 'DANGEROUS' | 'LIFE_THREATENING';

export interface PredictiveTrajectoryPoint {
  timeHorizon: '+1h' | '+3h' | '+6h' | '+12h' | '+24h';
  timestamp: string;
  forecastRainMmH: number;
  forecastWaterDepthFeet: number;
  depthDeltaFeet: number;
  inundationDangerLevel: InundationDangerLevel;
  drainageRateFpm: number; // feet per minute
  roadPassability: 'CLEAR' | 'CAUTION_LIGHT' | 'IMPASSABLE_LIGHT_VEHICLES' | 'COMPLETELY_SUBMERGED';
  actionDirective: string;
}

export interface CascadingRiskProbabilities {
  electrocutionRiskPct: number;
  vehicleFloatRiskPct: number;
  structuralSlopeFailurePct: number;
  waterborneContaminationPct: number;
}

export interface HydrologicalModelMetrics {
  runoffCoefficient: number;
  soilSaturationIndex: number; // 0.0 to 1.0 (AMC-I to AMC-III)
  imperviousSurfaceRatio: number;
  topographicalDepressionType: 'RAILWAY_UNDERPASS_BOWL' | 'URBAN_RIVER_CHANNEL' | 'COASTAL_ESTUARY' | 'HILLSLOPE_VALLEY';
  timeToPeakHours: number;
  projectedPeakDepthFeet: number;
  projectedPeakTime: string;
  recessionHoursEst: number;
}

export interface ActionSolutionPlaybook {
  phaseA_Citizen: {
    title: string;
    immediateEvacuationAdvisory: string;
    safeHighGroundElevation: string;
    dosAndDonts: string[];
    powerCutoffMandate: string;
    safeAssemblyPoints: string[];
  };
  phaseB_MunicipalDewatering: {
    title: string;
    pumpCapacityHpRequired: number;
    pumpUnitsRecommended: number;
    dischargeCapacityLpm: number;
    sumpDeploymentPoints: string[];
    stormDrainClearingAction: string;
    sandbagBarrierLine: string;
  };
  phaseC_TrafficPolice: {
    title: string;
    exactBlockadeLocations: string[];
    arterialDiversionRoutes: string[];
    checkpointsEstablished: string[];
    publicTransitAdvisory: string;
  };
  phaseD_SearchAndRescue: {
    title: string;
    sdrfBoatStagingLocations: string[];
    priorityEvacuationSectors: string[];
    emergencyMedicalReliefStation: string;
    helipadCoordinates?: string;
  };
  phaseE_RestorationAndAllClear: {
    title: string;
    waterTestingProtocol: string;
    siltClearanceEtaHours: number;
    electricalGridSafetyAuditSteps: string[];
  };
}

export interface DisasterPredictionResult {
  id: string;
  landmark: string;
  cityName: string;
  stateName: string;
  coordinates: GeoPoint;
  currentConditions: {
    rainRateMmH: number;
    waterDepthFeet: number;
    radarReflectivityDbz: number;
    windGustKmh: number;
    category: HazardCategory;
    reportedAt: string;
  };
  hydrology: HydrologicalModelMetrics;
  cascadingRisks: CascadingRiskProbabilities;
  trajectory: PredictiveTrajectoryPoint[];
  solutions: ActionSolutionPlaybook;
  generatedAt: string;
  modelConfidencePct: number;
  liveWeatherTelemetry?: {
    source: string;
    temperatureC: number;
    relativeHumidity: number;
    surfacePressureHpa: number;
    windSpeedKmh: number;
    rainRateMmH: number;
    forecast24hTotalMm: number;
    syncedAt: string;
  };
}

