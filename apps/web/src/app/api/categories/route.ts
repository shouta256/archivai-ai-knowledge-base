import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, CategoryRow } from '@/lib/supabase';
import { errorResponse, successResponse, parseJson } from '@/lib/api-utils';
import { createCategorySchema } from '@/lib/schemas';

// GET /api/categories - List user's categories
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    const supabase = getSupabaseAdmin();

    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('name', { ascending: true })
      .returns<CategoryRow[]>();

    if (error) {
      console.error('Error fetching categories:', error);
      return errorResponse('database_error', 'Failed to fetch categories', 500);
    }

    return successResponse({ categories: categories || [] });
  } catch (error) {
    console.error('Error in GET /api/categories:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}

// POST /api/categories - Create a new category
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

    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('validation_error', 'Invalid request body', 400, {
        errors: parsed.error.flatten(),
      });
    }

    const supabase = getSupabaseAdmin();

    // Check if category already exists
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('name', parsed.data.name)
      .single<{ id: string }>();

    if (existing) {
      return errorResponse('conflict', 'Category already exists', 409, {
        existing_id: existing.id,
      });
    }

    // Create category
    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: parsed.data.name,
      } as CategoryRow)
      .select()
      .single<CategoryRow>();

    if (error || !category) {
      console.error('Error creating category:', error);
      return errorResponse('database_error', 'Failed to create category', 500);
    }

    return successResponse({ category }, 201);
  } catch (error) {
    console.error('Error in POST /api/categories:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
