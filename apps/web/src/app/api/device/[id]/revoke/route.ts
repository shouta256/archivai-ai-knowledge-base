import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, DeviceRow } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/device/:id/revoke - Revoke a device
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    // Revoke device
    const { error } = await supabase
      .from('devices')
      .update({
        revoked_at: new Date().toISOString(),
        device_key_hash: null, // Clear token hash
      } as Partial<DeviceRow>)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error revoking device:', error);
      return errorResponse('database_error', 'Failed to revoke device', 500);
    }

    return successResponse({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/device/:id/revoke:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
