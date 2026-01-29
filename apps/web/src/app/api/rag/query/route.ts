import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, NoteRow, MatchResult } from '@/lib/supabase';
import { generateEmbedding, generateRagAnswer, RagSource } from '@/lib/gemini';
import { errorResponse, successResponse, parseJson } from '@/lib/api-utils';
import { ragQuerySchema } from '@/lib/schemas';

// POST /api/rag/query - RAG query
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

    const parsed = ragQuerySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('validation_error', 'Invalid request body', 400, {
        errors: parsed.error.flatten(),
      });
    }

    const { query, top_k } = parsed.data;
    const supabase = getSupabaseAdmin();

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Search for similar notes
    const { data, error: searchError } = await supabase.rpc('match_note_embeddings', {
      query_embedding: queryEmbedding,
      p_user_id: userId,
      match_threshold: 0.0,
      match_count: top_k,
    });
    const matches = data as MatchResult[] | null;

    if (searchError) {
      console.error('Error searching embeddings:', searchError);
      return errorResponse('search_error', 'Failed to search notes', 500);
    }

    if (!matches || matches.length === 0) {
      return successResponse({
        answer: "I couldn't find any relevant notes in your knowledge base to answer this question.",
        sources: [],
      });
    }

    // Get full note data for matches
    const noteIds = matches.map((m: MatchResult) => m.note_id);
    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select('id, title, content_text, ink_caption, created_at')
      .in('id', noteIds)
      .eq('user_id', userId);
    
    const notes = notesData as Pick<NoteRow, 'id' | 'title' | 'content_text' | 'ink_caption' | 'created_at'>[] | null;

    if (notesError) {
      console.error('Error fetching matched notes:', notesError);
      return errorResponse('database_error', 'Failed to fetch notes', 500);
    }

    // Build sources with scores
    const sources: RagSource[] = matches.map((match: MatchResult) => {
      const note = notes?.find((n) => n.id === match.note_id);
      const text = note?.content_text || note?.ink_caption || '';
      const snippet = text.length > 300 ? text.slice(0, 297) + '...' : text;

      return {
        note_id: match.note_id,
        title: note?.title || null,
        snippet,
        score: match.similarity,
        created_at: note?.created_at || '',
      };
    });

    // Generate answer
    const answer = await generateRagAnswer(query, sources);

    return successResponse({
      answer,
      sources,
    });
  } catch (error) {
    console.error('Error in POST /api/rag/query:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
