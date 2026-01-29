import { getSupabaseAdmin, JobRow, NoteRow, CategoryRow, NoteEmbeddingRow, KnowledgePackRow } from './supabase';
import { classifyNote, generateEmbedding, generateKnowledgePack, generateInkCaption } from './gemini';
import { generateContentHash } from './api-utils';

type JobType = 'classify_note' | 'embed_note' | 'caption_ink' | 'generate_pack';

interface JobResult {
  success: boolean;
  tokensEstimate?: number;
  error?: string;
}

// Job processor functions
async function processClassifyNote(job: JobRow): Promise<JobResult> {
  const supabase = getSupabaseAdmin();
  const noteId = (job.payload as { note_id: string }).note_id;

  // Get note
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('id, title, content_text, ink_caption, user_id')
    .eq('id', noteId)
    .eq('user_id', job.user_id)
    .single<Pick<NoteRow, 'id' | 'title' | 'content_text' | 'ink_caption' | 'user_id'>>();

  if (noteError || !note) {
    return { success: false, error: 'Note not found' };
  }

  // Get text content for classification
  const textParts = [note.title, note.content_text, note.ink_caption].filter(Boolean) as string[];
  const text = textParts.join('\n\n');

  if (!text.trim()) {
    return { success: true, tokensEstimate: 0 };
  }

  // Get existing categories
  const { data: categories } = await supabase
    .from('categories')
    .select('name')
    .eq('user_id', job.user_id)
    .limit(50)
    .returns<Pick<CategoryRow, 'name'>[]>();

  // Get recent categories (from last 20 notes)
  const { data: recentNotes } = await supabase
    .from('notes')
    .select('category_id')
    .eq('user_id', job.user_id)
    .not('category_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<Pick<NoteRow, 'category_id'>[]>();

  const recentCategoryIds = [...new Set(recentNotes?.map((n) => n.category_id).filter(Boolean))] as string[];
  let recentCategories: Pick<CategoryRow, 'name'>[] = [];
  if (recentCategoryIds.length > 0) {
    const { data } = await supabase
      .from('categories')
      .select('name')
      .in('id', recentCategoryIds)
      .limit(10)
      .returns<Pick<CategoryRow, 'name'>[]>();
    recentCategories = data || [];
  }

  // Classify
  const result = await classifyNote(
    text,
    categories?.map((c) => c.name) || [],
    recentCategories.map((c) => c.name)
  );

  // Update note with language_mix
  await supabase
    .from('notes')
    .update({ language_mix: result.language_mix } as Partial<NoteRow>)
    .eq('id', noteId);

  // If confidence >= 0.7 and category exists, apply it
  if (result.confidence >= 0.7) {
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', job.user_id)
      .eq('name', result.proposed_category_name)
      .single<{ id: string }>();

    if (existingCategory) {
      await supabase
        .from('notes')
        .update({ category_id: existingCategory.id } as Partial<NoteRow>)
        .eq('id', noteId);
    }
  }

  // Estimate tokens (rough: 4 chars = 1 token)
  const tokensEstimate = Math.ceil(text.length / 4);

  return { success: true, tokensEstimate };
}

async function processEmbedNote(job: JobRow): Promise<JobResult> {
  const supabase = getSupabaseAdmin();
  const noteId = (job.payload as { note_id: string }).note_id;

  // Get note
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('id, title, content_text, ink_caption, user_id')
    .eq('id', noteId)
    .eq('user_id', job.user_id)
    .single<Pick<NoteRow, 'id' | 'title' | 'content_text' | 'ink_caption' | 'user_id'>>();

  if (noteError || !note) {
    return { success: false, error: 'Note not found' };
  }

  // Get text content for embedding
  const textParts = [note.title, note.content_text, note.ink_caption].filter(Boolean) as string[];
  const text = textParts.join('\n\n');

  if (!text.trim()) {
    return { success: true, tokensEstimate: 0 };
  }

  // Check if embedding already exists with same content
  const contentHash = generateContentHash(text);
  const { data: existingEmbedding } = await supabase
    .from('note_embeddings')
    .select('content_hash')
    .eq('note_id', noteId)
    .single<Pick<NoteEmbeddingRow, 'content_hash'>>();

  if (existingEmbedding?.content_hash === contentHash) {
    // Embedding is up to date
    return { success: true, tokensEstimate: 0 };
  }

  // Generate embedding
  const embedding = await generateEmbedding(text);
  const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

  // Upsert embedding
  const { error: upsertError } = await supabase
    .from('note_embeddings')
    .upsert({
      note_id: noteId,
      user_id: job.user_id,
      embedding,
      model,
      content_hash: contentHash,
    } as NoteEmbeddingRow);

  if (upsertError) {
    return { success: false, error: upsertError.message };
  }

  // Estimate tokens
  const tokensEstimate = Math.ceil(text.length / 4);

  return { success: true, tokensEstimate };
}

async function processCaptionInk(job: JobRow): Promise<JobResult> {
  const supabase = getSupabaseAdmin();
  const noteId = (job.payload as { note_id: string }).note_id;

  // Get note
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('id, ink_json, ink_caption, ink_image_path, user_id')
    .eq('id', noteId)
    .eq('user_id', job.user_id)
    .single<Pick<NoteRow, 'id' | 'ink_json' | 'ink_caption' | 'ink_image_path' | 'user_id'>>();

  if (noteError || !note) {
    return { success: false, error: 'Note not found' };
  }

  // Skip if already has caption
  if (note.ink_caption) {
    return { success: true, tokensEstimate: 0 };
  }

  // Skip if no ink data
  if (!note.ink_json) {
    return { success: true, tokensEstimate: 0 };
  }

  let caption = 'Handwritten note';
  let tokensEstimate = 100;

  // Try to process image with Gemini Vision if available
  if (note.ink_image_path) {
    try {
      // Download image from Supabase Storage
      const { data: imageData, error: downloadError } = await supabase.storage
        .from('ink-images')
        .download(note.ink_image_path);

      if (downloadError || !imageData) {
        console.error('Failed to download ink image:', downloadError);
        // Fall back to basic caption
        const inkData = note.ink_json as { strokes?: Array<unknown> };
        const strokeCount = inkData.strokes?.length || 0;
        caption = `Handwritten note (${strokeCount} strokes)`;
      } else {
        // Convert blob to base64
        const arrayBuffer = await imageData.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        // Generate caption with Gemini Vision
        caption = await generateInkCaption(base64);
        tokensEstimate = 500; // Vision API uses more tokens
      }
    } catch (visionError) {
      console.error('Error generating ink caption with Vision:', visionError);
      // Fall back to basic caption
      const inkData = note.ink_json as { strokes?: Array<unknown> };
      const strokeCount = inkData.strokes?.length || 0;
      caption = `Handwritten note (${strokeCount} strokes)`;
    }
  } else {
    // No image available - use stroke-based caption
    const inkData = note.ink_json as { strokes?: Array<unknown> };
    const strokeCount = inkData.strokes?.length || 0;
    caption = `Handwritten note (${strokeCount} strokes)`;
  }

  // Update note with caption
  await supabase
    .from('notes')
    .update({ ink_caption: caption } as Partial<NoteRow>)
    .eq('id', noteId);

  // Enqueue embed job now that we have caption
  await enqueueJob(job.user_id, 'embed_note', { note_id: noteId });

  return { success: true, tokensEstimate };
}

async function processGeneratePack(job: JobRow): Promise<JobResult> {
  const supabase = getSupabaseAdmin();
  const payload = job.payload as { range_start: string; range_end: string; mode: 'skip' | 'overwrite' };

  // Check if pack already exists
  const { data: existingPack } = await supabase
    .from('knowledge_packs')
    .select('id')
    .eq('user_id', job.user_id)
    .eq('range_start', payload.range_start)
    .eq('range_end', payload.range_end)
    .single<{ id: string }>();

  if (existingPack && payload.mode === 'skip') {
    return { success: true, tokensEstimate: 0 };
  }

  // Get notes in date range
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('title, content_text, ink_caption, created_at')
    .eq('user_id', job.user_id)
    .gte('created_at', payload.range_start)
    .lte('created_at', payload.range_end + 'T23:59:59.999Z')
    .order('created_at', { ascending: true })
    .returns<Pick<NoteRow, 'title' | 'content_text' | 'ink_caption' | 'created_at'>[]>();

  if (notesError) {
    return { success: false, error: notesError.message };
  }

  // Generate pack
  const contentMd = await generateKnowledgePack(notes || [], payload.range_start, payload.range_end);

  // Upsert pack
  if (existingPack) {
    await supabase
      .from('knowledge_packs')
      .update({ content_md: contentMd } as Partial<KnowledgePackRow>)
      .eq('id', existingPack.id);
  } else {
    await supabase.from('knowledge_packs').insert({
      user_id: job.user_id,
      range_start: payload.range_start,
      range_end: payload.range_end,
      content_md: contentMd,
    } as KnowledgePackRow);
  }

  // Estimate tokens (notes + output)
  const inputTokens = (notes || []).reduce((acc, n) => {
    return acc + (n.title?.length || 0) + (n.content_text?.length || 0) + (n.ink_caption?.length || 0);
  }, 0) / 4;
  const outputTokens = contentMd.length / 4;

  return { success: true, tokensEstimate: Math.ceil(inputTokens + outputTokens) };
}

// Enqueue a job
export async function enqueueJob(
  userId: string,
  type: JobType,
  payload: Record<string, unknown>,
  runAfter?: Date
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      user_id: userId,
      type,
      payload,
      status: 'queued',
      attempts: 0,
      max_attempts: 3,
      run_after: (runAfter || new Date()).toISOString(),
    } as JobRow)
    .select('id')
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(`Failed to enqueue job: ${error?.message}`);
  }

  return data.id;
}

// Process a single job
async function processJob(job: JobRow): Promise<JobResult> {
  switch (job.type as JobType) {
    case 'classify_note':
      return processClassifyNote(job);
    case 'embed_note':
      return processEmbedNote(job);
    case 'caption_ink':
      return processCaptionInk(job);
    case 'generate_pack':
      return processGeneratePack(job);
    default:
      return { success: false, error: `Unknown job type: ${job.type}` };
  }
}

// Run job processor
export async function runJobProcessor(batchLimit: number = 10, runnerId?: string): Promise<{ processed: number; failed: number }> {
  const supabase = getSupabaseAdmin();
  const runnerIdValue = runnerId || `runner-${Date.now()}`;
  let processed = 0;
  let failed = 0;

  while (processed < batchLimit) {
    // Get next job using the database function
    const { data, error: lockError } = await supabase.rpc('get_next_job', {
      p_runner_id: runnerIdValue,
    });
    const jobs = data as JobRow[] | null;

    if (lockError) {
      console.error('Error getting next job:', lockError);
      break;
    }

    if (!jobs || jobs.length === 0) {
      // No more jobs
      break;
    }

    const job = jobs[0];
    const startTime = Date.now();

    try {
      const result = await processJob(job);
      const durationMs = Date.now() - startTime;

      if (result.success) {
        await supabase
          .from('jobs')
          .update({
            status: 'succeeded',
            finished_at: new Date().toISOString(),
            duration_ms: durationMs,
            tokens_estimate: result.tokensEstimate || null,
            locked_at: null,
            locked_by: null,
          } as Partial<JobRow>)
          .eq('id', job.id);
      } else {
        throw new Error(result.error || 'Job failed');
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Calculate backoff
      const attempts = job.attempts;
      const backoffMinutes = Math.min(Math.pow(2, attempts), 60);
      const runAfter = new Date(Date.now() + backoffMinutes * 60 * 1000);

      if (attempts >= job.max_attempts) {
        // Mark as failed
        await supabase
          .from('jobs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            duration_ms: durationMs,
            last_error: errorMessage,
            locked_at: null,
            locked_by: null,
          } as Partial<JobRow>)
          .eq('id', job.id);
        failed++;
      } else {
        // Schedule retry
        await supabase
          .from('jobs')
          .update({
            status: 'queued',
            run_after: runAfter.toISOString(),
            last_error: errorMessage,
            locked_at: null,
            locked_by: null,
          } as Partial<JobRow>)
          .eq('id', job.id);
      }

      console.error(`Job ${job.id} failed:`, errorMessage);
    }

    processed++;
  }

  return { processed, failed };
}
