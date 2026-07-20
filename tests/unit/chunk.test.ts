import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../../cron/chunk.js";

const paragraph = (label: string, repeats: number) =>
  Array.from({ length: repeats }, (_, i) => `${label} sentence ${i} filler content to pad this out.`).join(" ");

describe("parseMarkdown (characterization)", () => {
  it("keeps a short section as a single chunk", async () => {
    const raw = `---\ntitle: Short Doc\n---\n\n## Overview\n\nJust a short paragraph, well under the target token budget.\n`;
    const parsed = await parseMarkdown(raw, "short.md");
    expect(parsed.title).toBe("Short Doc");
    expect(parsed.chunks).toHaveLength(1);
    expect(parsed.chunks[0]?.headingPath).toBe("Overview");
  });

  it("windows an oversized section built from several paragraphs with overlap", async () => {
    const p1 = paragraph("Alpha", 30);
    const p2 = paragraph("Bravo", 30);
    const p3 = paragraph("Charlie", 30);
    const raw = `---\ntitle: Long Doc\n---\n\n## Details\n\n${p1}\n\n${p2}\n\n${p3}\n`;
    const parsed = await parseMarkdown(raw, "long.md");

    expect(parsed.chunks.length).toBeGreaterThan(1);
    for (const chunk of parsed.chunks) {
      expect(chunk.headingPath).toBe("Details");
    }
    // consecutive windows should share some overlapping text
    const first = parsed.chunks[0]?.content ?? "";
    const second = parsed.chunks[1]?.content ?? "";
    const tail = first.slice(-100);
    expect(second.includes(tail.slice(-40))).toBe(true);
  });

  it("hard-wraps a single paragraph that alone exceeds the target budget", async () => {
    const huge = paragraph("Delta", 400); // single paragraph, no blank lines, well over 300 tokens
    const raw = `---\ntitle: Huge Paragraph Doc\n---\n\n## Big\n\n${huge}\n`;
    const parsed = await parseMarkdown(raw, "huge.md");

    expect(parsed.chunks.length).toBeGreaterThan(1);
    for (const chunk of parsed.chunks) {
      expect(chunk.headingPath).toBe("Big");
      expect(chunk.content.length).toBeGreaterThan(0);
    }
    // reassembled content should cover the original text (allowing for overlap)
    const totalContentLength = parsed.chunks.reduce((sum, c) => sum + c.content.length, 0);
    expect(totalContentLength).toBeGreaterThanOrEqual(huge.length);
  });
});
