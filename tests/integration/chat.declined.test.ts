import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const { searchChunksMock, recordInteractionMock, chatCompletionsCreateMock } = vi.hoisted(() => ({
  searchChunksMock: vi.fn(),
  recordInteractionMock: vi.fn(),
  chatCompletionsCreateMock: vi.fn(),
}));

vi.mock("../../src/retrieval/search.js", () => ({ searchChunks: searchChunksMock }));
vi.mock("../../src/observability/interactions.js", () => ({
  recordInteraction: recordInteractionMock,
}));
vi.mock("../../src/config/clients.js", () => ({
  openai: { chat: { completions: { create: chatCompletionsCreateMock } } },
  callOpenAi: async (_op: string, fn: () => Promise<unknown>) => fn(),
  ExternalApiError: class ExternalApiError extends Error {},
}));

const { app } = await import("../../src/api/server.js");

describe("POST /chat - decline path (User Story 2)", () => {
  beforeEach(() => {
    searchChunksMock.mockReset();
    recordInteractionMock.mockReset();
    chatCompletionsCreateMock.mockReset();
  });

  it("returns grounded:false and empty sources when no chunk clears the similarity threshold", async () => {
    searchChunksMock.mockResolvedValue([
      {
        id: "chunk-1",
        documentId: "doc-1",
        chunkIndex: 0,
        headingPath: "Unrelated Section",
        content: "Unrelated content",
        tokenCount: 5,
        embedding: [],
        documentTitle: "Unrelated",
        sourceUrl: "https://developers.vtex.com/docs/unrelated",
        similarity: 0.1,
      },
    ]);

    const res = await request(app)
      .post("/chat")
      .send({ question: "What is the capital of France?" });

    expect(res.status).toBe(200);
    expect(res.body.grounded).toBe(false);
    expect(res.body.sources).toEqual([]);
    expect(res.body.answer).toBeTruthy();
    expect(chatCompletionsCreateMock).not.toHaveBeenCalled();
    expect(recordInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({ grounded: false }),
    );
  });
});
