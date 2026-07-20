import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const { searchChunksMock, recordInteractionMock, buildPromptMock, invokeMock } = vi.hoisted(() => ({
  searchChunksMock: vi.fn(),
  recordInteractionMock: vi.fn(),
  buildPromptMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("../../src/retrieval/search.js", () => ({ searchChunks: searchChunksMock }));
vi.mock("../../src/observability/interactions.js", () => ({
  recordInteraction: recordInteractionMock,
}));
vi.mock("../../src/generation/promptBuilder.js", () => ({
  buildPrompt: buildPromptMock,
}));
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(),
}));

buildPromptMock.mockReturnValue({ pipe: () => ({ invoke: invokeMock }) });

const { app } = await import("../../src/api/server.js");

describe("POST /chat - source traceability (User Story 3)", () => {
  beforeEach(() => {
    searchChunksMock.mockReset();
    recordInteractionMock.mockReset();
    invokeMock.mockReset();
    buildPromptMock.mockClear();
  });

  it("includes accurate, non-empty sources matching the retrieved passage", async () => {
    searchChunksMock.mockResolvedValue([
      {
        id: "chunk-1",
        documentId: "doc-1",
        chunkIndex: 0,
        headingPath: "Orders > Order Status",
        content: "Order status transitions are documented here.",
        tokenCount: 8,
        embedding: [],
        documentTitle: "Orders",
        sourceUrl: "https://developers.vtex.com/docs/orders",
        similarity: 0.88,
      },
    ]);
    invokeMock.mockResolvedValue({
      content: "Order status transitions work as follows [Source 1].",
    });

    const res = await request(app)
      .post("/chat")
      .send({ question: "How do order statuses transition?" });

    expect(res.status).toBe(200);
    expect(res.body.sources).toEqual([
      {
        title: "Orders",
        headingPath: "Orders > Order Status",
        url: "https://developers.vtex.com/docs/orders",
      },
    ]);
  });
});
