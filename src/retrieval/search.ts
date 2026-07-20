import { callOpenAi } from "../config/clients.js";
import { config } from "../config/index.js";
import { getVectorStore } from "./vectorStore.js";
import type { RetrievedChunk } from "../types/index.js";

interface ChunkMetadata {
  documentId: string;
  chunkIndex: number;
  headingPath: string;
  tokenCount: number;
  documentTitle: string;
  sourceUrl: string;
}

export async function searchChunks(
  question: string,
  topK: number = config.retrievalTopK,
): Promise<RetrievedChunk[]> {
  const vectorStore = await getVectorStore();

  const results = await callOpenAi("similaritySearchWithScore", () =>
    vectorStore.similaritySearchWithScore(question, topK),
  );

  return results.map(([doc, distance]) => {
    const metadata = doc.metadata as ChunkMetadata;
    return {
      id: doc.id as string,
      documentId: metadata.documentId,
      chunkIndex: metadata.chunkIndex,
      headingPath: metadata.headingPath,
      content: doc.pageContent,
      tokenCount: metadata.tokenCount,
      embedding: [],
      documentTitle: metadata.documentTitle,
      sourceUrl: metadata.sourceUrl,
      similarity: 1 - distance,
    };
  });
}
