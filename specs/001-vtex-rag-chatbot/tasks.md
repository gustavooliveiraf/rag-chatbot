---

description: "Task list template for feature implementation"
---

# Tasks: VTEX Documentation RAG Chatbot

**Input**: Design documents from `specs/001-vtex-rag-chatbot/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Included and REQUIRED (not optional) for retrieval and generation code paths. Constitution
Principle III ("Test-First for Retrieval & Generation") and the Development Workflow section mandate
automated coverage of the golden-path and no-context path before those paths are done; the plan's
Constitution Check already commits to this. Test tasks below must be written and confirmed failing
before their corresponding implementation task. This revision also adds coverage for the three
clarifications recorded in spec.md's Clarifications (2026-07-04): ambiguous-question handling
(FR-006a), the fixed similarity-score decline threshold (FR-004), and external API failure handling
(FR-012).

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency on a sibling task in the same block)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to the repository root, per plan.md's Project Structure

## Path Conventions

Single backend project (no frontend) per plan.md: `src/`, `tests/`, `evaluation/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directory structure per plan.md: `src/{config,db,ingestion,retrieval,generation,observability,evaluation,types}`, `src/api/{routes,controllers}`, `tests/{unit,integration,evaluation}`, `evaluation/fixtures`
- [X] T002 Initialize Node.js + TypeScript project in repository root: `package.json`, `tsconfig.json`, and dependencies (`express`, `pg`, `openai`, `dotenv`, dev deps `typescript`, `vitest`, `tsx`, `@types/express`, `@types/pg`) (depends on T001)
- [X] T003 [P] Configure ESLint + Prettier in `.eslintrc.cjs` and `.prettierrc` (depends on T002)
- [X] T004 [P] Create `docker-compose.yml` providing a local PostgreSQL instance with the `pgvector` extension enabled (depends on T001)
- [X] T005 [P] Create `.env.example` with `OPENAI_API_KEY`, `DATABASE_URL`, `PORT`, `RETRIEVAL_SIMILARITY_THRESHOLD` (fixed decline threshold, FR-004) (depends on T001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Create DB schema migration for `documents`, `chunks` (`vector(1536)` column + HNSW cosine index), and `interactions` tables per data-model.md in `src/db/migrations/001_init.sql` (depends on T002, T004)
- [X] T007 [P] Implement PostgreSQL connection pool in `src/db/pool.ts` (depends on T002)
- [X] T008 [P] Implement environment config loader (including `RETRIEVAL_SIMILARITY_THRESHOLD`, parsed as a number with a sane default) in `src/config/index.ts` (depends on T002, T005)
- [X] T009 Implement OpenAI SDK client setup (shared by generation and embeddings), wrapping calls so upstream failures/timeouts surface as a distinguishable typed error for callers (supports FR-012) in `src/config/clients.ts` (depends on T008)
- [X] T010 [P] Define shared TypeScript types (`Chunk`, `SourceRef`, `Answer`, `ChatRequest`, `ChatResponse`, `EvaluationCase`) in `src/types/index.ts` per data-model.md and contracts/openapi.yaml (depends on T002)
- [X] T011 [P] Implement structured JSON logger in `src/observability/logger.ts` (depends on T002)
- [X] T012 Implement interaction record persistence (insert into `interactions`, including the `error` column for failed requests) in `src/observability/interactions.ts` (depends on T006, T007, T010)
- [X] T013 Implement Express app scaffold with `GET /health` in `src/api/server.ts` and `src/api/routes/health.ts` (depends on T008)
- [X] T014 [P] Implement `ContentProvider` abstraction + `GitHubRawProvider` (fetches configured Markdown files from `raw.githubusercontent.com`, no HTML scraping) in `cron/contentProvider.ts` / `cron/providers/githubRawProvider.ts` (depends on T002)
- [X] T015 Implement heading-based chunking with overlap fallback in `cron/chunk.ts` (depends on T014)
- [X] T016 Implement chunk embedding (`text-embedding-3-small`) + content-hash-guarded upsert into `chunks`/`documents` in `cron/embed.ts` (depends on T006, T007, T009, T010, T015)
- [X] T017 Implement ingestion entrypoint (`cron/config/sources.json` source list + `npm run ingest` script) in `cron/run.ts` (depends on T016)

**Checkpoint**: Foundation ready. Run `npm run ingest` to populate the corpus before validating any
user story below (per quickstart.md).

---

## Phase 3: User Story 1 - Get a grounded answer to a documented question (Priority: P1) 🎯 MVP

**Goal**: A user asks a question covered by the VTEX documentation and receives an answer whose
claims are all supported by retrieved documentation content (FR-001, FR-002, FR-003), including
questions that match multiple distinct, unrelated sections (FR-006a).

**Independent Test**: Submit a question clearly covered by the ingested documentation via
`POST /chat` and confirm every claim in the response's `answer` is traceable to the retrieved content
(quickstart.md "Validate User Story 1"); submit an ambiguous term matching multiple modules and
confirm each interpretation is separately labeled with its own source (quickstart.md "Validate
ambiguous-question handling").

### Tests for User Story 1 ⚠️

> Write these tests FIRST; confirm they FAIL before implementing the corresponding task below.

- [X] T018 [P] [US1] Unit test for pgvector top-k similarity search / passage selection in `tests/unit/retrieval.test.ts`
- [X] T019 [P] [US1] Unit test for grounding prompt construction (system + passage-labeled user turn) in `tests/unit/promptBuilder.test.ts`
- [X] T020 [P] [US1] Integration test for `POST /chat` golden-path (grounded answer, non-empty sources, response received in under 10s per SC-001, no `Set-Cookie` header and delivered as a single non-chunked JSON body per FR-007/FR-008/FR-009) against the `ChatResponse` contract in `tests/integration/chat.grounded.test.ts`
- [X] T021 [P] [US1] Unit test for multi-interpretation answer assembly: passages from distinct, unrelated `heading_path`s produce separately labeled answer parts, each citing its own source (FR-006a) in `tests/unit/generateAnswer.ambiguous.test.ts`

### Implementation for User Story 1

- [X] T022 [P] [US1] Implement query embedding + pgvector top-k similarity search in `src/retrieval/search.ts` (depends on T009, T010, T007; must pass T018)
- [X] T023 [US1] Implement passage selection/formatting for the prompt in `src/retrieval/selectPassages.ts` (depends on T022)
- [X] T024 [P] [US1] Implement grounding system/user prompt builder, instructing the model to address each distinct interpretation it finds as a separately labeled part when passages span unrelated sections (FR-006a) in `src/generation/promptBuilder.ts` (depends on T010; must pass T019)
- [X] T025 [US1] Implement `gpt-5-mini` call + grounded answer assembly, including multi-interpretation answers (FR-006a) in `src/generation/generateAnswer.ts` (depends on T009, T023, T024; must pass T021)
- [X] T026 [US1] Implement `POST /chat` controller wiring retrieval → generation → interaction logging in `src/api/controllers/chatController.ts` (depends on T023, T025, T012)
- [X] T027 [US1] Register `POST /chat` route and wire into the app in `src/api/routes/chat.ts` / `src/api/server.ts` (depends on T026, T013; must pass T020)

**Checkpoint**: User Story 1 is fully functional and independently testable (assuming ingestion has run).

---

## Phase 4: User Story 2 - Get an honest "not found" instead of a fabricated answer (Priority: P1)

**Goal**: A user asks a question the documentation does not cover and receives an explicit
"not found in the documentation" response instead of a fabricated answer (FR-004), using a fixed,
env-configurable similarity-score threshold to decide when retrieved content is too weak to use.

**Independent Test**: Submit a question with no supporting content in the ingested corpus via
`POST /chat` and confirm the response has `grounded: false`, an explicit decline message, and no
invented facts (quickstart.md "Validate User Story 2").

### Tests for User Story 2 ⚠️

> Write these tests FIRST; confirm they FAIL before implementing the corresponding task below.

- [X] T028 [P] [US2] Unit test for the fixed similarity-score threshold: passages scoring at/above `RETRIEVAL_SIMILARITY_THRESHOLD` are kept, below it are excluded, and an empty result set after filtering is reported as no-context (FR-004) in `tests/unit/retrieval.noContext.test.ts`
- [X] T029 [P] [US2] Integration test for `POST /chat` decline-path (`grounded: false`, empty `sources`) in `tests/integration/chat.declined.test.ts`

### Implementation for User Story 2

- [X] T030 [P] [US2] Add fixed similarity-score threshold filtering (read from `RETRIEVAL_SIMILARITY_THRESHOLD`, research.md §4) and empty-result handling to `src/retrieval/selectPassages.ts` (depends on T023; must pass T028)
- [X] T031 [P] [US2] Extend `promptBuilder` with an explicit decline instruction path in `src/generation/promptBuilder.ts` (depends on T024)
- [X] T032 [US2] Extend `generateAnswer` to produce a `grounded: false` decline response when no passages qualify in `src/generation/generateAnswer.ts` (depends on T025, T030, T031)
- [X] T033 [US2] Update `chatController` to surface `grounded: false` and empty `sources` on decline in `src/api/controllers/chatController.ts` (depends on T026, T032; must pass T029)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Verify where an answer came from (Priority: P2)

**Goal**: A user can see which documentation source(s) an answer was drawn from, and that source
actually supports the answer's claims (FR-005).

**Independent Test**: Submit any in-scope question via `POST /chat` and confirm the response's
`sources` identify real, relevant documentation section(s) (quickstart.md "Validate User Story 3").

### Tests for User Story 3 ⚠️

> Write these tests FIRST; confirm they FAIL before implementing the corresponding task below.

- [X] T034 [P] [US3] Unit test for chunk → `SourceRef` mapping (`title`, `headingPath`, `url`) in `tests/unit/sourceMapper.test.ts`
- [X] T035 [P] [US3] Integration test asserting accurate, non-empty `sources` on grounded responses in `tests/integration/chat.sources.test.ts`

### Implementation for User Story 3

- [X] T036 [US3] Implement chunk → `SourceRef` mapper in `src/generation/sourceMapper.ts` (depends on T010, T023; must pass T034)
- [X] T037 [US3] Wire `sourceMapper` into `generateAnswer` / `chatController` to populate `ChatResponse.sources` in `src/generation/generateAnswer.ts` and `src/api/controllers/chatController.ts` (depends on T025, T026, T036; must pass T035)

**Checkpoint**: All three user stories are independently functional per quickstart.md.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Evaluation harness (FR-011) and hardening that spans multiple user stories

- [X] T038 [P] Create versioned evaluation fixtures (question / `expect_answered` / `expected_source_titles`) per data-model.md in `evaluation/fixtures/cases.json`
- [X] T039 Implement the evaluation-case runner (FR-011, SC-002/SC-003/SC-005) and `npm run evaluate` script in `src/evaluation/runEvaluation.ts` (depends on T038, T027, T033)
- [X] T040 [P] Add request validation + `400` error responses for malformed `/chat` requests in `src/api/controllers/chatController.ts`
- [X] T041 [P] Add centralized Express error-handling middleware in `src/api/server.ts` that returns an explicit `500` `ErrorResponse` (never a fabricated or partial answer) when an embedding/generation call fails or times out, with no automatic retries, and logs the failure via `src/observability/interactions.ts` (FR-012)
- [X] T042 [P] Integration test for the external API failure path: mocked OpenAI embedding/generation failure → `500` `ErrorResponse`, no `answer` content, and an `interactions` row with `error` populated (FR-012) in `tests/integration/chat.apiFailure.test.ts` (depends on T041)
- [ ] T043 Run the full quickstart.md validation end-to-end (including the ambiguous-question and API-failure scenarios) and fix any discrepancies found — **NOT DONE**: requires a live Postgres instance with a real ingested corpus and a real `OPENAI_API_KEY`, neither available in this environment; unit/integration tests above cover the same behavior with mocks
- [X] T044 [P] Write project `README.md` with setup and run instructions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (ingestion must
  also be run once, per the Phase 2 checkpoint, before any story can be demonstrated end-to-end)
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 and independent of each other; US3 (P2) builds on retrieval/generation
    plumbing already present from US1 but is independently testable once US1 exists
  - Can proceed in parallel (if staffed) or sequentially in spec order: US1 → US2 → US3
- **Polish (Phase 6)**: Depends on the user stories it touches (T039 needs US1 + US2 complete; T041/T042
  need the shared OpenAI client wrapper from T009)

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — extends US1's retrieval/prompt/
  controller files but is independently testable via its own decline-path scenario
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) — adds source-mapping on top of US1's
  retrieval output; independently testable via its own source-accuracy scenario

### Within Each User Story

- Tests MUST be written and confirmed failing before their implementation task (Constitution Principle III)
- Retrieval before generation; generation before controller wiring; controller before route registration
- Story complete and checkpointed before moving to the next priority

### Parallel Opportunities

- T003, T004, T005 (Setup) in parallel after T002/T001
- T006, T007, T008, T010, T011, T014 (Foundational) in parallel once their own dependencies are met
- All test tasks within a story phase (e.g., T018-T021) in parallel
- T022 and T024 (US1) in parallel; T030 and T031 (US2) in parallel
- T038, T040, T041, T044 (Polish) in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for pgvector similarity search in tests/unit/retrieval.test.ts"
Task: "Unit test for grounding prompt construction in tests/unit/promptBuilder.test.ts"
Task: "Integration test for POST /chat golden-path in tests/integration/chat.grounded.test.ts"
Task: "Unit test for multi-interpretation answer assembly in tests/unit/generateAnswer.ambiguous.test.ts"

# Then, once tests are failing as expected, launch independent implementation tasks together:
Task: "Implement query embedding + pgvector search in src/retrieval/search.ts"
Task: "Implement grounding prompt builder in src/generation/promptBuilder.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — includes running `npm run ingest`)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md's User Story 1 curl example independently
5. Demo if ready — this is the smallest slice that proves the RAG loop works end to end

### Incremental Delivery

1. Setup + Foundational → foundation ready, corpus ingested
2. Add User Story 1 → validate independently → demo (MVP!)
3. Add User Story 2 → validate independently → demo (trust guarantee complete)
4. Add User Story 3 → validate independently → demo (traceability complete)
5. Add Phase 6 polish (evaluation harness, hardening, external API failure handling) → full FR/SC coverage

---

## Notes

- [P] tasks touch different files and have no unmet dependency on a sibling task in the same block
- [Story] label maps each task to its user story for traceability
- Every retrieval/generation implementation task has a corresponding test task that must fail first,
  per Constitution Principle III — this is not optional for this feature
- FR-006a (ambiguous questions), FR-004's fixed threshold, and FR-012 (API failure) were added via
  `/speckit-clarify` on 2026-07-04 and are reflected in T005, T008, T009, T021, T024, T025, T028,
  T030, T041, T042
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
