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

describe("POST /chat - golden path (User Story 1)", () => {
  beforeEach(() => {
    searchChunksMock.mockReset();
    recordInteractionMock.mockReset();
    chatCompletionsCreateMock.mockReset();
  });

  it("returns a grounded answer with non-empty sources for a documented question", async () => {
    searchChunksMock.mockResolvedValue([
      {
        id: "chunk-1",
        documentId: "doc-1",
        chunkIndex: 0,
        headingPath: "Checkout > Shipping Policies",
        content: "Shipping policies are configured in the Checkout admin panel.",
        tokenCount: 10,
        embedding: [],
        documentTitle: "Checkout",
        sourceUrl: "https://developers.vtex.com/docs/checkout",
        similarity: 0.92,
      },
    ]);
    chatCompletionsCreateMock.mockResolvedValue({
      choices: [{ message: { content: "Configure it in the Checkout admin panel [Source 1]." } }],
    });

    const start = Date.now();
    const res = await request(app)
      .post("/chat")
      .send({ question: "How do I configure a shipping policy?" });
    const elapsedMs = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.grounded).toBe(true);
    expect(res.body.sources).toHaveLength(1);
    expect(res.body.sources[0].headingPath).toBe("Checkout > Shipping Policies");
    expect(res.body.answer).toContain("Checkout admin panel");
    expect(recordInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({ grounded: true }),
    );

    // SC-001: complete answer in under 10s (trivially true here since OpenAI/DB
    // calls are mocked, but guards against accidentally-added artificial delay).
    expect(elapsedMs).toBeLessThan(10_000);

    // FR-007/FR-008/FR-009 regression guard: no session cookie, single JSON body
    // (not chunked/streamed).
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(res.headers["transfer-encoding"]).toBeUndefined();
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});
