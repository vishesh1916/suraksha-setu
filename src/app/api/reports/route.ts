// GET /api/reports — List reports
// POST /api/reports — Submit a new citizen report

import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import type { HazardCategory, SeverityLevel, ReportStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ReportStatus | null;
    const category = searchParams.get('category') as HazardCategory | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const filters: { status?: ReportStatus; category?: HazardCategory } = {};
    if (status) filters.status = status;
    if (category) filters.category = category;

    const reports = dataStore.getReports(filters).slice(0, limit);

    return NextResponse.json({
      success: true,
      data: reports,
      total: reports.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { category, severity, description, location, consent } = body;

    if (!category || !severity || !description || !location || !consent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: category, severity, description, location, consent',
        },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories: HazardCategory[] = [
      'FLOODING', 'WATERLOGGING', 'SEVERE_RAIN', 'STRONG_WIND', 'HAIL', 'CLOUDBURST', 'OTHER',
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid hazard category' },
        { status: 400 }
      );
    }

    // Validate severity
    if (severity < 1 || severity > 5) {
      return NextResponse.json(
        { success: false, error: 'Severity must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Generate H3 index (simplified — in production use h3-js)
    const h3Index = `882a${Math.random().toString(16).slice(2, 10)}fffff`;

    // Generate pseudonym
    const pseudonym = `Citizen-${String(dataStore.getReports().length + 1).padStart(3, '0')}`;

    const report = dataStore.createReport({
      reporterId: body.reporterId || `anon_${Date.now()}`,
      reporterPseudonym: pseudonym,
      category,
      severity: severity as SeverityLevel,
      description,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      },
      h3Index,
      mediaUrl: body.mediaUrl,
      landmark: body.landmark,
      waterDepthFeet: body.waterDepthFeet ? Number(body.waterDepthFeet) : undefined,
      consent: true,
      status: 'RECEIVED',
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: report.id,
          pseudonym: report.reporterPseudonym,
          status: report.status,
          createdAt: report.createdAt,
        },
        message: 'Report received successfully. Thank you for helping keep your community safe.',
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportId, action, notes, actorName } = body;

    if (!reportId || !action) {
      return NextResponse.json(
        { success: false, error: 'reportId and action are required' },
        { status: 400 }
      );
    }

    const updated = dataStore.takeReportAction(
      reportId,
      action,
      notes || '',
      actorName || 'Duty Admin / Meteorologist'
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Action "${action}" recorded and synchronized to citizen tracking.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update report action' },
      { status: 500 }
    );
  }
}

