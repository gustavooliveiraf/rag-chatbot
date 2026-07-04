import { pool } from "../db/pool.js";
import { logger } from "./logger.js";

interface RecordInteractionInput {
  question: string;
  retrievedChunkIds: string[];
  answer: string | null;
  grounded: boolean;
  error?: string;
}

export async function recordInteraction(input: RecordInteractionInput): Promise<void> {
  await pool.query(
    `INSERT INTO interactions (question, retrieved_chunk_ids, answer, grounded, error)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.question, input.retrievedChunkIds, input.answer, input.grounded, input.error ?? null],
  );

  logger.info("chat_interaction", {
    question: input.question,
    retrievedChunkIds: input.retrievedChunkIds,
    grounded: input.grounded,
    error: input.error,
  });
}
