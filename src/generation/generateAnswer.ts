import { openai, callOpenAi } from "../config/clients.js";
import { config } from "../config/index.js";
import { buildMessages } from "./promptBuilder.js";
import { toSourceRefs } from "./sourceMapper.js";
import type { Answer, RetrievedChunk } from "../types/index.js";

export const DECLINE_MESSAGE =
  "I couldn't find information about this in the VTEX documentation I have access to.";

export async function generateAnswer(
  question: string,
  passages: RetrievedChunk[],
): Promise<Answer> {
  if (passages.length === 0) {
    return { text: DECLINE_MESSAGE, grounded: false, sources: [] };
  }

  const messages = buildMessages(question, passages);
  const completion = await callOpenAi("chat.completions.create", () =>
    openai.chat.completions.create({
      model: config.generationModel,
      messages,
    }),
  );

  const text = completion.choices[0]?.message.content?.trim() ?? DECLINE_MESSAGE;

  return {
    text,
    grounded: true,
    sources: toSourceRefs(passages),
  };
}
