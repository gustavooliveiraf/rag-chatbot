import { pool } from "../db/pool.js";
import { openai, callOpenAi } from "../config/clients.js";
import { config } from "../config/index.js";
import type { RetrievedChunk } from "../types/index.js";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function searchChunks(
  question: string,
  topK: number = config.retrievalTopK,
): Promise<RetrievedChunk[]> {
  const embeddingResponse = await callOpenAi("embeddings.create", () =>
    openai.embeddings.create({ model: config.embeddingModel, input: question }),
  );
  const queryEmbedding = embeddingResponse.data[0]?.embedding;
  if (!queryEmbedding) {
    throw new Error("OpenAI embeddings response contained no data");
  }

  const vectorLiteral = toVectorLiteral(queryEmbedding);
  const result = await pool.query(
    `SELECT
       c.id,
       c.document_id AS "documentId",
       c.chunk_index AS "chunkIndex",
       c.heading_path AS "headingPath",
       c.content,
       c.token_count AS "tokenCount",
       d.title AS "documentTitle",
       d.source_url AS "sourceUrl",
       1 - (c.embedding <=> $1) AS similarity
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     ORDER BY c.embedding <=> $1
     LIMIT $2`,
    [vectorLiteral, topK],
  );

  return result.rows.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    chunkIndex: row.chunkIndex,
    headingPath: row.headingPath,
    content: row.content,
    tokenCount: row.tokenCount,
    embedding: [],
    documentTitle: row.documentTitle,
    sourceUrl: row.sourceUrl,
    similarity: Number(row.similarity),
  }));
}
