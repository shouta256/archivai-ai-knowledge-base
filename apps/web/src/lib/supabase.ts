import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Row types
export interface NoteRow {
  id: string;
  user_id: string;
  type: 'text' | 'ink' | 'hybrid';
  title: string | null;
  content_text: string | null;
  ink_json: unknown | null;
  ink_image_path: string | null;
  ink_caption: string | null;
  category_id: string | null;
  tags: string[];
  language_mix: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export interface NoteWithCategory extends NoteRow {
  categories: { id: string; name: string } | null;
}

export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface NoteEmbeddingRow {
  note_id: string;
  user_id: string;
  embedding: number[];
  model: string;
  content_hash: string;
  created_at: string;
}

export interface KnowledgePackRow {
  id: string;
  user_id: string;
  range_start: string;
  range_end: string;
  content_md: string;
  created_at: string;
}

export interface DeviceRow {
  id: string;
  user_id: string | null;
  device_name: string;
  device_key_hash: string | null;
  pair_code: string | null;
  pair_expires_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface JobRow {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  attempts: number;
  max_attempts: number;
  run_after: string;
  locked_at: string | null;
  locked_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  tokens_estimate: number | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchResult {
  note_id: string;
  similarity: number;
}

// Create Supabase client with Secret key (server-side only)
// Supports both new secret keys (sb_secret_...) and legacy service_role keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseAdmin: SupabaseClient<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdmin(): SupabaseClient<any> {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Try new secret key first, fallback to legacy service_role key
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Missing Supabase environment variables (need SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY)');
  }

  supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}

// Helper to check if we're on the server
export function isServer(): boolean {
  return typeof window === 'undefined';
}
