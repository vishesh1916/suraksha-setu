// GET /api/admin/audit — Audit log
import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entityType') || undefined;
  const entityId = searchParams.get('entityId') || undefined;
  const actorId = searchParams.get('actorId') || undefined;

  return NextResponse.json({
    success: true,
    data: dataStore.getAuditEvents({ entityType, entityId, actorId }),
  });
}
