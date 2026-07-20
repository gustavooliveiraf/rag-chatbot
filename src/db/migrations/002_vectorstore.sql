DROP TABLE IF EXISTS chunks;

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding VECTOR(1536) NOT NULL
);

CREATE INDEX IF NOT EXISTS embedding_embedding_hnsw_idx
  ON chunks USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS chunks_metadata_document_id_idx
  ON chunks ((metadata ->> 'documentId'));
