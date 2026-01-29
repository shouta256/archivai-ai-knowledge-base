import { NextRequest } from 'next/server';
import { verifyCronSecret, errorResponse, successResponse } from '@/lib/api-utils';
import { runJobProcessor } from '@/lib/jobs';

// POST /api/jobs/run - Run job processor (called by cron)
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(req)) {
      return errorResponse('unauthorized', 'Invalid cron secret', 401);
    }

    // Run job processor
    const result = await runJobProcessor(10);

    return successResponse({
      processed: result.processed,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Error in POST /api/jobs/run:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
