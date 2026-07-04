# Phase 1 Data Model: VTEX Documentation RAG Chatbot

Derived from the Key Entities in [spec.md](./spec.md) and the storage decisions in
[research.md](./research.md). All persisted entities live in PostgreSQL (with
`pgvector`), except Evaluation Cases, which are a version-controlled fixtures file
(see research.md §7).

## documents

Represents one ingested VTEX documentation page (the **Documentation Corpus** entity,
at the page level).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `source_url` | text, unique, not null | canonical VTEX docs URL |
| `title` | text, not null | page title, used in citations |
| `content_hash` | text, not null | hash of extracted content; used to detect changes on re-ingestion |
| `fetched_at` | timestamptz, not null | when this version was ingested |

**Validation rules**: `source_url` must be a `developers.vtex.com` URL from the seed
list (research.md §1). Re-ingesting an unchanged `content_hash` is a no-op.

## chunks

Represents one retrievable passage (the **Retrieved Passage** entity's underlying
record) belonging to a document.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `document_id` | uuid, FK → documents.id, not null | |
| `chunk_index` | integer, not null | position within the document |
| `heading_path` | text, not null | e.g. "Checkout > Shipping Policies", used in citations |
| `content` | text, not null | chunk text used for generation |
| `token_count` | integer, not null | |
| `embedding` | vector(1536), not null | from `text-embedding-3-small` |

**Validation rules**: `(document_id, chunk_index)` unique. `embedding` dimension fixed
at 1536; any embedding model change requires a migration (out of scope for v1).

**Relationships**: many `chunks` → one `document`.

**Indexes**: HNSW index on `embedding` using `vector_cosine_ops` (research.md §3).

## interactions

Represents one logged request/response cycle (the **Interaction Record** entity).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `created_at` | timestamptz, not null, default now() | |
| `question` | text, not null | raw user question |
| `retrieved_chunk_ids` | uuid[], not null | chunks returned by retrieval, in rank order |
| `answer` | text | null if a hard error occurred before an answer was produced |
| `grounded` | boolean, not null | true = answer produced from passages; false = explicit decline (FR-004) |
| `error` | text | populated only when the request failed unexpectedly |

**Validation rules**: exactly one of (`answer` produced) or (`error` populated) per
row for any given request outcome. `grounded=false` with a non-null `answer` is valid
and expected — it holds the decline message itself.

**State transitions**: none (append-only log; rows are never updated after insert).

## Evaluation Case (file-based, not a DB table)

Represents one reference question used by the evaluation runner (FR-011), stored in
`evaluation/fixtures/cases.json`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | stable identifier for the case, e.g. `"shipping-policy-basic"` |
| `question` | string | the natural-language question to submit |
| `expect_answered` | boolean | true if the corpus is expected to support an answer; false if the case is designed to trigger a decline |
| `expected_source_titles` | string[] | expected `heading_path` or `title` values that should appear among cited sources (empty when `expect_answered` is false) |

**Validation rules**: every case must have `expect_answered` and, when true, at least
one entry in `expected_source_titles`.

## Runtime-only shapes (not persisted)

These correspond to the spec's **Query** and **Answer** entities as they flow through
the pipeline; they are TypeScript interfaces in `src/types/`, not database tables.

- **Query**: `{ question: string }` — the inbound request payload.
- **Answer**: `{ text: string; grounded: boolean; sources: SourceRef[] }`, where
  `SourceRef = { title: string; headingPath: string; url: string }` — the outbound
  response payload (see [contracts/openapi.yaml](./contracts/openapi.yaml)).
