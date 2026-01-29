import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, DeviceRow } from './supabase';
import { createHash } from 'crypto';

// API Error Response
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function errorResponse(code: string, message: string, status: number = 400, details?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

// Auth middleware for Clerk
export async function withAuth(
  handler: (req: NextRequest, userId: string) => Promise<NextResponse>
): Promise<(req: NextRequest) => Promise<NextResponse>> {
  return async (req: NextRequest) => {
    try {
      const { userId } = await auth();

      if (!userId) {
        return errorResponse('unauthorized', 'Authentication required', 401);
      }

      return handler(req, userId);
    } catch (error) {
      console.error('Auth error:', error);
      return errorResponse('auth_error', 'Authentication failed', 401);
    }
  };
}

// Get user ID from Clerk session
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

// Require user ID (throws if not authenticated)
export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('Authentication required');
  }
  return userId;
}

// Device token authentication
export async function authenticateDevice(req: NextRequest): Promise<{ deviceId: string; userId: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const supabase = getSupabaseAdmin();
  const { data: device, error } = await supabase
    .from('devices')
    .select('id, user_id')
    .eq('device_key_hash', tokenHash)
    .is('revoked_at', null)
    .single<Pick<DeviceRow, 'id' | 'user_id'>>();

  if (error || !device || !device.user_id) {
    return null;
  }

  // Update last seen
  await supabase
    .from('devices')
    .update({ last_seen_at: new Date().toISOString() } as Partial<DeviceRow>)
    .eq('id', device.id);

  return { deviceId: device.id, userId: device.user_id };
}

// Cron authentication
export function verifyCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  const providedSecret = req.headers.get('x-cron-secret');
  return providedSecret === cronSecret;
}

// Parse JSON body with validation
export async function parseJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// Generate content hash for deduplication
export function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

// Encode/decode pagination cursor
export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ created_at: createdAt, id })).toString('base64url');
}

export function decodeCursor(cursor: string): { created_at: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (typeof parsed.created_at === 'string' && typeof parsed.id === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
