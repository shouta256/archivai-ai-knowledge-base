import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, DeviceRow } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api-utils';

// GET /api/device - List user's devices
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const supabase = getSupabaseAdmin();

    const { data: devices, error } = await supabase
      .from('devices')
      .select('id, device_name, last_seen_at, created_at, revoked_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .returns<Pick<DeviceRow, 'id' | 'device_name' | 'last_seen_at' | 'created_at' | 'revoked_at'>[]>();

    if (error) {
      console.error('Error fetching devices:', error);
      return errorResponse('database_error', 'Failed to fetch devices', 500);
    }

    return successResponse({ devices: devices || [] });
  } catch (error) {
    console.error('Error in GET /api/device:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
