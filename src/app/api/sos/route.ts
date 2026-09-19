import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import type { SosRequest } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const list = dataStore.getSosRequests(status ? { status } : undefined);

    return NextResponse.json(
      {
        success: true,
        count: list.length,
        data: list,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SOS distress requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      reporterName,
      phone,
      location,
      landmark,
      hazardType,
      peopleCount,
      hasMedicalEmergency,
      notes,
    } = body;

    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Valid GPS coordinates (latitude, longitude) are required for SOS emergency beacon' },
        { status: 400 }
      );
    }

    const sos = dataStore.createSosRequest({
      reporterName: reporterName || 'Citizen Distress Beacon',
      phone: phone || '',
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      landmark: landmark || `Emergency Location (${location.latitude.toFixed(4)}°N, ${location.longitude.toFixed(4)}°E)`,
      hazardType: hazardType || 'FLOODING',
      peopleCount: Number(peopleCount) || 1,
      hasMedicalEmergency: Boolean(hasMedicalEmergency),
      notes: notes || '',
    });

    return NextResponse.json(
      {
        success: true,
        message: '🚨 Emergency SOS distress beacon broadcasted to NDRF, SDRF, and local municipal rescue dispatch.',
        data: sos,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/sos:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to broadcast SOS emergency beacon' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, dispatchedUnit, actorName } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: 'id and status are required' },
        { status: 400 }
      );
    }

    const updated = dataStore.updateSosStatus(
      id,
      status as SosRequest['status'],
      dispatchedUnit,
      actorName || 'Rescue Coordinator'
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'SOS distress beacon not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `SOS beacon status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update SOS status' },
      { status: 500 }
    );
  }
}
