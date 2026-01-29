import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, NoteRow, NoteWithCategory } from '@/lib/supabase';
import { errorResponse, successResponse, parseJson, encodeCursor, decodeCursor } from '@/lib/api-utils';
import { enqueueJob } from '@/lib/jobs';
import { createNoteSchema, paginationSchema } from '@/lib/schemas';

interface NoteListItem {
  id: string;
  type: string;
  title: string | null;
  content_text: string | null;
  ink_caption: string | null;
  category_id: string | null;
  tags: string[];
  created_at: string;
  categories: { id: string; name: string } | null;
}

// GET /api/notes - List notes with pagination
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const searchParams = req.nextUrl.searchParams;
    const params = paginationSchema.safeParse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || 20,
    });

    if (!params.success) {
      return errorResponse('validation_error', 'Invalid parameters', 400, {
        errors: params.error.flatten(),
      });
    }

    const { cursor, limit } = params.data;
    const supabase = getSupabaseAdmin();

    // Build query
    let query = supabase
      .from('notes')
      .select(`
        id,
        type,
        title,
        content_text,
        ink_caption,
        category_id,
        tags,
        created_at,
        categories!notes_category_id_fkey (
          id,
          name
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1); // Get one extra to check for next page

    // Apply cursor
    if (cursor) {
      const cursorData = decodeCursor(cursor);
      if (cursorData) {
        query = query.or(
          `created_at.lt.${cursorData.created_at},and(created_at.eq.${cursorData.created_at},id.lt.${cursorData.id})`
        );
      }
    }

    const { data, error } = await query;
    const notes = data as NoteListItem[] | null;

    if (error) {
      console.error('Error fetching notes:', error);
      return errorResponse('database_error', 'Failed to fetch notes', 500);
    }

    // Check if there are more results
    const hasMore = notes && notes.length > limit;
    const items = hasMore ? notes.slice(0, limit) : notes || [];

    // Create snippet from content
    const itemsWithSnippet = items.map((note) => {
      const text = note.content_text || note.ink_caption || '';
      const snippet = text.length > 200 ? text.slice(0, 197) + '...' : text;

      return {
        id: note.id,
        type: note.type,
        title: note.title,
        snippet: snippet || null,
        category_id: note.category_id,
        category_name: note.categories?.name || null,
        tags: note.tags,
        created_at: note.created_at,
      };
    });

    // Generate next cursor
    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = encodeCursor(lastItem.created_at, lastItem.id);
    }

    return successResponse({
      items: itemsWithSnippet,
      next_cursor: nextCursor,
    });
  } catch (error) {
    console.error('Error in GET /api/notes:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}

// POST /api/notes - Create a new note
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

    const parsed = createNoteSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('validation_error', 'Invalid request body', 400, {
        errors: parsed.error.flatten(),
      });
    }

    const { type, title, content_text, ink_json, tags } = parsed.data;
    const supabase = getSupabaseAdmin();

    // Create note
    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        type,
        title: title || null,
        content_text: content_text || null,
        ink_json: ink_json || null,
        tags,
      } as NoteRow)
      .select()
      .single<NoteRow>();

    const note = data;

    if (error || !note) {
      console.error('Error creating note:', error);
      return errorResponse('database_error', 'Failed to create note', 500);
    }

    // Enqueue jobs
    const jobsEnqueued: string[] = [];

    // Only classify/embed if there's text content
    const hasContent = title || content_text;
    if (hasContent) {
      await enqueueJob(userId, 'classify_note', { note_id: note.id });
      await enqueueJob(userId, 'embed_note', { note_id: note.id });
      jobsEnqueued.push('classify_note', 'embed_note');
    }

    // If ink, also enqueue caption job
    if (ink_json) {
      await enqueueJob(userId, 'caption_ink', { note_id: note.id });
      if (!jobsEnqueued.includes('embed_note')) {
        // embed_note will be enqueued after caption
        jobsEnqueued.push('caption_ink');
      } else {
        jobsEnqueued.push('caption_ink');
      }
    }

    return successResponse(
      {
        note: {
          id: note.id,
          type: note.type,
          title: note.title,
          content_text: note.content_text,
          ink_json: note.ink_json,
          category_id: note.category_id,
          tags: note.tags,
          created_at: note.created_at,
          updated_at: note.updated_at,
        },
        jobs_enqueued: jobsEnqueued,
      },
      201
    );
  } catch (error) {
    console.error('Error in POST /api/notes:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
