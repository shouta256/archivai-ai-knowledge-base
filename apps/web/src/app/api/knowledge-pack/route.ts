import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, KnowledgePackRow, NoteRow } from '@/lib/supabase';
import { generateKnowledgePack } from '@/lib/gemini';
import { errorResponse, successResponse, parseJson } from '@/lib/api-utils';
import { generatePackSchema } from '@/lib/schemas';

// GET /api/knowledge-pack - List knowledge packs
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const supabase = getSupabaseAdmin();

    const { data: packs, error } = await supabase
      .from('knowledge_packs')
      .select('id, range_start, range_end, created_at')
      .eq('user_id', userId)
      .order('range_start', { ascending: false })
      .returns<Pick<KnowledgePackRow, 'id' | 'range_start' | 'range_end' | 'created_at'>[]>();

    if (error) {
      console.error('Error fetching packs:', error);
      return errorResponse('database_error', 'Failed to fetch knowledge packs', 500);
    }

    return successResponse({ packs: packs || [] });
  } catch (error) {
    console.error('Error in GET /api/knowledge-pack:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}

// POST /api/knowledge-pack/generate - Generate a knowledge pack
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

    const parsed = generatePackSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('validation_error', 'Invalid request body', 400, {
        errors: parsed.error.flatten(),
      });
    }

    const { range_start, range_end, mode } = parsed.data;
    const supabase = getSupabaseAdmin();

    // Determine if this is an "all data" pack (no date range)
    const isAllData = !range_start || !range_end;
    const effectiveStart = range_start || '1970-01-01';
    const effectiveEnd = range_end || '2099-12-31';

    // Check if pack already exists
    const { data: existingPack } = await supabase
      .from('knowledge_packs')
      .select('id, content_md')
      .eq('user_id', userId)
      .eq('range_start', effectiveStart)
      .eq('range_end', effectiveEnd)
      .single<Pick<KnowledgePackRow, 'id' | 'content_md'>>();

    if (existingPack && mode === 'skip') {
      return successResponse({
        pack_id: existingPack.id,
        content_md: existingPack.content_md,
        existed: true,
      });
    }

    // Get notes (all data or in date range)
    let notesQuery = supabase
      .from('notes')
      .select('title, content_text, ink_caption, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!isAllData) {
      notesQuery = notesQuery
        .gte('created_at', effectiveStart)
        .lte('created_at', effectiveEnd + 'T23:59:59.999Z');
    }

    const { data: notes, error: notesError } = await notesQuery
      .returns<Pick<NoteRow, 'title' | 'content_text' | 'ink_caption' | 'created_at'>[]>();

    if (notesError) {
      console.error('Error fetching notes:', notesError);
      return errorResponse('database_error', 'Failed to fetch notes', 500);
    }

    // Generate pack
    const contentMd = await generateKnowledgePack(notes || [], effectiveStart, effectiveEnd);

    // Upsert pack
    let packId: string;
    if (existingPack) {
      const { error: updateError } = await supabase
        .from('knowledge_packs')
        .update({ content_md: contentMd } as KnowledgePackRow)
        .eq('id', existingPack.id);

      if (updateError) {
        console.error('Error updating pack:', updateError);
        return errorResponse('database_error', 'Failed to update knowledge pack', 500);
      }
      packId = existingPack.id;
    } else {
      const { data: newPack, error: insertError } = await supabase
        .from('knowledge_packs')
        .insert({
          user_id: userId,
          range_start: effectiveStart,
          range_end: effectiveEnd,
          content_md: contentMd,
        } as KnowledgePackRow)
        .select('id')
        .single<{ id: string }>();

      if (insertError || !newPack) {
        console.error('Error creating pack:', insertError);
        return errorResponse('database_error', 'Failed to create knowledge pack', 500);
      }
      packId = newPack.id;
    }

    return successResponse({
      pack_id: packId,
      content_md: contentMd,
      existed: false,
    });
  } catch (error) {
    console.error('Error in POST /api/knowledge-pack/generate:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
