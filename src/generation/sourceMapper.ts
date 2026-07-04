import type { RetrievedChunk, SourceRef } from "../types/index.js";

/**
 * Maps retrieved chunks to the SourceRef contract shape (contracts/openapi.yaml),
 * deduping chunks that share the same page section so a single heading isn't
 * cited multiple times.
 */
export function toSourceRefs(chunks: RetrievedChunk[]): SourceRef[] {
  const seen = new Set<string>();
  const refs: SourceRef[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.sourceUrl}#${chunk.headingPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      title: chunk.documentTitle,
      headingPath: chunk.headingPath,
      url: chunk.sourceUrl,
    });
  }

  return refs;
}
