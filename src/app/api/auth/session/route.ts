// ============================================================
// Suraksha Setu — Check Session API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'suraksha_admin_token';
const AUTH_SECRET = 'suraksha_auth_secure_token_v1';

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (cookie && cookie.value === AUTH_SECRET) {
    return NextResponse.json({
      authenticated: true,
      user: {
        username: 'admin',
        role: 'ADMINISTRATOR',
        department: 'Disaster Operations & Meteorological Review',
      },
    });
  }

  return NextResponse.json({
    authenticated: false,
  });
}
