import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const { searchChunksMock, recordInteractionMock } = vi.hoisted(() => ({
  searchChunksMock: vi.fn(),
  recordInteractionMock: vi.fn(),
}));

vi.mock("../../src/retrieval/search.js", () => ({ searchChunks: searchChunksMock }));
vi.mock("../../src/observability/interactions.js", () => ({
  recordInteraction: recordInteractionMock,
}));

const { ExternalApiError } = await import("../../src/config/clients.js");
const { app } = await import("../../src/api/server.js");

describe("POST /chat - external API failure (FR-012)", () => {
  beforeEach(() => {
    searchChunksMock.mockReset();
    recordInteractionMock.mockReset();
  });

  it("returns 500 with an explicit error, no fabricated answer, and logs the failure", async () => {
    searchChunksMock.mockRejectedValue(new ExternalApiError("OpenAI embeddings call failed", new Error("boom")));

    const res = await request(app)
      .post("/chat")
      .send({ question: "How do I configure a shipping policy?" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
    expect(res.body.answer).toBeUndefined();
    expect(recordInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({ grounded: false, answer: null, error: expect.any(String) }),
    );
  });
});
