import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/knowledge-pack/:id - Get a single knowledge pack
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: pack, error } = await supabase
      .from('knowledge_packs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !pack) {
      return errorResponse('not_found', 'Knowledge pack not found', 404);
    }

    return successResponse({ pack });
  } catch (error) {
    console.error('Error in GET /api/knowledge-pack/:id:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}

// DELETE /api/knowledge-pack/:id - Delete a knowledge pack
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('knowledge_packs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting pack:', error);
      return errorResponse('database_error', 'Failed to delete knowledge pack', 500);
    }

    return successResponse({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/knowledge-pack/:id:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
