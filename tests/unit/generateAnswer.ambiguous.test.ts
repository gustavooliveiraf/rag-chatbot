import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RetrievedChunk } from "../../src/types/index.js";

const { buildPromptMock, invokeMock } = vi.hoisted(() => ({
  buildPromptMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("../../src/generation/promptBuilder.js", () => ({
  buildPrompt: buildPromptMock,
}));

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(),
}));

vi.mock("../../src/config/clients.js", () => ({
  callOpenAi: async (_op: string, fn: () => Promise<unknown>) => fn(),
}));

buildPromptMock.mockReturnValue({ pipe: () => ({ invoke: invokeMock }) });

const { generateAnswer } = await import("../../src/generation/generateAnswer.js");

function chunk(headingPath: string, sourceUrl: string): RetrievedChunk {
  return {
    id: headingPath,
    documentId: "doc",
    chunkIndex: 0,
    headingPath,
    content: `Content for ${headingPath}`,
    tokenCount: 10,
    embedding: [],
    documentTitle: "VTEX Docs",
    sourceUrl,
    similarity: 0.9,
  };
}

describe("generateAnswer - ambiguous questions (FR-006a)", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    buildPromptMock.mockClear();
  });

  it("forwards passages from multiple distinct sections and returns a multi-source grounded answer", async () => {
    const passages = [
      chunk("Catalog > SKU", "https://developers.vtex.com/docs/catalog"),
      chunk("Logistics > SKU Handling", "https://developers.vtex.com/docs/logistics"),
    ];
    invokeMock.mockResolvedValue({
      content:
        "In Catalog, a SKU is a sellable unit [Source 1]. In Logistics, SKU refers to handling units [Source 2].",
    });

    const answer = await generateAnswer("What is a SKU?", passages);

    expect(answer.grounded).toBe(true);
    expect(answer.sources).toHaveLength(2);
    expect(answer.sources.map((s) => s.headingPath)).toEqual(
      expect.arrayContaining(["Catalog > SKU", "Logistics > SKU Handling"]),
    );

    expect(buildPromptMock).toHaveBeenCalledWith("What is a SKU?", passages);
  });
});
