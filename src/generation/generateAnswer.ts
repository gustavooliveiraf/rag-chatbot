import { ChatOpenAI } from "@langchain/openai";
import { callOpenAi } from "../config/clients.js";
import { config } from "../config/index.js";
import { buildPrompt } from "./promptBuilder.js";
import { toSourceRefs } from "./sourceMapper.js";
import type { Answer, RetrievedChunk } from "../types/index.js";

export const DECLINE_MESSAGE =
  "I couldn't find information about this in the VTEX documentation I have access to.";

const chatModel = new ChatOpenAI({
  apiKey: config.openaiApiKey,
  model: config.generationModel,
  maxRetries: 0,
});

export async function generateAnswer(
  question: string,
  passages: RetrievedChunk[],
): Promise<Answer> {
  if (passages.length === 0) {
    return { text: DECLINE_MESSAGE, grounded: false, sources: [] };
  }

  const prompt = buildPrompt(question, passages);
  const response = await callOpenAi("chat.completions.create", () =>
    prompt.pipe(chatModel).invoke({}),
  );

  const text = (response.content as string)?.trim() || DECLINE_MESSAGE;

  return {
    text,
    grounded: true,
    sources: toSourceRefs(passages),
  };
}
