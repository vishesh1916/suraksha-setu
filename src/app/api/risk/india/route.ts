// GET /api/risk/india — Live Real-Time India Weather Risk Sentinel Scan
import { NextResponse } from 'next/server';
import { scanIndiaWeatherRisks } from '@/lib/indiaRiskSentinel';

export async function GET() {
  try {
    const scan = await scanIndiaWeatherRisks();
    return NextResponse.json({
      success: true,
      data: scan,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to scan India weather risks' },
      { status: 500 }
    );
  }
}
