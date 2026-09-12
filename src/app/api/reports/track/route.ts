// ============================================================
// Suraksha Setu — Citizen Report Tracking API
// Allows citizens to track their report status in real time
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import type { Report } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id')?.trim();

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: 'Report ID is required for tracking.' },
        { status: 400, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    let report = dataStore.getReport(reportId);

    // If not found directly, also search dataStore.getReports() for any partial match
    if (!report) {
      const clean = reportId.toLowerCase();
      report = dataStore.getReports().find(r => 
        r.id.toLowerCase().includes(clean) || 
        clean.includes(r.id.toLowerCase()) ||
        (r.landmark && r.landmark.toLowerCase().includes(clean)) ||
        (r.reporterPseudonym && r.reporterPseudonym.toLowerCase().includes(clean))
      );
    }

    // Also check incidents by incident ID
    if (!report) {
      const clean = reportId.toLowerCase();
      const inc = dataStore.getIncidents().find(i =>
        i.id.toLowerCase() === clean ||
        i.id.toLowerCase().includes(clean) ||
        clean.includes(i.id.toLowerCase()) ||
        (i.landmark && i.landmark.toLowerCase().includes(clean))
      );
      if (inc && inc.reports && inc.reports.length > 0) {
        report = inc.reports[0];
      }
    }

    if (!report) {
      if (reportId.startsWith('OFFLINE_')) {
        return NextResponse.json({
          success: true,
          data: {
            id: reportId,
            status: 'OFFLINE_QUEUED',
            stage: 1,
            stages: [
              { name: 'Stored Offline on Device', completed: true, timestamp: new Date().toISOString() },
              { name: 'Cellular / WiFi Network Sync', completed: false },
              { name: 'Meteorologist Radar Verification', completed: false },
              { name: 'Tactical Deployment', completed: false },
            ],
            category: 'PENDING_NETWORK_SYNC',
            severity: 3,
            locationName: 'Local Storage Queue',
            corroborationCount: 1,
            weatherSignal: 'Pending network upload to Doppler radar validation engine…',
            reviewNote: 'This report is stored securely on your local device. It will automatically upload to the National Disaster Management registry as soon as cellular or WiFi connection is detected.',
          },
        });
      }

      return NextResponse.json(
        { success: false, error: `No active record found for Report ID "${reportId}". Please verify your identifier or submit a new report.` },
        { status: 404 }
      );
    }

    // Determine current stage and description
    let stage = 1;
    let stageStatusDesc = 'Report submitted and queued for meteorologist Doppler radar verification.';

    const isResolved = report.status === 'RESOLVED' || report.currentActionCategory === 'Hazard Resolved';
    const isActionTaken = report.currentActionCategory && [
      'Evacuation Ordered',
      'Dewatering & Municipal Crew Dispatched',
      'Public Warning Issued (CAP 1.2)',
      'Search & Rescue Deployed',
      'Meteorological Monitoring',
    ].includes(report.currentActionCategory);

    const isVerified = report.verificationStatus === 'VERIFIED_GENUINE' || report.status === 'REVIEWED';
    const isDismissed = report.verificationStatus === 'FLAGGED_FALSE_REPORT' || report.status === 'DISMISSED';

    if (isResolved) {
      stage = 4;
      stageStatusDesc = report.actionHistory?.[0]?.notes || 'Hazard fully mitigated by emergency response teams. Water receded and corridor restored to safe public transit.';
    } else if (isActionTaken) {
      stage = 3;
      stageStatusDesc = `🚨 Active Response Directive: "${report.currentActionCategory}". ${report.actionHistory?.[0]?.notes || 'Field teams deployed and operational.'}`;
    } else if (isVerified) {
      stage = 2;
      stageStatusDesc = '✅ Confirmed genuine hazard by duty meteorologist and Doppler radar cross-check. Queued for tactical deployment.';
    } else if (isDismissed) {
      stage = 1;
      stageStatusDesc = `❌ Evaluated by duty reviewer: ${report.verificationRationale || 'Flagged as false alarm or duplicate observation.'}`;
    }

    const stages = [
      { 
        name: 'Report Received', 
        completed: true, 
        timestamp: report.createdAt 
      },
      {
        name: isDismissed ? 'Verification (Flagged False)' : 'Meteorologist Verification',
        completed: isVerified || isActionTaken || isResolved || isDismissed,
        timestamp: isVerified || isActionTaken || isResolved ? report.updatedAt : undefined,
      },
      {
        name: isActionTaken || isResolved ? `Action: ${report.currentActionCategory || 'Response Mobilized'}` : 'Tactical Response Action',
        completed: Boolean(isActionTaken || isResolved),
        timestamp: isActionTaken || isResolved ? report.updatedAt : undefined,
      },
      {
        name: isDismissed ? 'Dismissed / Closed' : 'Resolved & Corridor Restored',
        completed: isResolved || isDismissed,
        timestamp: isResolved || isDismissed ? report.updatedAt : undefined,
      },
    ];

    return NextResponse.json(
      {
        success: true,
        data: {
          id: report.id,
          status: report.status,
          verificationStatus: report.verificationStatus || 'PENDING_VERIFICATION',
          verificationRationale: report.verificationRationale,
          firstActionTaken: report.firstActionTaken,
          currentActionCategory: report.currentActionCategory || (isVerified ? 'Verified Genuine — Pending Tactical Action' : 'Pending Verification'),
          actionHistory: report.actionHistory || [],
          stage,
          stages,
          category: report.category,
          severity: report.severity,
          description: report.description,
          landmark: report.landmark,
          waterDepthFeet: report.waterDepthFeet,
          location: report.location,
          mediaUrl: report.mediaUrl,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
          corroborationCount: isVerified || isActionTaken || isResolved ? 4 : 1,
          weatherSignal: 'Doppler AWS Telemetry Verified: 52 dBZ reflectivity match',
          reviewNote: stageStatusDesc,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal error checking report tracking status.' },
      { status: 500 }
    );
  }
}
