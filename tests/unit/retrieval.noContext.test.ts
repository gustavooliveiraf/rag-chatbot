import { describe, it, expect } from "vitest";
import { selectPassages } from "../../src/retrieval/selectPassages.js";
import type { RetrievedChunk } from "../../src/types/index.js";

function chunk(similarity: number): RetrievedChunk {
  return {
    id: "id",
    documentId: "doc",
    chunkIndex: 0,
    headingPath: "Section",
    content: "content",
    tokenCount: 10,
    embedding: [],
    documentTitle: "Title",
    sourceUrl: "https://developers.vtex.com/docs/x",
    similarity,
  };
}

describe("selectPassages (FR-004 fixed similarity threshold)", () => {
  it("keeps chunks scoring at or above the threshold", () => {
    const result = selectPassages([chunk(0.9), chunk(0.5)], 0.75);
    expect(result).toHaveLength(1);
    expect(result[0]?.similarity).toBe(0.9);
  });

  it("returns an empty array when no chunk meets the threshold (no-context path)", () => {
    const result = selectPassages([chunk(0.4), chunk(0.6)], 0.75);
    expect(result).toEqual([]);
  });

  it("keeps a chunk scoring exactly at the threshold", () => {
    const result = selectPassages([chunk(0.75)], 0.75);
    expect(result).toHaveLength(1);
  });
});
