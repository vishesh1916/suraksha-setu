// ============================================================
// Suraksha Setu — Admin Logout API
// ============================================================

import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'suraksha_admin_token';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully.',
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });

  return response;
}
