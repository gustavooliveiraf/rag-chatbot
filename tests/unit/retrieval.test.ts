import { describe, it, expect, vi, beforeEach } from "vitest";
import { Document } from "@langchain/core/documents";

const { similaritySearchWithScoreMock } = vi.hoisted(() => ({
  similaritySearchWithScoreMock: vi.fn(),
}));

vi.mock("../../src/retrieval/vectorStore.js", () => ({
  getVectorStore: async () => ({
    similaritySearchWithScore: similaritySearchWithScoreMock,
  }),
}));

vi.mock("../../src/config/clients.js", () => ({
  callOpenAi: async (_op: string, fn: () => Promise<unknown>) => fn(),
}));

const { searchChunks } = await import("../../src/retrieval/search.js");

describe("searchChunks", () => {
  beforeEach(() => {
    similaritySearchWithScoreMock.mockReset();
  });

  it("queries the vector store and returns top-k chunks with similarity scores", async () => {
    const doc = new Document({
      id: "chunk-1",
      pageContent: "Shipping policies are configured in the Checkout admin panel.",
      metadata: {
        documentId: "doc-1",
        chunkIndex: 0,
        headingPath: "Checkout > Shipping Policies",
        tokenCount: 120,
        documentTitle: "Checkout",
        sourceUrl: "https://developers.vtex.com/docs/checkout",
      },
    });
    similaritySearchWithScoreMock.mockResolvedValue([[doc, 0.08]]);

    const result = await searchChunks("How do I configure a shipping policy?", 5);

    expect(similaritySearchWithScoreMock).toHaveBeenCalledOnce();
    expect(similaritySearchWithScoreMock).toHaveBeenCalledWith(
      "How do I configure a shipping policy?",
      5,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.similarity).toBeCloseTo(0.92);
    expect(result[0]?.headingPath).toBe("Checkout > Shipping Policies");
  });
});
