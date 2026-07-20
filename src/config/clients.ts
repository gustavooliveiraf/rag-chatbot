/**
 * Marks a failure as coming from an upstream OpenAI call (embedding or generation)
 * so callers can distinguish it from application errors and satisfy FR-012 (explicit
 * error response, no fabricated answer, no automatic retries).
 */
export class ExternalApiError extends Error {
  constructor(
    message: string,
    readonly cause: unknown,
  ) {
    super(message);
    this.name = "ExternalApiError";
  }
}

export async function callOpenAi<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new ExternalApiError(`OpenAI ${operation} call failed`, err);
  }
}
