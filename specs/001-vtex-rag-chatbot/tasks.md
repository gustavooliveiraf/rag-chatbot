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
before their corresponding implementation task.

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

- [ ] T001 Create project directory structure per plan.md: `src/{config,db,ingestion,retrieval,generation,observability,evaluation,types}`, `src/api/{routes,controllers}`, `tests/{unit,integration,evaluation}`, `evaluation/fixtures`
- [ ] T002 Initialize Node.js + TypeScript project in repository root: `package.json`, `tsconfig.json`, and dependencies (`express`, `pg`, `@anthropic-ai/sdk`, `openai`, `dotenv`, dev deps `typescript`, `vitest`, `tsx`, `@types/express`, `@types/pg`) (depends on T001)
- [ ] T003 [P] Configure ESLint + Prettier in `.eslintrc.cjs` and `.prettierrc` (depends on T002)
- [ ] T004 [P] Create `docker-compose.yml` providing a local PostgreSQL instance with the `pgvector` extension enabled (depends on T001)
- [ ] T005 [P] Create `.env.example` with `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`, `PORT` (depends on T001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Create DB schema migration for `documents`, `chunks` (`vector(1536)` column + HNSW cosine index), and `interactions` tables per data-model.md in `src/db/migrations/001_init.sql` (depends on T002, T004)
- [ ] T007 [P] Implement PostgreSQL connection pool in `src/db/pool.ts` (depends on T002)
- [ ] T008 [P] Implement environment config loader in `src/config/index.ts` (depends on T002, T005)
- [ ] T009 Implement Anthropic + OpenAI SDK client setup in `src/config/clients.ts` (depends on T008)
- [ ] T010 [P] Define shared TypeScript types (`Chunk`, `SourceRef`, `Answer`, `ChatRequest`, `ChatResponse`, `EvaluationCase`) in `src/types/index.ts` per data-model.md and contracts/openapi.yaml (depends on T002)
- [ ] T011 [P] Implement structured JSON logger in `src/observability/logger.ts` (depends on T002)
- [ ] T012 Implement interaction record persistence (insert into `interactions`) in `src/observability/interactions.ts` (depends on T006, T007, T010)
- [ ] T013 Implement Express app scaffold with `GET /health` in `src/api/server.ts` and `src/api/routes/health.ts` (depends on T008)
- [ ] T014 [P] Implement VTEX docs fetch + main-content/heading extraction in `src/ingestion/fetch.ts` (depends on T002)
- [ ] T015 Implement heading-based chunking with overlap fallback in `src/ingestion/chunk.ts` (depends on T014)
- [ ] T016 Implement chunk embedding (`text-embedding-3-small`) + upsert into `chunks`/`documents` in `src/ingestion/embed.ts` (depends on T006, T007, T009, T010, T015)
- [ ] T017 Implement ingestion CLI entrypoint (seed VTEX URL list + `npm run ingest` script) in `src/ingestion/run.ts` (depends on T016)

**Checkpoint**: Foundation ready. Run `npm run ingest` to populate the corpus before validating any
user story below (per quickstart.md).

---

## Phase 3: User Story 1 - Get a grounded answer to a documented question (Priority: P1) 🎯 MVP

**Goal**: A user asks a question covered by the VTEX documentation and receives an answer whose
claims are all supported by retrieved documentation content (FR-001, FR-002, FR-003).

**Independent Test**: Submit a question clearly covered by the ingested documentation via
`POST /chat` and confirm every claim in the response's `answer` is traceable to the retrieved content
(quickstart.md "Validate User Story 1").

### Tests for User Story 1 ⚠️

> Write these tests FIRST; confirm they FAIL before implementing the corresponding task below.

- [ ] T018 [P] [US1] Unit test for pgvector top-k similarity search / passage selection in `tests/unit/retrieval.test.ts`
- [ ] T019 [P] [US1] Unit test for grounding prompt construction (system + passage-labeled user turn) in `tests/unit/promptBuilder.test.ts`
- [ ] T020 [P] [US1] Integration test for `POST /chat` golden-path (grounded answer, non-empty sources) against the `ChatResponse` contract in `tests/integration/chat.grounded.test.ts`

### Implementation for User Story 1

- [ ] T021 [P] [US1] Implement query embedding + pgvector top-k similarity search in `src/retrieval/search.ts` (depends on T009, T010, T007; must pass T018)
- [ ] T022 [US1] Implement passage selection/formatting for the prompt in `src/retrieval/selectPassages.ts` (depends on T021)
- [ ] T023 [P] [US1] Implement grounding system/user prompt builder in `src/generation/promptBuilder.ts` (depends on T010; must pass T019)
- [ ] T024 [US1] Implement Claude call + grounded answer assembly in `src/generation/generateAnswer.ts` (depends on T009, T022, T023)
- [ ] T025 [US1] Implement `POST /chat` controller wiring retrieval → generation → interaction logging in `src/api/controllers/chatController.ts` (depends on T022, T024, T012)
- [ ] T026 [US1] Register `POST /chat` route and wire into the app in `src/api/routes/chat.ts` / `src/api/server.ts` (depends on T025, T013; must pass T020)

**Checkpoint**: User Story 1 is fully functional and independently testable (assuming ingestion has run).

---

## Phase 4: User Story 2 - Get an honest "not found" instead of a fabricated answer (Priority: P1)

**Goal**: A user asks a question the documentation does not cover and receives an explicit
"not found in the documentation" response instead of a fabricated answer (FR-004).

**Independent Test**: Submit a question with no supporting content in the ingested corpus via
`POST /chat` and confirm the response has `grounded: false`, an explicit decline message, and no
invented facts (quickstart.md "Validate User Story 2").

### Tests for User Story 2 ⚠️

> Write these tests FIRST; confirm they FAIL before implementing the corresponding task below.

- [ ] T027 [P] [US2] Unit test for no-relevant-passages / low-confidence detection in `tests/unit/retrieval.noContext.test.ts`
- [ ] T028 [P] [US2] Integration test for `POST /chat` decline-path (`grounded: false`, empty `sources`) in `tests/integration/chat.declined.test.ts`

### Implementation for User Story 2

- [ ] T029 [P] [US2] Add relevance-threshold / empty-result handling to `src/retrieval/selectPassages.ts` (depends on T022; must pass T027)
- [ ] T030 [P] [US2] Extend `promptBuilder` with an explicit decline instruction path in `src/generation/promptBuilder.ts` (depends on T023)
- [ ] T031 [US2] Extend `generateAnswer` to produce a `grounded: false` decline response when no passages qualify in `src/generation/generateAnswer.ts` (depends on T024, T029, T030)
- [ ] T032 [US2] Update `chatController` to surface `grounded: false` and empty `sources` on decline in `src/api/controllers/chatController.ts` (depends on T025, T031; must pass T028)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Verify where an answer came from (Priority: P2)

**Goal**: A user can see which documentation source(s) an answer was drawn from, and that source
actually supports the answer's claims (FR-005).

**Independent Test**: Submit any in-scope question via `POST /chat` and confirm the response's
`sources` identify real, relevant documentation section(s) (quickstart.md "Validate User Story 3").

### Tests for User Story 3 ⚠️

> Write these tests FIRST; confirm they FAIL before implementing the corresponding task below.

- [ ] T033 [P] [US3] Unit test for chunk → `SourceRef` mapping (`title`, `headingPath`, `url`) in `tests/unit/sourceMapper.test.ts`
- [ ] T034 [P] [US3] Integration test asserting accurate, non-empty `sources` on grounded responses in `tests/integration/chat.sources.test.ts`

### Implementation for User Story 3

- [ ] T035 [US3] Implement chunk → `SourceRef` mapper in `src/generation/sourceMapper.ts` (depends on T010, T022; must pass T033)
- [ ] T036 [US3] Wire `sourceMapper` into `generateAnswer` / `chatController` to populate `ChatResponse.sources` in `src/generation/generateAnswer.ts` and `src/api/controllers/chatController.ts` (depends on T024, T025, T035; must pass T034)

**Checkpoint**: All three user stories are independently functional per quickstart.md.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Evaluation harness (FR-011) and hardening that spans multiple user stories

- [ ] T037 [P] Create versioned evaluation fixtures (question / `expect_answered` / `expected_source_titles`) per data-model.md in `evaluation/fixtures/cases.json`
- [ ] T038 Implement the evaluation-case runner (FR-011, SC-002/SC-003/SC-005) and `npm run evaluate` script in `src/evaluation/runEvaluation.ts` (depends on T037, T026, T032)
- [ ] T039 [P] Add request validation + `400` error responses for malformed `/chat` requests in `src/api/controllers/chatController.ts`
- [ ] T040 [P] Add centralized Express error-handling middleware (`500` responses) in `src/api/server.ts`
- [ ] T041 Run the full quickstart.md validation end-to-end and fix any discrepancies found
- [ ] T042 [P] Write project `README.md` with setup and run instructions

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
- **Polish (Phase 6)**: Depends on the user stories it touches (T038 needs US1 + US2 complete)

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
- All three test tasks within a story phase (e.g., T018-T020) in parallel
- T021 and T023 (US1) in parallel; T029 and T030 (US2) in parallel
- T037, T039, T040, T042 (Polish) in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for pgvector similarity search in tests/unit/retrieval.test.ts"
Task: "Unit test for grounding prompt construction in tests/unit/promptBuilder.test.ts"
Task: "Integration test for POST /chat golden-path in tests/integration/chat.grounded.test.ts"

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
5. Add Phase 6 polish (evaluation harness, hardening) → full FR/SC coverage

---

## Notes

- [P] tasks touch different files and have no unmet dependency on a sibling task in the same block
- [Story] label maps each task to its user story for traceability
- Every retrieval/generation implementation task has a corresponding test task that must fail first,
  per Constitution Principle III — this is not optional for this feature
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
