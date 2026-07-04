# VTEX Documentation RAG Chatbot

An educational Retrieval-Augmented Generation (RAG) chatbot that answers questions
about the VTEX platform strictly from ingested official VTEX documentation, with
every pipeline stage (retrieval, prompt construction, generation, evaluation,
observability) hand-written instead of delegated to an AI framework. See
[`specs/001-vtex-rag-chatbot/`](./specs/001-vtex-rag-chatbot/) for the full spec,
plan, and task breakdown.

## Prerequisites

- Node.js 20 LTS, npm
- Docker (for local Postgres + pgvector)
- An `OPENAI_API_KEY` (used for both `gpt-5-mini` generation and
  `text-embedding-3-small` embeddings)

## Setup

```bash
cp .env.example .env   # fill in OPENAI_API_KEY
docker compose up -d
npm install
npm run db:migrate
```

> **Ingestion**: `npm run ingest` populates the `documents`/`chunks` tables from the
> VTEX documentation. That scraping/ingestion pipeline is being built in a separate
> project — see [`src/ingestion/README.md`](./src/ingestion/README.md). Until it's
> wired in, populate those tables yourself (matching the schema in
> `src/db/migrations/001_init.sql`) to exercise retrieval and generation locally.

## Run

```bash
npm run dev
```

`GET /health` returns `{"status":"ok"}`. See
[`specs/001-vtex-rag-chatbot/quickstart.md`](./specs/001-vtex-rag-chatbot/quickstart.md)
for `curl` examples covering the grounded-answer, honest-decline, ambiguous-question,
and external-API-failure scenarios.

## Test & evaluate

```bash
npm test           # unit + integration tests (vitest)
npm run evaluate    # reference question set (evaluation/fixtures/cases.json)
```
