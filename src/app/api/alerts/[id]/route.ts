// GET /api/alerts/[id] — Get alert detail
// PUT /api/alerts/[id] — Update alert (publish, cancel, extend)

import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const alert = dataStore.getAlert(id);

  if (!alert) {
    return NextResponse.json(
      { success: false, error: 'Alert not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: alert });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, reason, actorId } = body;

    if (action === 'publish') {
      const alert = dataStore.publishAlert(id, actorId || 'officer');
      if (!alert) {
        return NextResponse.json(
          { success: false, error: 'Alert not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: alert });
    }

    if (action === 'cancel') {
      if (!reason) {
        return NextResponse.json(
          { success: false, error: 'Reason required to cancel an alert' },
          { status: 400 }
        );
      }
      const alert = dataStore.cancelAlert(id, reason, actorId || 'officer');
      if (!alert) {
        return NextResponse.json(
          { success: false, error: 'Alert not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: alert });
    }

    if (action === 'extend') {
      const hours = Number(body.hours) || 3;
      const alert = dataStore.extendAlert(id, hours, actorId || 'officer');
      if (!alert) {
        return NextResponse.json(
          { success: false, error: 'Alert not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: alert });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: publish, cancel, extend' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}
