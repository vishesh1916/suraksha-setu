// GET /api/incidents — List incident candidates
import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import type { IncidentState, HazardCategory } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state') as IncidentState | null;
    const category = searchParams.get('category') as HazardCategory | null;

    const filters: { state?: IncidentState; category?: HazardCategory } = {};
    if (state) filters.state = state;
    if (category) filters.category = category;

    const incidents = dataStore.getIncidents(filters);

    return NextResponse.json(
      {
        success: true,
        data: incidents,
        total: incidents.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}
