import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db/pool.js";
import { GitHubRawProvider, type GitHubSourcesConfig } from "./providers/githubRawProvider.js";
import { ingestDocument } from "./embed.js";

const configPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "config",
  "sources.json",
);

async function main() {
  const raw = await readFile(configPath, "utf8");
  const sourcesConfig: GitHubSourcesConfig = JSON.parse(raw);
  const provider = new GitHubRawProvider(sourcesConfig);
  const documents = await provider.listDocuments();

  let failures = 0;
  try {
    for (const doc of documents) {
      try {
        const rawContent = await provider.getDocument(doc.path);
        const status = await ingestDocument(doc, rawContent);
        console.log(`[${status}] ${doc.path}`);
      } catch (err) {
        failures += 1;
        console.error(`[failed] ${doc.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    await pool.end();
  }

  console.log(`Ingestion complete: ${documents.length - failures}/${documents.length} succeeded.`);
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Ingestion run failed:", err);
  process.exitCode = 1;
});
