import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      OPENAI_API_KEY: "test-key",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
    },
  },
});
