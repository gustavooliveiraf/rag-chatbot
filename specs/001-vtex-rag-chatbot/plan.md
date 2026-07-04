# Implementation Plan: VTEX Documentation RAG Chatbot

**Branch**: `001-vtex-rag-chatbot` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-vtex-rag-chatbot/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

A single-user, no-auth HTTP API that answers natural-language questions about the VTEX
platform strictly from ingested official VTEX documentation. The system embeds a
question, retrieves the closest documentation passages from a Postgres/pgvector store,
and asks OpenAI's `gpt-5-mini` to answer using only those passages, always attaching source references
and explicitly declining when no passage clears a fixed similarity threshold. Questions that match
multiple unrelated documentation sections are answered as separately labeled interpretations rather
than silently picking one; external API failures surface as an explicit error rather than a
non-grounded fallback. Every architectural
component (ingestion, chunking, embedding calls, vector search, prompt construction,
answer assembly, logging, evaluation) is hand-written rather than delegated to an AI
orchestration framework, per the project's educational goal, and is organized so a later
iteration can add memory, tool calling, and MCP without a rewrite.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS

**Primary Dependencies**: Express (HTTP layer), `pg` (PostgreSQL client), `openai` (both
generation, via `gpt-5-mini`, and embeddings, via `text-embedding-3-small`), `dotenv` (config)

**Storage**: PostgreSQL with the `pgvector` extension (documents, chunks + embeddings,
interaction logs all live here; no separate document store or cache layer for v1)

**Testing**: Vitest for unit and integration tests; a small standalone script for the
evaluation-case runner described in FR-011 (not a general test framework concern)

**Target Platform**: Linux-compatible server process (runs locally via Docker Compose for
this learning project; no cloud deployment target specified)

**Project Type**: Single backend web service — HTTP API only, no frontend (client is
curl/Postman per the user's stated interface choice)

**Performance Goals**: Meet SC-001 (complete answer in under 10s per request) under
single-user, sequential-request load; no concurrency target for v1

**Constraints**: No AI orchestration framework (e.g., LangChain, LlamaIndex) may be used
for retrieval, prompt construction, or orchestration — every step is implemented directly
against the OpenAI SDK and `pg`, per the project's educational goal and constitution
Principle IV (Simplicity/YAGNI: no extra abstraction layers beyond what a single-pass
retrieve-then-generate pipeline needs)

**Scale/Scope**: A curated subset of official VTEX documentation (on the order of
hundreds to low thousands of chunks) ingested for v1; single concurrent user; no rate
limiting or multi-tenant concerns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Retrieval Grounding (NON-NEGOTIABLE) | Pipeline is strictly retrieve-then-generate; the `gpt-5-mini` prompt (Phase 1) instructs the model to answer only from supplied passages and to say so explicitly when no passage clears the fixed similarity threshold (FR-003, FR-004); on external API failure the system returns an explicit error rather than a non-grounded fallback (FR-012) | PASS |
| II. Source Attribution | Every chunk carries its source document/section reference through retrieval into the API response (FR-005); contract in Phase 1 makes `sources` a required response field whenever an answer is grounded | PASS |
| III. Test-First for Retrieval & Generation | Vitest suite will cover the golden-path (relevant chunks retrieved and used) and no-context path (no relevant chunks → explicit decline) before those code paths are marked done, per Development Workflow | PASS (planned; enforced at task/implementation time) |
| IV. Simplicity (YAGNI) | Single vector store (pgvector in the same Postgres instance), single-pass retrieval, no re-ranking/multi-hop/agentic loop for v1; hand-written code instead of a framework is a deliberate educational trade-off, not added incidental complexity — see note below | PASS |
| V. Basic Observability | Every request logged (question, retrieved chunk ids, answer, errors) to an `interactions` table (FR-010); satisfies the constitution's minimum logging bar | PASS |

Note on Principle IV: avoiding LangChain/LlamaIndex is a scope decision from the user, not
a violation of Simplicity — the constitution's concern is unnecessary *architectural*
complexity (extra retrieval hops, extra stores, agentic loops), not which library performs
a single HTTP call to an embedding or completion API. No entry is needed in Complexity
Tracking because no principle is being violated.

## Project Structure

### Documentation (this feature)

```text
specs/001-vtex-rag-chatbot/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── config/            # env loading (DB url, OPENAI_API_KEY, etc.)
├── db/                # pg pool, schema migrations, pgvector setup
├── ingestion/         # VTEX docs fetch/parse, chunking, embedding + upsert pipeline
├── retrieval/         # query embedding, pgvector similarity search, passage selection
├── generation/        # prompt construction, gpt-5-mini call, answer assembly
├── observability/     # structured logging, interaction record persistence
├── evaluation/         # eval-case runner (FR-011), fixtures loader
├── api/
│   ├── routes/        # POST /chat, GET /health route definitions
│   ├── controllers/   # request/response handling for each route, calls into retrieval/generation
│   └── server.ts       # Express app wiring
└── types/             # shared TypeScript interfaces (Chunk, Answer, Source, etc.)

tests/
├── unit/              # chunking, prompt construction, ranking/selection logic
├── integration/        # retrieval pipeline + API endpoint tests (contract-level)
└── evaluation/          # fixtures + assertions for the golden question/answer set

evaluation/
└── fixtures/           # versioned JSON evaluation cases (question, expected source refs)
```

**Structure Decision**: Single backend project (no frontend), matching "Option 1" scaled
to this feature's pipeline stages instead of generic `models/services/lib`. Each pipeline
stage (`ingestion`, `retrieval`, `generation`, `observability`, `evaluation`) is its own
module so a future agent iteration (memory, tool calling, MCP) can be added as new modules
alongside these without restructuring the retrieval/generation core.

## Complexity Tracking

*No constitution violations were identified in the Constitution Check above; this section
intentionally has no entries.*

## Post-Design Constitution Re-Check

*GATE: Re-checked after Phase 1 design (data-model.md, contracts/openapi.yaml, quickstart.md).*

Design artifacts confirm rather than contradict the pre-research gate: the `chunks`
table (data-model.md) carries `heading_path`/document reference through to the
`SourceRef` schema in `contracts/openapi.yaml`, `ChatResponse.grounded` makes the
honest-decline path a first-class, always-present field (not an afterthought), and
`interactions` gives Principle V's logging requirement a concrete home. No new
entities, endpoints, or dependencies were introduced during Phase 1 that weren't
already covered by the pre-design check. All five principles remain PASS; no
Complexity Tracking entries are required.

**Re-check after 2026-07-04 clarifications**: `/speckit-clarify` added FR-006a
(ambiguous questions), the similarity-threshold rule in FR-004, and FR-012
(external API failure → explicit error). None require new entities or endpoints:
`sources` (already an array in `ChatResponse`) accommodates multiple labeled
interpretations, and the `500`/`ErrorResponse` path already in
`contracts/openapi.yaml` and the `error` column already in `interactions`
(data-model.md) already cover FR-012. research.md §4, §5, and the new §10 record
the corresponding decisions. All five principles remain PASS.
