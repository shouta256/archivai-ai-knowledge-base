import { z } from 'zod';

// Note Schemas
export const noteTypeSchema = z.enum(['text', 'ink', 'hybrid']);

export const inkStrokeSchema = z.object({
  tool: z.enum(['pen', 'eraser']),
  width: z.number().positive(),
  points: z.array(z.tuple([z.number(), z.number(), z.number()])),
});

export const inkDataSchema = z.object({
  canvas_w: z.number().positive(),
  canvas_h: z.number().positive(),
  strokes: z.array(inkStrokeSchema),
});

export const languageMixSchema = z.record(z.string(), z.number().min(0).max(1));

// Create Note
export const createNoteSchema = z.object({
  type: noteTypeSchema.default('text'),
  title: z.string().max(255).optional().nullable(),
  content_text: z.string().max(50000).optional().nullable(),
  ink_json: inkDataSchema.optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

// Update Note
export const updateNoteSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  content_text: z.string().max(50000).optional().nullable(),
  ink_json: inkDataSchema.optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

// Category
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// RAG Query
export const ragQuerySchema = z.object({
  query: z.string().min(1).max(2000),
  top_k: z.number().int().min(1).max(20).default(8),
});

export type RagQueryInput = z.infer<typeof ragQuerySchema>;

// Knowledge Pack
export const generatePackSchema = z.object({
  range_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  range_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(['skip', 'overwrite']).default('skip'),
});

export type GeneratePackInput = z.infer<typeof generatePackSchema>;

// Device Bootstrap
export const deviceBootstrapSchema = z.object({
  device_name: z.string().max(100).default('pkp device'),
});

export type DeviceBootstrapInput = z.infer<typeof deviceBootstrapSchema>;

// Device Claim
export const deviceClaimSchema = z.object({
  pair_code: z.string().length(6),
});

export type DeviceClaimInput = z.infer<typeof deviceClaimSchema>;

// Ink Ingest
export const clientMetaSchema = z.object({
  fw_version: z.string().optional(),
  battery: z.number().min(0).max(1).optional(),
  locale: z.string().optional(),
}).passthrough();

export const inkIngestSchema = z.object({
  device_id: z.string().uuid(),
  captured_at_ms: z.number().int().positive(),
  canvas_w: z.number().positive(),
  canvas_h: z.number().positive(),
  strokes: z.array(inkStrokeSchema),
  client_meta: clientMetaSchema.optional(),
});

export type InkIngestInput = z.infer<typeof inkIngestSchema>;

// Classification Result
export const classificationResultSchema = z.object({
  proposed_category_name: z.string(),
  confidence: z.number().min(0).max(1),
  new_category_reason: z.string().nullable(),
  language_mix: languageMixSchema,
});

export type ClassificationResultInput = z.infer<typeof classificationResultSchema>;

// Pagination
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// Job Payloads
export const classifyNotePayloadSchema = z.object({
  note_id: z.string().uuid(),
});

export const embedNotePayloadSchema = z.object({
  note_id: z.string().uuid(),
});

export const captionInkPayloadSchema = z.object({
  note_id: z.string().uuid(),
});

export const generatePackPayloadSchema = z.object({
  range_start: z.string(),
  range_end: z.string(),
  mode: z.enum(['skip', 'overwrite']),
});

export type ClassifyNotePayload = z.infer<typeof classifyNotePayloadSchema>;
export type EmbedNotePayload = z.infer<typeof embedNotePayloadSchema>;
export type CaptionInkPayload = z.infer<typeof captionInkPayloadSchema>;
export type GeneratePackPayload = z.infer<typeof generatePackPayloadSchema>;
