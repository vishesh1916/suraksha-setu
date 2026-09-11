// GET /api/admin/users — List users
import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: dataStore.getUsers(),
  });
}
