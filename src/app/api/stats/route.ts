// GET /api/stats — Platform statistics
import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const stats = dataStore.getStats();
    return NextResponse.json(
      { success: true, data: stats },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
