CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  heading_path TEXT NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  embedding VECTOR (1536) NOT NULL,
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  question TEXT NOT NULL,
  retrieved_chunk_ids UUID[] NOT NULL DEFAULT '{}',
  answer TEXT,
  grounded BOOLEAN NOT NULL,
  error TEXT
);
