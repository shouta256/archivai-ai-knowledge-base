import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, NoteRow, NoteWithCategory } from '@/lib/supabase';
import { errorResponse, successResponse, parseJson, generateContentHash } from '@/lib/api-utils';
import { enqueueJob } from '@/lib/jobs';
import { updateNoteSchema } from '@/lib/schemas';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/notes/:id - Get a single note
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('notes')
      .select(`
        *,
        categories!notes_category_id_fkey (
          id,
          name
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single<NoteWithCategory>();

    if (error || !data) {
      return errorResponse('not_found', 'Note not found', 404);
    }

    return successResponse({
      note: {
        ...data,
        category_name: data.categories?.name || null,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/notes/:id:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}

// PATCH /api/notes/:id - Update a note
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const { id } = await context.params;
    const body = await parseJson(req);
    if (!body) {
      return errorResponse('invalid_json', 'Invalid JSON body', 400);
    }

    const parsed = updateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('validation_error', 'Invalid request body', 400, {
        errors: parsed.error.flatten(),
      });
    }

    const supabase = getSupabaseAdmin();

    // Get existing note to check for content changes
    const { data: existingData } = await supabase
      .from('notes')
      .select('title, content_text, ink_caption')
      .eq('id', id)
      .eq('user_id', userId)
      .single<Pick<NoteRow, 'title' | 'content_text' | 'ink_caption'>>();

    if (!existingData) {
      return errorResponse('not_found', 'Note not found', 404);
    }

    // Build update object
    const updates: Partial<NoteRow> = {};
    const updateData = parsed.data;

    if (updateData.title !== undefined) updates.title = updateData.title;
    if (updateData.content_text !== undefined) updates.content_text = updateData.content_text;
    if (updateData.ink_json !== undefined) updates.ink_json = updateData.ink_json;
    if (updateData.category_id !== undefined) updates.category_id = updateData.category_id;
    if (updateData.tags !== undefined) updates.tags = updateData.tags;

    // Update note
    const { data: note, error } = await supabase
      .from('notes')
      .update(updates as NoteRow)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single<NoteRow>();

    if (error || !note) {
      console.error('Error updating note:', error);
      return errorResponse('database_error', 'Failed to update note', 500);
    }

    // Check if content changed (needs re-embedding)
    const oldHash = generateContentHash(
      [existingData.title, existingData.content_text, existingData.ink_caption].filter(Boolean).join('\n\n')
    );
    const newHash = generateContentHash(
      [note.title, note.content_text, note.ink_caption].filter(Boolean).join('\n\n')
    );

    const jobsEnqueued: string[] = [];
    if (oldHash !== newHash) {
      await enqueueJob(userId, 'embed_note', { note_id: note.id });
      jobsEnqueued.push('embed_note');
      
      // Re-classify if content changed
      await enqueueJob(userId, 'classify_note', { note_id: note.id });
      jobsEnqueued.push('classify_note');
    }

    return successResponse({
      note,
      jobs_enqueued: jobsEnqueued,
    });
  } catch (error) {
    console.error('Error in PATCH /api/notes/:id:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}

// DELETE /api/notes/:id - Delete a note
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    // Delete note (embeddings will cascade)
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting note:', error);
      return errorResponse('database_error', 'Failed to delete note', 500);
    }

    return successResponse({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/notes/:id:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
