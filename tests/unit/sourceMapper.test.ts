import { describe, it, expect } from "vitest";
import { toSourceRefs } from "../../src/generation/sourceMapper.js";
import type { RetrievedChunk } from "../../src/types/index.js";

function chunk(headingPath: string, sourceUrl: string, title = "Doc"): RetrievedChunk {
  return {
    id: headingPath,
    documentId: "doc",
    chunkIndex: 0,
    headingPath,
    content: "content",
    tokenCount: 10,
    embedding: [],
    documentTitle: title,
    sourceUrl,
    similarity: 0.9,
  };
}

describe("toSourceRefs", () => {
  it("maps a chunk to title/headingPath/url", () => {
    const refs = toSourceRefs([chunk("Checkout > Shipping", "https://developers.vtex.com/docs/checkout")]);
    expect(refs).toEqual([
      { title: "Doc", headingPath: "Checkout > Shipping", url: "https://developers.vtex.com/docs/checkout" },
    ]);
  });

  it("dedupes chunks from the same document section", () => {
    const refs = toSourceRefs([
      chunk("Checkout > Shipping", "https://developers.vtex.com/docs/checkout"),
      chunk("Checkout > Shipping", "https://developers.vtex.com/docs/checkout"),
    ]);
    expect(refs).toHaveLength(1);
  });

  it("keeps distinct sections separate", () => {
    const refs = toSourceRefs([
      chunk("Catalog > SKU", "https://developers.vtex.com/docs/catalog"),
      chunk("Logistics > SKU Handling", "https://developers.vtex.com/docs/logistics"),
    ]);
    expect(refs).toHaveLength(2);
  });
});
