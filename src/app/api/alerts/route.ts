// GET /api/alerts — List active alerts (public)
// POST /api/alerts — Create alert draft (OFFICER only)

import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let alerts;
    if (status === 'active') {
      alerts = dataStore.getActiveAlerts();
    } else {
      alerts = dataStore.getAllAlerts();
    }

    return NextResponse.json(
      {
        success: true,
        data: alerts,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { incidentId, polygon, severity, headline, guidance, expiresAt } = body;

    if (!headline || !guidance || !severity || !expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: headline, guidance, severity, expiresAt' },
        { status: 400 }
      );
    }

    const alert = dataStore.createAlert({
      incidentId: incidentId || 'manual',
      polygon: polygon || {
        type: 'Polygon',
        coordinates: [[[72.82, 19.00], [72.86, 19.00], [72.86, 19.04], [72.82, 19.04], [72.82, 19.00]]],
      },
      severity,
      category: body.category || 'FLOODING',
      headline,
      guidance,
      startsAt: new Date().toISOString(),
      expiresAt,
      publishedBy: body.publishedBy,
      status: 'DRAFT',
      source: body.source || 'District Disaster Management Authority',
    });

    dataStore.logAudit(
      body.publishedBy || 'system',
      'OFFICER',
      'alert',
      alert.id,
      'CREATE_DRAFT',
      { headline, severity }
    );

    return NextResponse.json({ success: true, data: alert }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
