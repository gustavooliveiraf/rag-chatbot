import { createHash } from "node:crypto";
import { pool } from "../src/db/pool.js";
import { openai, callOpenAi } from "../src/config/clients.js";
import { config } from "../src/config/index.js";
import { parseMarkdown } from "./chunk.js";
import type { DocumentReference } from "./contentProvider.js";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function hashContent(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function ingestDocument(
  doc: DocumentReference,
  rawContent: string,
): Promise<"created" | "updated" | "unchanged"> {
  const contentHash = hashContent(rawContent);
  const parsed = parseMarkdown(rawContent, doc.path);

  const upsertResult = await pool.query<{ id: string; previous_hash: string | null }>(
    `WITH existing AS (
       SELECT content_hash FROM documents WHERE source_url = $1
     )
     INSERT INTO documents (source_url, title, content_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (source_url) DO UPDATE
       SET title = EXCLUDED.title,
           content_hash = EXCLUDED.content_hash,
           fetched_at = now()
     RETURNING id, (SELECT content_hash FROM existing) AS previous_hash`,
    [doc.url, parsed.title, contentHash],
  );

  const row = upsertResult.rows[0];
  if (!row) {
    throw new Error(`Upsert of document ${doc.url} returned no row`);
  }

  const isNew = row.previous_hash === null;
  const changed = isNew || row.previous_hash !== contentHash;
  if (!changed) {
    return "unchanged";
  }

  const documentId = row.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM chunks WHERE document_id = $1", [documentId]);

    for (const chunk of parsed.chunks) {
      const embeddingResponse = await callOpenAi("embeddings.create", () =>
        openai.embeddings.create({ model: config.embeddingModel, input: chunk.content }),
      );
      const embedding = embeddingResponse.data[0]?.embedding;
      if (!embedding) {
        throw new Error(
          `OpenAI embeddings response contained no data for ${doc.path}#${chunk.chunkIndex}`,
        );
      }

      await client.query(
        `INSERT INTO chunks (document_id, chunk_index, heading_path, content, token_count, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [
          documentId,
          chunk.chunkIndex,
          chunk.headingPath,
          chunk.content,
          chunk.tokenCount,
          toVectorLiteral(embedding),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return isNew ? "created" : "updated";
}
