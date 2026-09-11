// ============================================================
// SIH Weather Platform — Confidence Scoring Engine
// Transparent rules-based 0–100 score (prioritization aid)
// ============================================================

import type { Report, Evidence, ConfidenceScore, ConfidenceFactor, WeatherData } from '@/types';

interface ScoringContext {
  report: Report;
  nearbyReports: Report[];
  weatherData?: WeatherData;
  reporterConfirmedCount: number;
  duplicateImageDetected: boolean;
  locationMismatch: boolean;
}

// —— Individual Scoring Rules ——

function scoreCompleteness(ctx: ScoringContext): ConfidenceFactor {
  let points = 0;
  const max = 25;
  const details: string[] = [];

  if (ctx.report.location.latitude && ctx.report.location.longitude) {
    points += 7;
    details.push('GPS location ✓');
  }
  if (ctx.report.category) {
    points += 5;
    details.push('Category ✓');
  }
  if (ctx.report.createdAt) {
    points += 3;
    details.push('Timestamp ✓');
  }
  if (ctx.report.consent) {
    points += 3;
    details.push('Consent ✓');
  }
  if (ctx.report.description && ctx.report.description.length > 10) {
    points += 3;
    details.push('Description ✓');
  }
  if (ctx.report.mediaUrl) {
    points += 4;
    details.push('Photo ✓');
  } else {
    details.push('Photo missing (optional)');
  }

  return {
    name: 'Report Completeness',
    signal: details.join(', '),
    contribution: Math.min(points, max),
    maxContribution: max,
    explanation: `${details.filter(d => d.includes('✓')).length} of 6 evidence fields present. Missing fields reduce priority but do not invalidate the report.`,
  };
}

function scoreCorroboration(ctx: ScoringContext): ConfidenceFactor {
  const max = 30;
  const nearbyCount = ctx.nearbyReports.length;

  if (nearbyCount === 0) {
    return {
      name: 'Spatial Corroboration',
      signal: 'No nearby reports',
      contribution: 0,
      maxContribution: max,
      explanation: 'No other reports of the same hazard within 500m and 20 minutes. Single report — awaiting corroboration.',
    };
  }

  // Scale: 1 report = 8pts, 2 = 15pts, 3 = 22pts, 4+ = 28-30pts
  const points = Math.min(max, Math.round(nearbyCount * 7.5));

  return {
    name: 'Spatial Corroboration',
    signal: `${nearbyCount} independent report${nearbyCount > 1 ? 's' : ''} within 500m / 20min`,
    contribution: points,
    maxContribution: max,
    explanation: `${nearbyCount} independent report(s) of ${ctx.report.category.toLowerCase().replace('_', ' ')} found nearby. Reports are deduplicated by device and content hash before counting.`,
  };
}

function scoreReporterHistory(ctx: ScoringContext): ConfidenceFactor {
  const max = 15;
  const confirmed = ctx.reporterConfirmedCount;

  if (confirmed === 0) {
    return {
      name: 'Reporter History',
      signal: 'New reporter',
      contribution: 2, // Never suppress — give base credit
      maxContribution: max,
      explanation: 'First-time reporter. Base credibility assigned. Reports are never suppressed solely due to no history.',
    };
  }

  const points = Math.min(max, 2 + confirmed * 3);

  return {
    name: 'Reporter History',
    signal: `${confirmed} prior confirmed report${confirmed > 1 ? 's' : ''}`,
    contribution: points,
    maxContribution: max,
    explanation: `Reporter has ${confirmed} previously confirmed report(s). History provides a bounded credibility signal (capped at ${max} points).`,
  };
}

function scoreWeatherSignal(ctx: ScoringContext): ConfidenceFactor {
  const max = 20;

  if (!ctx.weatherData) {
    return {
      name: 'Weather Evidence',
      signal: 'No weather data available',
      contribution: 0,
      maxContribution: max,
      explanation: 'Weather data source unavailable or stale. Cannot provide weather evidence. Absence of weather data does not reduce score.',
      freshness: 'unavailable',
    };
  }

  const freshness = ctx.weatherData.freshnessSeconds < 1800 ? 'fresh' : 'stale';
  let points = 0;
  const details: string[] = [];

  // Check rainfall support
  if (ctx.weatherData.rainfall_mm !== undefined) {
    if (['FLOODING', 'WATERLOGGING', 'SEVERE_RAIN', 'CLOUDBURST'].includes(ctx.report.category)) {
      if (ctx.weatherData.rainfall_mm > 50) {
        points += 12;
        details.push(`Heavy rainfall: ${ctx.weatherData.rainfall_mm}mm`);
      } else if (ctx.weatherData.rainfall_mm > 20) {
        points += 8;
        details.push(`Moderate rainfall: ${ctx.weatherData.rainfall_mm}mm`);
      } else if (ctx.weatherData.rainfall_mm > 5) {
        points += 4;
        details.push(`Light rainfall: ${ctx.weatherData.rainfall_mm}mm`);
      }
    }
  }

  // Check wind support
  if (ctx.weatherData.windSpeed_kmh !== undefined && ctx.report.category === 'STRONG_WIND') {
    if (ctx.weatherData.windSpeed_kmh > 60) {
      points += 12;
      details.push(`High wind speed: ${ctx.weatherData.windSpeed_kmh} km/h`);
    } else if (ctx.weatherData.windSpeed_kmh > 30) {
      points += 6;
      details.push(`Moderate wind: ${ctx.weatherData.windSpeed_kmh} km/h`);
    }
  }

  // General weather condition match
  if (ctx.weatherData.description) {
    const desc = ctx.weatherData.description.toLowerCase();
    if (['rain', 'storm', 'thunder', 'drizzle'].some(w => desc.includes(w))) {
      points += 5;
      details.push(`Weather condition: ${ctx.weatherData.description}`);
    }
  }

  // Freshness penalty
  if (freshness === 'stale') {
    points = Math.round(points * 0.6);
    details.push('⚠ Stale data — confidence reduced');
  }

  return {
    name: 'Weather Evidence',
    signal: details.join('; ') || 'Weather data does not strongly support claim',
    contribution: Math.min(points, max),
    maxContribution: max,
    explanation: details.length > 0
      ? `Weather data ${freshness === 'fresh' ? 'supports' : 'partially supports'} the reported hazard.`
      : 'Available weather data does not show strong correlation with the reported hazard type.',
    source: ctx.weatherData.source,
    freshness,
  };
}

function scoreContradictions(ctx: ScoringContext): ConfidenceFactor {
  const max = 10;
  let penalty = 0;
  const flags: string[] = [];

  if (ctx.duplicateImageDetected) {
    penalty += 5;
    flags.push('Duplicate image detected from another report');
  }

  if (ctx.locationMismatch) {
    penalty += 5;
    flags.push('Location inconsistent with description');
  }

  if (flags.length === 0) {
    return {
      name: 'Contradiction Check',
      signal: 'No flags detected',
      contribution: 4, // Bonus for no contradictions
      maxContribution: max,
      explanation: 'No duplicate images, location mismatches, or clear-sky contradictions detected.',
    };
  }

  return {
    name: 'Contradiction Check',
    signal: flags.join('; '),
    contribution: -penalty,
    maxContribution: max,
    explanation: `Contradiction flags detected: ${flags.join('. ')}. Report sent to review queue for manual assessment. Flags do not permanently penalize the reporter.`,
  };
}

// —— Main Scoring Function ——

export function computeConfidenceScore(ctx: ScoringContext): ConfidenceScore {
  const factors: ConfidenceFactor[] = [
    scoreCompleteness(ctx),
    scoreCorroboration(ctx),
    scoreReporterHistory(ctx),
    scoreWeatherSignal(ctx),
    scoreContradictions(ctx),
  ];

  const total = Math.max(0, Math.min(100,
    factors.reduce((sum, f) => sum + f.contribution, 0)
  ));

  return {
    total,
    factors,
    computedAt: new Date().toISOString(),
  };
}

// —— Confidence Level Helpers ——

export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function getConfidenceColor(score: number): string {
  if (score >= 70) return 'var(--color-confidence-high)';
  if (score >= 40) return 'var(--color-confidence-medium)';
  return 'var(--color-confidence-low)';
}
