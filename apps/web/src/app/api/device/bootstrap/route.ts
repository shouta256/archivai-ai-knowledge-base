import { NextRequest } from 'next/server';
import { getSupabaseAdmin, DeviceRow } from '@/lib/supabase';
import { errorResponse, successResponse, parseJson } from '@/lib/api-utils';
import { deviceBootstrapSchema } from '@/lib/schemas';

// Generate 6-digit pair code
function generatePairCode(): string {
  const num = Math.floor(Math.random() * 1000000);
  return String(num).padStart(6, '0');
}

// POST /api/device/bootstrap - Device requests a pair code (anonymous)
export async function POST(req: NextRequest) {
  try {
    const body = await parseJson(req);
    const parsed = deviceBootstrapSchema.safeParse(body || {});

    if (!parsed.success) {
      return errorResponse('validation_error', 'Invalid request body', 400, {
        errors: parsed.error.flatten(),
      });
    }

    const { device_name } = parsed.data;
    const supabase = getSupabaseAdmin();

    // Generate unique pair code
    let pairCode: string;
    let attempts = 0;
    do {
      pairCode = generatePairCode();
      const { data: existing } = await supabase
        .from('devices')
        .select('id')
        .eq('pair_code', pairCode)
        .single<{ id: string }>();

      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return errorResponse('server_error', 'Failed to generate pair code', 500);
    }

    // Create device with pair code (10 minute expiry)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { data: device, error } = await supabase
      .from('devices')
      .insert({
        device_name,
        pair_code: pairCode,
        pair_expires_at: expiresAt.toISOString(),
      } as DeviceRow)
      .select('id')
      .single<{ id: string }>();

    if (error || !device) {
      console.error('Error creating device:', error);
      return errorResponse('database_error', 'Failed to create device', 500);
    }

    return successResponse({
      device_id: device.id,
      pair_code: pairCode,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error in POST /api/device/bootstrap:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
