// ============================================================
// Suraksha Setu — Admin Authentication API (Strict Unique Password)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Suraksha@Setu2026!';
const SESSION_COOKIE_NAME = 'suraksha_admin_token';
const AUTH_SECRET = 'suraksha_auth_secure_token_v1';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    const isValidUser =
      username.trim().toLowerCase() === ADMIN_USERNAME.toLowerCase() ||
      username.trim().toLowerCase() === 'suraksha_admin';
    const isValidPass = password === ADMIN_PASSWORD;

    if (!isValidUser || !isValidPass) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials. Access denied.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful.',
      user: {
        username: ADMIN_USERNAME,
        role: 'ADMINISTRATOR',
        department: 'National Disaster Response & Meteorological Coordination',
      },
    });

    // Set secure auth cookie (valid for 8 hours)
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: AUTH_SECRET,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error during authentication.' },
      { status: 500 }
    );
  }
}
