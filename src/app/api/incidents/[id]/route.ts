// GET /api/incidents/[id] — Get incident detail with reports, evidence, review actions
// POST /api/incidents/[id] — Submit review action

import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import type { ReviewActionType, IncidentState } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const incident = dataStore.getIncident(id);

  if (!incident) {
    return NextResponse.json(
      { success: false, error: 'Incident not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: incident });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, reason, actorId, actorName } = body;

    // Validate action
    const validActions = ['VERIFY', 'DISMISS', 'FOLLOW_UP', 'ESCALATE', 'RESOLVE', 'MUNICIPAL_ORDER', 'BROADCAST_ALERT', 'RESTORE'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action.' },
        { status: 400 }
      );
    }

    if (action === 'RESOLVE') {
      const resolved = dataStore.resolveIncident(id, reason || 'Resolved by Administrator command', actorId || 'admin');
      return NextResponse.json({
        success: true,
        data: resolved,
        message: 'Incident marked as RESOLVED and contributing reports closed.',
      });
    }

    if (action === 'MUNICIPAL_ORDER') {
      const ordered = dataStore.executeMunicipalOrder(id, body.orderDetails || { pumpUnits: 3, pumpHp: 500, trafficBarricades: true }, actorId || 'admin');
      return NextResponse.json({
        success: true,
        data: ordered,
        message: 'Municipal dewatering crew and traffic police diversion dispatched.',
      });
    }

    if (action === 'BROADCAST_ALERT') {
      const alerted = dataStore.broadcastIncidentAlert(id, body.alertId || 'alert_pub', actorId || 'admin');
      return NextResponse.json({
        success: true,
        data: alerted,
        message: 'CAP 1.2 warning published and recorded on incident.',
      });
    }

    if (action === 'RESTORE') {
      const restored = dataStore.restoreIncident(id);
      if (restored) {
        return NextResponse.json({
          success: true,
          data: restored,
          message: 'Incident restored to Candidate status.',
        });
      }
    }

    // Dismiss and escalate require a reason
    if (['DISMISS', 'ESCALATE'].includes(action) && !reason) {
      return NextResponse.json(
        { success: false, error: 'Reason required for dismiss and escalate actions' },
        { status: 400 }
      );
    }

    const incident = dataStore.getIncident(id);
    if (!incident) {
      return NextResponse.json(
        { success: false, error: 'Incident not found' },
        { status: 404 }
      );
    }

    // Determine result state
    const stateMap: Record<string, IncidentState> = {
      VERIFY: 'VERIFIED',
      DISMISS: 'DISMISSED',
      FOLLOW_UP: 'FOLLOW_UP_REQUIRED',
      ESCALATE: 'ESCALATED',
    };

    const reviewActionType = action as ReviewActionType;
    const reviewAction = dataStore.addReviewAction(id, {
      incidentId: id,
      actorId: actorId || 'reviewer',
      actorName: actorName || 'Reviewer',
      action: reviewActionType,
      reason: reason || '',
      priorState: incident.state,
      resultState: stateMap[reviewActionType],
    });

    const updatedIncident = dataStore.getIncident(id) || incident;

    return NextResponse.json({
      success: true,
      data: updatedIncident,
      reviewAction,
      message: `Incident ${action.toLowerCase()}ed successfully`,
    });
  } catch (error) {
    console.error('ERROR IN POST /api/incidents/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process review action: ' + String(error) },
      { status: 500 }
    );
  }
}
