# Quickstart: VTEX Documentation RAG Chatbot

Validates the feature end-to-end per the acceptance scenarios in
[spec.md](./spec.md). Schema details: [data-model.md](./data-model.md). API shape:
[contracts/openapi.yaml](./contracts/openapi.yaml).

## Prerequisites

- Node.js 20 LTS, npm
- Docker (for local Postgres + pgvector)
- An `OPENAI_API_KEY` (used for both `gpt-5-mini` generation and `text-embedding-3-small` embeddings)

## Setup

1. Copy `.env.example` to `.env` and fill in `OPENAI_API_KEY` and `DATABASE_URL`
   (defaults point at the Docker Compose Postgres instance).
2. Start Postgres with pgvector enabled:
   ```
   docker compose up -d
   ```
3. Install dependencies and apply the schema (creates `documents`, `chunks`,
   `interactions` per data-model.md):
   ```
   npm install
   npm run db:migrate
   ```
4. Run ingestion for the seed VTEX doc set (research.md §1):
   ```
   npm run ingest
   ```
   Expected: console output listing each ingested page/chunk count, ending with a
   total chunk count > 0.
5. Start the API:
   ```
   npm run dev
   ```
   Expected: process logs that it is listening, and `GET /health` returns
   `{"status":"ok"}`.

## Validate User Story 1 — grounded answer (P1)

```
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"How do I configure a shipping policy?"}'
```

Expected: HTTP 200, `grounded: true`, `answer` describing shipping policy
configuration, `sources` non-empty and referencing a real ingested VTEX page.

## Validate User Story 2 — honest decline (P1)

```
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the capital of France?"}'
```

Expected: HTTP 200, `grounded: false`, `answer` explicitly states the documentation
does not cover this, `sources` is an empty array.

## Validate User Story 3 — source traceability (P2)

Using the User Story 1 response above: open the `url` from the first entry in
`sources` and confirm the page actually discusses the `headingPath` section named
in the response, and that it supports the claims in `answer`.

## Validate ambiguous-question handling (FR-006a)

```
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"<a term documented in 2+ distinct sections of your ingested seed set>"}'
```

Pick a term from your actual seed list (research.md §1) known to appear in more than
one module; `What is a SKU?` is illustrative, not guaranteed to be ambiguous in
whatever subset you ingested.

Expected: HTTP 200, `grounded: true`, `sources` contains entries from more than one
distinct `headingPath`/module (up to 3 interpretations per FR-006a) if the term is
documented differently in multiple sections, and `answer` clearly labels each
interpretation with the section it came from rather than blending them into one claim.

## Validate external API failure handling (FR-012)

With `OPENAI_API_KEY` temporarily set to an invalid value, restart the API and repeat
the User Story 1 request.

Expected: HTTP 500, `ErrorResponse` body (`{"error": "..."}`), no fabricated or
partial `answer`, and a corresponding row in `interactions` with `error` populated
and `answer` null.

## Validate observability (FR-010)

```
psql "$DATABASE_URL" -c "select question, grounded, retrieved_chunk_ids from interactions order by created_at desc limit 2;"
```

Expected: one row for each of the two requests above, with `grounded` matching what
each response returned.

## Validate evaluation (FR-011 / SC-002, SC-003, SC-005)

```
npm run evaluate
```

Expected: a per-case pass/fail report followed by aggregate rates for (a) correct
decline rate on unanswerable cases and (b) source-match rate on answerable cases,
re-runnable at any time with the same fixtures for the same results (module network/
model nondeterminism).
