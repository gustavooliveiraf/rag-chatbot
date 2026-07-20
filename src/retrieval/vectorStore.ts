import { PGVectorStore } from "@langchain/pgvector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "../config/index.js";

let storePromise: Promise<PGVectorStore> | undefined;

export function getVectorStore(): Promise<PGVectorStore> {
  storePromise ??= PGVectorStore.initialize(
    new OpenAIEmbeddings({ apiKey: config.openaiApiKey, model: config.embeddingModel, maxRetries: 0 }),
    {
      postgresConnectionOptions: { connectionString: config.databaseUrl },
      tableName: "chunks",
      columns: {
        idColumnName: "id",
        contentColumnName: "text",
        metadataColumnName: "metadata",
        vectorColumnName: "embedding",
      },
      distanceStrategy: "cosine",
    },
  );
  return storePromise;
}

/**
 * PGVectorStore holds a client checked out from its internal pool for the
 * lifetime of the store (released only here), so one-shot scripts (ingest,
 * eval) must call this or the process hangs after finishing its work.
 */
export async function closeVectorStore(): Promise<void> {
  if (storePromise) {
    const store = await storePromise;
    storePromise = undefined;
    await store.end();
  }
}
