import { describe, it, expect } from "vitest";
import { buildMessages, SYSTEM_PROMPT } from "../../src/generation/promptBuilder.js";
import type { RetrievedChunk } from "../../src/types/index.js";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: "id",
    documentId: "doc",
    chunkIndex: 0,
    headingPath: "Checkout > Shipping Policies",
    content: "Shipping policies are configured in the Checkout admin panel.",
    tokenCount: 10,
    embedding: [],
    documentTitle: "Checkout",
    sourceUrl: "https://developers.vtex.com/docs/checkout",
    similarity: 0.9,
    ...overrides,
  };
}

describe("buildMessages / SYSTEM_PROMPT", () => {
  it("instructs the model to ground answers and decline when unsupported", () => {
    expect(SYSTEM_PROMPT).toMatch(/answer only using the passages/i);
    expect(SYSTEM_PROMPT).toMatch(/does not contain the answer/i);
  });

  it("instructs the model to label distinct interpretations for ambiguous questions (FR-006a)", () => {
    expect(SYSTEM_PROMPT).toMatch(/distinct.*interpretations/i);
    expect(SYSTEM_PROMPT).toMatch(/top 3/i);
  });

  it("labels each passage with its source and includes the question", () => {
    const messages = buildMessages("How do I configure a shipping policy?", [chunk()]);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("user");
    expect(messages[1]?.content).toContain("How do I configure a shipping policy?");
    expect(messages[1]?.content).toContain("Checkout > Shipping Policies");
  });
});
