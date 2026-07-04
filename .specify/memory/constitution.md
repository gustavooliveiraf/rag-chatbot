<!--
Sync Impact Report
==================
Version change: [TEMPLATE] → 1.0.0 (initial ratification)
Modified principles: N/A (first fill of template placeholders)
Added sections:
  - I. Retrieval Grounding (NON-NEGOTIABLE)
  - II. Source Attribution
  - III. Test-First for Retrieval & Generation
  - IV. Simplicity (YAGNI)
  - V. Basic Observability
  - Response Quality Standards (Section 2)
  - Development Workflow (Section 3)
  - Governance
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (generic "Gates determined based on constitution file" — no change needed)
  - .specify/templates/spec-template.md ✅ (no constitution-specific references found — no change needed)
  - .specify/templates/tasks-template.md ✅ (no constitution-specific references found — no change needed)
  - .specify/templates/commands/*.md ⚠ pending (directory not present at ratification time; re-check if commands are added later)
Follow-up TODOs: none
-->

# RAG Chatbot Constitution

## Core Principles

### I. Retrieval Grounding (NON-NEGOTIABLE)
Every answer MUST be grounded in the documents retrieved for that query. The agent
MUST NOT state facts, figures, or claims that are not supported by the retrieved
context. When retrieved context is empty or insufficient to answer confidently, the
agent MUST say so explicitly instead of guessing or falling back on unstated prior
knowledge.
Rationale: Hallucination is the primary failure mode of RAG systems; grounding is
the one property that justifies the "retrieval" in RAG.

### II. Source Attribution
Any response that draws on retrieved documents MUST reference which source(s) it
used (e.g., document title, file, or section identifier), so the origin of the
answer is traceable back to the underlying data.
Rationale: Traceable answers let users verify claims and let developers catch
grounding failures during review.

### III. Test-First for Retrieval & Generation
Core retrieval logic (chunking, embedding, ranking) and the generation pipeline
MUST have automated tests before a change is considered done, covering at minimum:
the golden-path query (relevant context exists and is used) and the no-context path
(no relevant document exists, and the agent declines rather than fabricates).
Rationale: These two paths are where regressions most often silently degrade
answer quality without breaking anything visibly.

### IV. Simplicity (YAGNI)
Start with the simplest retrieval and prompting approach that satisfies the
principles above (e.g., a single vector store, single-pass retrieval, a single
prompt template). Add complexity — re-ranking, multi-hop retrieval, agentic
loops, multiple stores — only in response to a concrete, observed failure, not
in anticipation of one.
Rationale: RAG pipelines accumulate incidental complexity quickly; extra layers
make failures harder to diagnose and slower to fix.

### V. Basic Observability
The system MUST log, for every request at minimum: the incoming query, the
retrieved chunks/sources (or lack thereof), the final response, and any errors.
Rationale: Without a record of what the model actually saw, a bad answer cannot
be debugged — only guessed at.

## Response Quality Standards

The agent MUST decline to answer, or clearly qualify its answer, rather than
fabricate one, whenever retrieved context does not adequately support a confident
response. Responses MUST NOT surface secrets, credentials, or content explicitly
marked private within source documents beyond what is strictly necessary to
answer the user's query.

## Development Workflow

Any change to retrieval or generation logic MUST include the tests required by
Principle III before merge. A reviewer (self-review is acceptable for a solo
project) MUST confirm the change does not violate Retrieval Grounding or Source
Attribution before it is considered complete.

## Governance

This constitution supersedes ad-hoc practices for this project. Amendments are
made by editing this file directly, incrementing the version per semantic
versioning (MAJOR: principle removed/redefined incompatibly; MINOR: principle or
section added/materially expanded; PATCH: clarification or wording fix), and
updating the Last Amended date. Every non-trivial change (new feature or
modification to retrieval/generation behavior) should be checked against the
Core Principles above before being marked done; violations must be fixed or
explicitly justified in the change's own notes.

**Version**: 1.0.0 | **Ratified**: 2026-07-03 | **Last Amended**: 2026-07-03
