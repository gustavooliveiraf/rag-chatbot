# Ingestion cron job

Standalone script (run via `npm run ingest`, `tsx cron/run.ts`) that populates the
`documents`/`chunks` tables. It is intentionally separate from the Express app in
`src/api/` — it runs as its own process, on its own schedule, and never runs
inside the request path.

## Design

`ContentProvider` (`contentProvider.ts`) is the only abstraction the pipeline
depends on:

```ts
interface ContentProvider {
  listDocuments(): Promise<DocumentReference[]>;
  getDocument(path: string): Promise<string>;
}
```

`GitHubRawProvider` (`providers/githubRawProvider.ts`) is the only implementation
today. It reads `config/sources.json` (`{ repository, branch, documents }`) and
fetches each configured path from
`https://raw.githubusercontent.com/{repository}/{branch}/{path}` — plain Markdown
files, not a git clone and not HTML scraping of the rendered site.

Because chunking/embedding/upsert (`chunk.ts`, `embed.ts`) only depend on
`ContentProvider`, swapping the source later — a `LocalFileProvider` for
on-disk Markdown, an `S3Provider`, or a provider backed by the GitHub API instead
of raw URLs — requires no change to the rest of the pipeline.

## Behavior

- **Chunking** (`chunk.ts`): splits Markdown by H2/H3 headings into
  `heading_path`-tagged sections (e.g. `"Catalog > SKUs"`), targeting
  ~300-500 tokens per chunk with ~50-token overlap for oversized sections;
  falls back to fixed-size windows for headingless content. Title comes from
  YAML frontmatter `title:`, else the first `# H1`, else the filename.
- **Idempotency** (`embed.ts`): each document's raw content is hashed
  (`documents.content_hash`). Unchanged documents are skipped entirely (no
  OpenAI calls); changed documents have their existing chunks deleted and
  replaced inside a single transaction.
- **Failure isolation** (`run.ts`): a failure fetching or embedding one
  document is logged and does not stop the rest of the run; the process exits
  non-zero if any document failed.

## Running

```bash
npm run ingest
```

Requires `OPENAI_API_KEY` and `DATABASE_URL` (same `.env` as the Express app).

## Scheduling (not yet implemented)

This is currently triggered manually. To run it periodically, point an OS
scheduler (cron, Windows Task Scheduler) or a tool like `node-cron` at
`npm run ingest` — no code change needed, since `run.ts` is already a
side-effect-free-to-invoke, idempotent entrypoint.
