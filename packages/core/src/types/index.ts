// Note Types
export type NoteType = 'text' | 'ink' | 'hybrid';

export interface Note {
  id: string;
  user_id: string;
  type: NoteType;
  title: string | null;
  content_text: string | null;
  ink_json: InkData | null;
  ink_image_path: string | null;
  ink_caption: string | null;
  category_id: string | null;
  tags: string[];
  language_mix: LanguageMix | null;
  created_at: string;
  updated_at: string;
}

export interface NoteListItem {
  id: string;
  type: NoteType;
  title: string | null;
  snippet: string | null;
  category_id: string | null;
  category_name: string | null;
  tags: string[];
  created_at: string;
}

// Ink Types
export interface InkStroke {
  tool: 'pen' | 'eraser';
  width: number;
  points: [number, number, number][]; // [x, y, timestamp_offset]
}

export interface InkData {
  canvas_w: number;
  canvas_h: number;
  strokes: InkStroke[];
}

// Category Types
export interface Category {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

// Classification Types
export interface LanguageMix {
  ja?: number;
  en?: number;
  [key: string]: number | undefined;
}

export interface ClassificationResult {
  proposed_category_name: string;
  confidence: number;
  new_category_reason: string | null;
  language_mix: LanguageMix;
}

// Embedding Types
export interface NoteEmbedding {
  note_id: string;
  user_id: string;
  embedding: number[];
  model: string;
  content_hash: string;
  created_at: string;
}

// Knowledge Pack Types
export interface KnowledgePack {
  id: string;
  user_id: string;
  range_start: string;
  range_end: string;
  content_md: string;
  created_at: string;
}

export type PackGenerateMode = 'skip' | 'overwrite';

// Device Types
export interface Device {
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

// Job Types
export type JobType = 'classify_note' | 'embed_note' | 'caption_ink' | 'generate_pack';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface Job {
  id: string;
  user_id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
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

// API Types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiError;
}

// RAG Types
export interface RagSource {
  note_id: string;
  title: string | null;
  snippet: string;
  score: number;
  created_at: string;
}

export interface RagResponse {
  answer: string;
  sources: RagSource[];
}

// Pagination
export interface CursorPagination<T> {
  items: T[];
  next_cursor: string | null;
}

export interface PaginationCursor {
  created_at: string;
  id: string;
}
