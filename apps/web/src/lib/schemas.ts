import { z } from 'zod';

// Note schemas
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

// Pagination
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
