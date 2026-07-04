import type { RetrievedChunk } from "../types/index.js";

export const SYSTEM_PROMPT = `You are a documentation assistant for the VTEX platform.
Answer only using the passages provided in the user message. Cite which passage(s)
support each part of your answer by referencing their labeled source.
If the passages do not support an answer to the question, say explicitly that the
documentation does not contain the answer instead of guessing or using outside knowledge.
If the question matches passages from multiple distinct, unrelated sections (an ambiguous
term or topic), address up to the top 3 distinct interpretations you find as separately
labeled parts of your answer, each citing its own source, rather than picking one silently.`;

function formatPassage(chunk: RetrievedChunk, index: number): string {
  return `[Source ${index + 1}: ${chunk.documentTitle} > ${chunk.headingPath}]\n${chunk.content}`;
}

export interface PromptMessage {
  role: "system" | "user";
  content: string;
}

export function buildMessages(question: string, passages: RetrievedChunk[]): PromptMessage[] {
  const passagesBlock = passages.map(formatPassage).join("\n\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Question: ${question}\n\nPassages:\n${passagesBlock}`,
    },
  ];
}
