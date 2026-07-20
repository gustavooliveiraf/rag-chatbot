import { createHash } from "node:crypto";
import { Document } from "@langchain/core/documents";
import { pool } from "../src/db/pool.js";
import { callOpenAi } from "../src/config/clients.js";
import { getVectorStore } from "../src/retrieval/vectorStore.js";
import { parseMarkdown } from "./chunk.js";
import type { DocumentReference } from "./contentProvider.js";

function hashContent(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function ingestDocument(
  doc: DocumentReference,
  rawContent: string,
): Promise<"created" | "updated" | "unchanged"> {
  const contentHash = hashContent(rawContent);
  const parsed = await parseMarkdown(rawContent, doc.path);

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
  const vectorStore = await getVectorStore();

  await callOpenAi("vectorStore.addDocuments", async () => {
    await pool.query(`DELETE FROM chunks WHERE metadata ->> 'documentId' = $1`, [documentId]);

    const docs = parsed.chunks.map(
      (chunk) =>
        new Document({
          pageContent: chunk.content,
          metadata: {
            documentId,
            chunkIndex: chunk.chunkIndex,
            headingPath: chunk.headingPath,
            tokenCount: chunk.tokenCount,
            documentTitle: parsed.title,
            sourceUrl: doc.url,
          },
        }),
    );

    await vectorStore.addDocuments(docs);
  });

  return isNew ? "created" : "updated";
}
