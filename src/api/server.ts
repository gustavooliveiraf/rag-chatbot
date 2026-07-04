import express from "express";
import { config } from "../config/index.js";
import { logger } from "../observability/logger.js";
import { healthRouter } from "./routes/health.js";
import { chatRouter } from "./routes/chat.js";
import { ExternalApiError } from "../config/clients.js";
import type { ErrorResponse } from "../types/index.js";

export const app = express();

app.use(express.json());
app.use(healthRouter);
app.use(chatRouter);

// Centralized error handler (FR-012): any embedding/generation failure that
// bubbles up as an ExternalApiError becomes an explicit 500, never a fabricated
// or partial answer. No automatic retries are performed.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message =
      err instanceof ExternalApiError
        ? "The assistant is temporarily unavailable. Please try again."
        : "Unexpected server error.";

    logger.error("unhandled_request_error", {
      error: err instanceof Error ? err.message : String(err),
    });

    const body: ErrorResponse = { error: message };
    res.status(500).json(body);
  },
);

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    logger.info("server_listening", { port: config.port });
  });
}
