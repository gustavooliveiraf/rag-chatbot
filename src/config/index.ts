import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return parsed;
}

export const config = {
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  databaseUrl: requireEnv("DATABASE_URL"),
  port: numberEnv("PORT", 3000),
  generationModel: process.env.GENERATION_MODEL ?? "gpt-5-mini",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  retrievalTopK: numberEnv("RETRIEVAL_TOP_K", 5),
  retrievalSimilarityThreshold: numberEnv("RETRIEVAL_SIMILARITY_THRESHOLD", 0.75),
};
