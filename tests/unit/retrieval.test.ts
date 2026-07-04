import { describe, it, expect, vi, beforeEach } from "vitest";

const { queryMock, embeddingsCreateMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  embeddingsCreateMock: vi.fn(),
}));

vi.mock("../../src/db/pool.js", () => ({
  pool: { query: queryMock },
}));

vi.mock("../../src/config/clients.js", () => ({
  openai: { embeddings: { create: embeddingsCreateMock } },
  callOpenAi: async (_op: string, fn: () => Promise<unknown>) => fn(),
}));

const { searchChunks } = await import("../../src/retrieval/search.js");

describe("searchChunks", () => {
  beforeEach(() => {
    queryMock.mockReset();
    embeddingsCreateMock.mockReset();
  });

  it("embeds the question and returns top-k chunks with similarity scores", async () => {
    embeddingsCreateMock.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
    queryMock.mockResolvedValue({
      rows: [
        {
          id: "chunk-1",
          documentId: "doc-1",
          chunkIndex: 0,
          headingPath: "Checkout > Shipping Policies",
          content: "Shipping policies are configured in the Checkout admin panel.",
          tokenCount: 120,
          documentTitle: "Checkout",
          sourceUrl: "https://developers.vtex.com/docs/checkout",
          similarity: 0.92,
        },
      ],
    });

    const result = await searchChunks("How do I configure a shipping policy?", 5);

    expect(embeddingsCreateMock).toHaveBeenCalledOnce();
    expect(queryMock).toHaveBeenCalledOnce();
    expect(queryMock.mock.calls[0]?.[1]?.[1]).toBe(5);
    expect(result).toHaveLength(1);
    expect(result[0]?.similarity).toBeCloseTo(0.92);
    expect(result[0]?.headingPath).toBe("Checkout > Shipping Policies");
  });
});
