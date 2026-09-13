// ============================================================
// GET /api/hazards/sources — Agency Provider Telemetry & Health
// ============================================================

import { NextResponse } from 'next/server';
import { getUnifiedHazardData } from '@/lib/hazardAdapters/registry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const result = await getUnifiedHazardData({ includeCommunity: false });

    return NextResponse.json(
      {
        success: true,
        timestamp: result.timestamp,
        totalSources: result.sourcesHealth.length,
        sources: result.sourcesHealth,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve source provider health' },
      { status: 500 }
    );
  }
}
