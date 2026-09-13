// ============================================================
// GET /api/hazards/unified — Standardized Multi-Hazard Event Stream
// Query parameters: country, hazardType, severity, timeRange, includeCommunity
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getUnifiedHazardData } from '@/lib/hazardAdapters/registry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || undefined;
    const hazardType = searchParams.get('hazardType') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const timeRange = (searchParams.get('timeRange') as '24h' | '7d' | '30d') || '7d';
    const includeCommunity = searchParams.get('includeCommunity') === 'true';

    const result = await getUnifiedHazardData({
      country,
      hazardType,
      severity,
      timeRange,
      includeCommunity,
    });

    return NextResponse.json(
      {
        success: true,
        timestamp: result.timestamp,
        total: result.events.length,
        sourcesHealth: result.sourcesHealth,
        data: result.events,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Unified hazard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve unified multi-hazard telemetry' },
      { status: 500 }
    );
  }
}
