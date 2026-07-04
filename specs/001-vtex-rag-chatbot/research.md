# Phase 0 Research: VTEX Documentation RAG Chatbot

All unknowns from the Technical Context have concrete decisions below; none remain
open as `NEEDS CLARIFICATION`.

## 1. Documentation ingestion source & method

- **Decision**: Ingest a curated subset of the public VTEX developer documentation
  (`developers.vtex.com`) by crawling a fixed, version-controlled list of seed URLs
  (per topic area, e.g., Checkout, Catalog, Orders) rather than a full-site crawl.
  Fetch each page's rendered content via HTTP, extract the main article body (strip
  nav/footer/chrome), and convert it to clean text/Markdown with heading structure
  preserved.
- **Rationale**: A full-site crawl is unbounded scope for a learning project and
  fights the constitution's Simplicity principle; a fixed seed list keeps ingestion
  deterministic, reviewable, and re-runnable, while still exercising the real
  ingestion → chunk → embed pipeline end to end.
- **Alternatives considered**: (a) Full-site crawler with link discovery — rejected,
  unbounded scope and fragile to site structure changes; (b) Official VTEX docs API/
  export — rejected, no such bulk-export API is publicly available; (c) Manually
  copy-pasted docs into local files — rejected, doesn't exercise the
  fetch/parse responsibility the project exists to learn.

## 2. Chunking strategy

- **Decision**: Chunk by documentation heading sections (H2/H3 boundaries), with a
  target size of ~300–500 tokens per chunk and a small (~50 token) overlap between
  consecutive chunks of the same page when a section exceeds the target size. Each
  chunk stores its page title, section heading path, and source URL.
- **Rationale**: Heading-aligned chunks keep semantically coherent units (matches how
  VTEX docs are already authored), which improves retrieval precision over fixed-size
  sliding windows, and keeps citations meaningful ("Checkout > Shipping Policies"
  rather than an arbitrary byte offset).
- **Alternatives considered**: Fixed-size token windows with overlap — rejected as a
  first choice because it frequently splits a single concept across chunks and
  produces less legible source citations; kept as a fallback for pages with no
  heading structure.

## 3. Embedding model & storage

- **Decision**: Use OpenAI `text-embedding-3-small` (1536 dimensions) for both
  documentation chunks and incoming queries. Store vectors in a `vector(1536)` column
  via `pgvector`, indexed with an HNSW index (`vector_cosine_ops`), using cosine
  similarity for nearest-neighbor search.
- **Rationale**: Matches the user-specified stack; `text-embedding-3-small` is
  low-cost and sufficient for a single-domain, moderate-size corpus; HNSW gives good
  recall/latency trade-offs in pgvector without needing to tune IVFFlat's `lists`
  parameter against a corpus of unknown final size.
- **Alternatives considered**: IVFFlat index — rejected as primary choice since it
  requires a reasonable `lists` value tied to row count, which is premature to tune for
  a small, growing corpus; can be revisited if corpus size grows substantially.

## 4. Retrieval approach

- **Decision**: Single-pass top-k similarity search (k=5, tunable) directly against
  the `chunks` table for every query; no re-ranking model, no query rewriting/
  expansion, no multi-hop retrieval in v1. Of the top-k results, any chunk whose
  cosine similarity score falls below a fixed threshold (configurable via
  environment variable) is excluded before passages reach generation; if no chunk
  meets the threshold, retrieval returns an empty passage set, which generation
  treats as the no-context path (FR-004).
- **Rationale**: Directly satisfies constitution Principle IV (start with the
  simplest retrieval approach that works); a single vector search is sufficient to
  demonstrate and evaluate the full RAG loop end to end. A fixed similarity
  threshold gives the "not enough information" decision (FR-004, clarified
  2026-07-04) a deterministic, testable boundary instead of leaving it to
  implicit model judgment, which Principle III's no-context test requires.
- **Alternatives considered**: Hybrid keyword + vector search, cross-encoder
  re-ranking — deferred; explicitly the kind of complexity the constitution says to
  add only after an observed failure (e.g., eval results showing poor precision).
  Dynamic/relative threshold (based on the score gap between top results) —
  rejected as unnecessary complexity for a single-domain corpus; a fixed
  threshold is simpler to reason about and to test.

## 5. Prompt construction & grounding enforcement

- **Decision**: A single system prompt instructs the model to answer only using the
  provided passages, to cite which passage(s) support each part of the answer, and to
  respond with an explicit "not found in the documentation" message when the supplied
  passages don't support an answer. The user-turn message contains the question
  followed by the retrieved passages (each labeled with its source reference). No
  conversation history is included (stateless per FR-008). When the retrieved
  passages span multiple distinct, unrelated sections (an ambiguous question, FR-006a),
  the same prompt instructs the model to address each interpretation it found as a
  separate labeled part of the answer, each citing its own source, rather than
  picking one interpretation silently.
- **Rationale**: Directly implements Principles I and II; keeping grounding
  instructions in one static template (rather than dynamically generated per-domain
  prompts) is the simplest approach that satisfies the requirements. Handling
  ambiguity by labeling multiple interpretations (clarified 2026-07-04) fits this
  same single-prompt, single-pass design with no extra retrieval step or follow-up
  turn, consistent with the system being stateless (FR-008).
- **Alternatives considered**: Few-shot examples embedded in the prompt — deferred
  as unnecessary complexity unless evaluation shows the zero-shot instruction is
  insufficient. Asking the user a clarifying question before answering — rejected
  because the system has no conversation history (FR-008), so a follow-up request
  would arrive with no memory of the original ambiguous question.

## 6. LLM selection

- **Decision**: Use OpenAI `gpt-5-mini` as the generation model, configurable via an
  environment variable so it can be swapped without a code change. Generation now
  shares the same `openai` SDK client already used for embeddings (see §3), so no
  separate LLM provider SDK is needed.
- **Rationale**: Balances answer quality and cost/latency for a single-user learning
  project; keeping the model id centralized and swappable is consistent with
  Simplicity (no premature multi-model routing). Using one provider for both
  embeddings and generation also removes a dependency (no `@anthropic-ai/sdk`) with
  no loss of capability for this use case.
- **Alternatives considered**: `gpt-5` (full) — noted as a drop-in upgrade path if
  answer quality on the evaluation set proves insufficient; not chosen by default to
  keep latency low relative to SC-001. Anthropic Claude — the project's original
  stack choice; superseded by this decision in favor of a single-provider setup.

## 7. Evaluation approach (FR-011)

- **Decision**: A version-controlled JSON fixtures file
  (`evaluation/fixtures/cases.json`) holding reference question/expected-source pairs,
  plus a standalone script (no test framework dependency) that runs each question
  through the real pipeline and reports: whether an answer was produced vs. correctly
  declined, and whether the expected source(s) appear among the retrieved/cited
  sources. Results are printed as a pass/fail summary per case plus aggregate rates
  matching SC-002/SC-003.
- **Rationale**: A plain fixtures file + script is the simplest mechanism that makes
  the evaluation "re-runnable... without manual step-by-step re-testing" (SC-005),
  without introducing an evaluation framework the project isn't trying to learn.
- **Alternatives considered**: LLM-as-judge scoring — deferred as a future
  enhancement once a baseline exact/source-match evaluation exists; adding it now
  would be complexity ahead of an observed need.

## 8. Observability approach (FR-010)

- **Decision**: Persist one row per request to an `interactions` table in the same
  Postgres database: question, retrieved chunk ids (array), final answer text,
  whether the answer was grounded or a decline, timestamps, and any error message.
  Also emit a structured (JSON) log line per request to stdout for local dev
  visibility.
- **Rationale**: Reuses the already-present Postgres instance (no new storage
  technology), and makes interaction records queryable for both debugging and the
  evaluation script, satisfying Principle V with minimal added infrastructure.
- **Alternatives considered**: File-based JSON-lines log only — rejected as the sole
  mechanism because it's harder to query when cross-referencing interactions against
  evaluation runs; kept as a secondary stdout log for local dev convenience.

## 9. Project/runtime scaffolding

- **Decision**: Node.js 20 LTS, TypeScript 5.x, Express for the HTTP layer, `pg` for
  Postgres access (no ORM), Vitest for tests, npm for package management, and a
  `docker-compose.yml` providing a local Postgres instance with the `pgvector`
  extension enabled for development.
- **Rationale**: Matches the user-specified stack exactly; omitting an ORM keeps SQL
  (including vector similarity queries) explicit and visible, which supports the
  project's learning goal of understanding each component's responsibility.
- **Alternatives considered**: Prisma/TypeORM — rejected for v1 since an ORM would
  abstract away the pgvector query mechanics that are core to what this project is
  meant to teach.

## 10. External API failure handling (FR-012)

- **Decision**: If the OpenAI embedding or generation call fails or times out, the
  API returns an explicit `500` error response (`ErrorResponse` schema, per
  `contracts/openapi.yaml`) rather than a fabricated, partial, or non-grounded
  answer, and logs the failure to the `interactions` table (`error` field) and
  stdout per §8. No automatic retries are performed.
- **Rationale**: Keeps failure handling simple for a single-user learning project
  (Principle IV/Simplicity — no retry/backoff logic to build or test) and upholds
  Principle I: falling back to the model's un-grounded knowledge on failure would
  silently violate grounding, which is worse than a visible error (clarified
  2026-07-04).
- **Alternatives considered**: Automatic retries with backoff — deferred as
  complexity not justified until an observed transient-failure rate warrants it;
  falling back to a non-grounded, "unverified" answer — rejected outright as a
  direct violation of Retrieval Grounding (Principle I).
