import { NextRequest } from 'next/server';
import { verifyCronSecret, errorResponse, successResponse } from '@/lib/api-utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/gemini';

// GET /api/debug - Debug endpoint to check database state
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    if (!verifyCronSecret(req)) {
      return errorResponse('unauthorized', 'Invalid cron secret', 401);
    }

    const supabase = getSupabaseAdmin();

    // Get all notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, user_id, title, content_text, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get all embeddings
    const { data: embeddings, error: embeddingsError } = await supabase
      .from('note_embeddings')
      .select('note_id, user_id, content_hash, model')
      .limit(20);

    return successResponse({
      notes: notes || [],
      notes_error: notesError?.message,
      embeddings: embeddings || [],
      embeddings_error: embeddingsError?.message,
    });
  } catch (error) {
    console.error('Error in GET /api/debug:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}

// POST /api/debug - Test vector search
export async function POST(req: NextRequest) {
  try {
    if (!verifyCronSecret(req)) {
      return errorResponse('unauthorized', 'Invalid cron secret', 401);
    }

    const body = await req.json();
    const query = body.query || 'apple';

    const supabase = getSupabaseAdmin();

    // Get a user_id from existing notes if not provided
    let userId = body.user_id;
    if (!userId) {
      const { data: firstNote } = await supabase
        .from('notes')
        .select('user_id')
        .limit(1)
        .single();
      userId = firstNote?.user_id;
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    
    // Test search
    const { data: matches, error: searchError } = await supabase.rpc('match_note_embeddings', {
      query_embedding: queryEmbedding,
      p_user_id: userId,
      match_threshold: 0.0,
      match_count: 5,
    });

    return successResponse({
      query,
      user_id: userId,
      embedding_length: queryEmbedding.length,
      embedding_sample: queryEmbedding.slice(0, 5),
      matches: matches || [],
      search_error: searchError?.message,
    });
  } catch (error) {
    console.error('Error in POST /api/debug:', error);
    return errorResponse('internal_error', String(error), 500);
  }
}
