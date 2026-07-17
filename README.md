# VTEX Documentation RAG Chatbot

An educational Retrieval-Augmented Generation (RAG) chatbot that answers questions
about the VTEX platform strictly from ingested official VTEX documentation, with
every pipeline stage (retrieval, prompt construction, generation, evaluation,
observability) hand-written instead of delegated to an AI framework.

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

> **Ingestion**: `npm run ingest` populates the `documents`/`chunks` tables by
> fetching configured Markdown files from the public
> [`vtexdocs/dev-portal-content`](https://github.com/vtexdocs/dev-portal-content)
> GitHub repo — see [`cron/README.md`](./cron/README.md) for the design (a
> standalone, source-agnostic pipeline behind a `ContentProvider` abstraction)
> and [`cron/config/sources.json`](./cron/config/sources.json) to change which
> documents are ingested.

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
