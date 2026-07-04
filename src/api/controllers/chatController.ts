import type { NextFunction, Request, Response } from "express";
import { searchChunks } from "../../retrieval/search.js";
import { selectPassages } from "../../retrieval/selectPassages.js";
import { generateAnswer } from "../../generation/generateAnswer.js";
import { recordInteraction } from "../../observability/interactions.js";
import type { ChatRequest, ChatResponse, ErrorResponse } from "../../types/index.js";

export async function postChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  const body = req.body as Partial<ChatRequest>;
  const question = body.question;

  if (typeof question !== "string" || question.trim().length === 0) {
    const errorBody: ErrorResponse = { error: "`question` is required and must be a non-empty string." };
    res.status(400).json(errorBody);
    return;
  }

  try {
    const retrieved = await searchChunks(question);
    const passages = selectPassages(retrieved);
    const answer = await generateAnswer(question, passages);

    await recordInteraction({
      question,
      retrievedChunkIds: passages.map((p) => p.id),
      answer: answer.text,
      grounded: answer.grounded,
    });

    const responseBody: ChatResponse = {
      answer: answer.text,
      grounded: answer.grounded,
      sources: answer.sources,
    };
    res.status(200).json(responseBody);
  } catch (err) {
    await recordInteraction({
      question,
      retrievedChunkIds: [],
      answer: null,
      grounded: false,
      error: err instanceof Error ? err.message : String(err),
    });
    next(err);
  }
}
