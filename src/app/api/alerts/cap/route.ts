// ============================================================
// Suraksha Setu — Official CAP 1.2 XML / JSON Export Endpoint
// NDMA / Sachet Disaster Interoperability
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { generateCapXml, generateCapJson } from '@/lib/capExport';
import type { Alert } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('id');
    const format = searchParams.get('format') || 'xml'; // 'xml' or 'json'

    const alerts: Alert[] = dataStore.getAllAlerts();
    const alert = alertId ? alerts.find((a: Alert) => a.id === alertId) : alerts[0];

    if (!alert) {
      return new NextResponse('Alert not found', { status: 404 });
    }

    if (format === 'json') {
      const jsonPayload = generateCapJson(alert, 'NDMA Verified Authority Desk');
      return NextResponse.json(jsonPayload, {
        headers: {
          'Content-Disposition': `attachment; filename="CAP-${alert.id}.json"`,
        },
      });
    }

    const xmlPayload = generateCapXml(alert, 'NDMA Verified Authority Desk');
    return new NextResponse(xmlPayload, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="CAP-${alert.id}.xml"`,
      },
    });
  } catch {
    return new NextResponse('Failed to generate CAP payload', { status: 500 });
  }
}
