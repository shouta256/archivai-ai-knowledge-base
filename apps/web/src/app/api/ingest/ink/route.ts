import { NextRequest } from 'next/server';
import { getSupabaseAdmin, NoteRow } from '@/lib/supabase';
import { authenticateDevice, errorResponse, successResponse, parseJson } from '@/lib/api-utils';
import { enqueueJob } from '@/lib/jobs';
import { inkIngestSchema } from '@/lib/schemas';

// POST /api/ingest/ink - Device sends ink data
export async function POST(req: NextRequest) {
  try {
    // Authenticate device
    const deviceAuth = await authenticateDevice(req);
    if (!deviceAuth) {
      return errorResponse('unauthorized', 'Invalid or revoked device token', 401);
    }

    const { userId } = deviceAuth;

    const body = await parseJson(req);
    if (!body) {
      return errorResponse('invalid_json', 'Invalid JSON body', 400);
    }

    const parsed = inkIngestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('validation_error', 'Invalid request body', 400, {
        errors: parsed.error.flatten(),
      });
    }

    const { canvas_w, canvas_h, strokes, captured_at_ms, client_meta } = parsed.data;
    const supabase = getSupabaseAdmin();

    // Create ink note
    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        type: 'ink',
        ink_json: {
          canvas_w,
          canvas_h,
          strokes,
          captured_at_ms,
          client_meta,
        },
        tags: [],
      })
      .select('id')
      .single();

    if (error || !note) {
      console.error('Error creating ink note:', error);
      return errorResponse('database_error', 'Failed to create note', 500);
    }

    // Enqueue jobs
    const jobsEnqueued: string[] = [];
    await enqueueJob(userId, 'caption_ink', { note_id: note.id });
    jobsEnqueued.push('caption_ink');
    // embed_note will be enqueued after caption_ink completes

    return successResponse(
      {
        note_id: note.id,
        jobs_enqueued: jobsEnqueued,
      },
      201
    );
  } catch (error) {
    console.error('Error in POST /api/ingest/ink:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
