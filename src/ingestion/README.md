# Ingestion (out of scope for this session)

`fetch.ts` (VTEX docs fetch/parse), `chunk.ts` (heading-based chunking), `embed.ts`
(embedding + upsert), and `run.ts` (CLI entrypoint) are intentionally not implemented
here — VTEX-specific scraping is being handled in a separate project.

Retrieval, generation, and the API assume the `documents`/`chunks` tables (schema in
`src/db/migrations/001_init.sql`) are already populated by that separate ingestion
pipeline. To exercise the rest of this project locally without it, insert rows into
`documents`/`chunks` manually or via a throwaway script matching that schema.
