import type { RetrievedChunk } from "../types/index.js";
import { config } from "../config/index.js";

/**
 * Applies the fixed similarity-score decline threshold (FR-004, research.md §4).
 * Chunks scoring below `threshold` are excluded; an empty return means retrieval
 * found nothing usable, which generation treats as the no-context / decline path.
 */
export function selectPassages(
  chunks: RetrievedChunk[],
  threshold: number = config.retrievalSimilarityThreshold,
): RetrievedChunk[] {
  return chunks.filter((chunk) => chunk.similarity >= threshold);
}
