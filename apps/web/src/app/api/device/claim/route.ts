import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, DeviceRow } from '@/lib/supabase';
import { errorResponse, successResponse, parseJson } from '@/lib/api-utils';
import { deviceClaimSchema } from '@/lib/schemas';
import { createHash, randomBytes } from 'crypto';

// POST /api/device/claim - User claims a device with pair code
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const body = await parseJson(req);
    if (!body) {
      return errorResponse('invalid_json', 'Invalid JSON body', 400);
    }

    const parsed = deviceClaimSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('validation_error', 'Invalid request body', 400, {
        errors: parsed.error.flatten(),
      });
    }

    const { pair_code } = parsed.data;
    const supabase = getSupabaseAdmin();

    // Find device with valid pair code
    const { data: device, error: findError } = await supabase
      .from('devices')
      .select('id, user_id, pair_expires_at')
      .eq('pair_code', pair_code)
      .is('user_id', null) // Not yet claimed
      .is('revoked_at', null)
      .single<Pick<DeviceRow, 'id' | 'user_id' | 'pair_expires_at'>>();

    if (findError || !device) {
      return errorResponse('invalid_pair_code', 'Invalid or expired pair code', 400);
    }

    // Check expiry
    if (device.pair_expires_at && new Date(device.pair_expires_at) < new Date()) {
      return errorResponse('expired_pair_code', 'Pair code has expired', 400);
    }

    // Generate device token
    const deviceToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(deviceToken).digest('hex');

    // Update device with user_id and token hash
    const { error: updateError } = await supabase
      .from('devices')
      .update({
        user_id: userId,
        device_key_hash: tokenHash,
        pair_code: null, // Clear pair code
        pair_expires_at: null,
      } as Partial<DeviceRow>)
      .eq('id', device.id);

    if (updateError) {
      console.error('Error claiming device:', updateError);
      return errorResponse('database_error', 'Failed to claim device', 500);
    }

    return successResponse({
      device_id: device.id,
      device_token: deviceToken,
      note: 'device_token is shown only once. Store it securely on the device.',
    });
  } catch (error) {
    console.error('Error in POST /api/device/claim:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
