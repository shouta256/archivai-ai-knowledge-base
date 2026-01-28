-- PKP Database Migration
-- Version: 1.0.0
-- Run this in Supabase SQL Editor

-- Enable required extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- =============================================================================
-- TABLES
-- =============================================================================

-- Categories table
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Notes table
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null check (type in ('text', 'ink', 'hybrid')),
  title text null,
  content_text text null,
  ink_json jsonb null,
  ink_image_path text null,
  ink_caption text null,
  category_id uuid null references categories(id) on delete set null,
  tags text[] not null default '{}',
  language_mix jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Note embeddings table
create table if not exists note_embeddings (
  note_id uuid primary key references notes(id) on delete cascade,
  user_id text not null,
  embedding vector(768) not null,
  model text not null,
  content_hash text not null,
  created_at timestamptz not null default now()
);

-- Knowledge packs table
create table if not exists knowledge_packs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  range_start date not null,
  range_end date not null,
  content_md text not null,
  created_at timestamptz not null default now(),
  unique (user_id, range_start, range_end)
);

-- Devices table
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id text null, -- null before pairing
  device_name text not null default 'pkp device',
  device_key_hash text null,
  pair_code text null,
  pair_expires_at timestamptz null,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

-- Jobs table
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null,
  payload jsonb not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz null,
  locked_by text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  duration_ms int null,
  tokens_estimate int null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Notes indexes
create index if not exists notes_user_created_idx on notes (user_id, created_at desc, id desc);
create index if not exists notes_category_idx on notes (user_id, category_id);

-- Note embeddings indexes
create index if not exists note_embeddings_user_idx on note_embeddings (user_id);
create index if not exists note_embeddings_vec_idx on note_embeddings using hnsw (embedding vector_cosine_ops);

-- Knowledge packs indexes
create index if not exists knowledge_packs_user_idx on knowledge_packs (user_id, range_start desc);

-- Devices indexes
create index if not exists devices_pair_code_idx on devices (pair_code);
create index if not exists devices_user_idx on devices (user_id);

-- Jobs indexes
create index if not exists jobs_queue_idx on jobs (status, run_after);
create index if not exists jobs_user_idx on jobs (user_id, created_at desc);

-- Categories indexes
create index if not exists categories_user_idx on categories (user_id);

-- =============================================================================
-- ROW LEVEL SECURITY (Defense-in-depth, for future direct client access)
-- =============================================================================

-- Enable RLS on all tables
alter table notes enable row level security;
alter table categories enable row level security;
alter table note_embeddings enable row level security;
alter table knowledge_packs enable row level security;
alter table devices enable row level security;
alter table jobs enable row level security;

-- Notes policies
create policy notes_select on notes
  for select using (user_id = current_setting('app.user_id', true));

create policy notes_insert on notes
  for insert with check (user_id = current_setting('app.user_id', true));

create policy notes_update on notes
  for update using (user_id = current_setting('app.user_id', true));

create policy notes_delete on notes
  for delete using (user_id = current_setting('app.user_id', true));

-- Categories policies
create policy categories_select on categories
  for select using (user_id = current_setting('app.user_id', true));

create policy categories_insert on categories
  for insert with check (user_id = current_setting('app.user_id', true));

create policy categories_update on categories
  for update using (user_id = current_setting('app.user_id', true));

create policy categories_delete on categories
  for delete using (user_id = current_setting('app.user_id', true));

-- Note embeddings policies
create policy note_embeddings_select on note_embeddings
  for select using (user_id = current_setting('app.user_id', true));

create policy note_embeddings_insert on note_embeddings
  for insert with check (user_id = current_setting('app.user_id', true));

create policy note_embeddings_update on note_embeddings
  for update using (user_id = current_setting('app.user_id', true));

create policy note_embeddings_delete on note_embeddings
  for delete using (user_id = current_setting('app.user_id', true));

-- Knowledge packs policies
create policy knowledge_packs_select on knowledge_packs
  for select using (user_id = current_setting('app.user_id', true));

create policy knowledge_packs_insert on knowledge_packs
  for insert with check (user_id = current_setting('app.user_id', true));

create policy knowledge_packs_update on knowledge_packs
  for update using (user_id = current_setting('app.user_id', true));

create policy knowledge_packs_delete on knowledge_packs
  for delete using (user_id = current_setting('app.user_id', true));

-- Devices policies
create policy devices_select on devices
  for select using (user_id = current_setting('app.user_id', true) or user_id is null);

create policy devices_insert on devices
  for insert with check (true); -- Allow anonymous device creation

create policy devices_update on devices
  for update using (user_id = current_setting('app.user_id', true) or user_id is null);

create policy devices_delete on devices
  for delete using (user_id = current_setting('app.user_id', true));

-- Jobs policies
create policy jobs_select on jobs
  for select using (user_id = current_setting('app.user_id', true));

create policy jobs_insert on jobs
  for insert with check (user_id = current_setting('app.user_id', true));

create policy jobs_update on jobs
  for update using (user_id = current_setting('app.user_id', true));

create policy jobs_delete on jobs
  for delete using (user_id = current_setting('app.user_id', true));

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for notes table
create trigger update_notes_updated_at
  before update on notes
  for each row
  execute function update_updated_at_column();

-- Trigger for jobs table
create trigger update_jobs_updated_at
  before update on jobs
  for each row
  execute function update_updated_at_column();

-- Function for vector similarity search
create or replace function match_note_embeddings(
  query_embedding vector(768),
  p_user_id text,
  match_threshold float default 0.0,
  match_count int default 10
)
returns table (
  note_id uuid,
  similarity float
)
language sql stable
as $$
  select
    note_embeddings.note_id,
    1 - (note_embeddings.embedding <=> query_embedding) as similarity
  from note_embeddings
  where note_embeddings.user_id = p_user_id
    and 1 - (note_embeddings.embedding <=> query_embedding) > match_threshold
  order by note_embeddings.embedding <=> query_embedding
  limit match_count;
$$;

-- Function to get and lock next job for processing
create or replace function get_next_job(p_runner_id text)
returns setof jobs
language plpgsql
as $$
declare
  v_job jobs;
begin
  -- Select and lock the next available job
  select * into v_job
  from jobs
  where status = 'queued'
    and run_after <= now()
    and (locked_at is null or locked_at < now() - interval '5 minutes')
  order by run_after asc
  limit 1
  for update skip locked;

  if v_job.id is not null then
    -- Mark job as locked
    update jobs
    set locked_at = now(),
        locked_by = p_runner_id,
        status = 'running',
        started_at = now(),
        attempts = attempts + 1
    where id = v_job.id;

    -- Return the updated job
    return query select * from jobs where id = v_job.id;
  end if;
end;
$$;
