-- Migration: Update embedding dimensions from 1536 to 768
-- Run this in Supabase SQL Editor
-- Required for gemini-embedding-001 with outputDimensionality=768

-- Step 1: Drop the existing index (required before altering column)
DROP INDEX IF EXISTS note_embeddings_vec_idx;

-- Step 2: Alter the embedding column to use 768 dimensions
ALTER TABLE note_embeddings 
ALTER COLUMN embedding TYPE vector(768);

-- Step 3: Recreate the vector similarity index using IVFFlat (supports up to 2000 dimensions)
CREATE INDEX note_embeddings_vec_idx 
ON note_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 4: Update the match function to use 768 dimensions
CREATE OR REPLACE FUNCTION match_note_embeddings(
  query_embedding vector(768),
  p_user_id text,
  match_threshold float default 0.0,
  match_count int default 10
)
RETURNS TABLE (
  note_id uuid,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    note_embeddings.note_id,
    1 - (note_embeddings.embedding <=> query_embedding) AS similarity
  FROM note_embeddings
  WHERE note_embeddings.user_id = p_user_id
    AND 1 - (note_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY note_embeddings.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Step 5: Clear existing embeddings (they need to be regenerated with new dimensions)
-- WARNING: This deletes all existing embeddings!
DELETE FROM note_embeddings;
