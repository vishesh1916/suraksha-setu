import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    dataStore.clearAllIncidentsAndReports();
    return NextResponse.json({
      success: true,
      message: 'All demo and test data successfully purged. Clean database restored.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to reset database' },
      { status: 500 }
    );
  }
}
