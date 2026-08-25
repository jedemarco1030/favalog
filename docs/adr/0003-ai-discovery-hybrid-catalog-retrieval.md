# 0003 — AI Discovery v1: hybrid catalog retrieval (keyword + pgvector)

- **Status:** Accepted
- **Date:** 2026-08-23
- **Phase:** 3 (AI Discovery — catalog search)
- **Builds on:** [0001 — Supabase/PostgreSQL as the Favalog backend](0001-supabase-backend.md)

## Context

Favalog's `/explore` surface has to date searched only the in-memory mock
catalog on the client (`searchTermsFor` in `@/lib/data`). Now that the
Supabase catalog owns all **28** curated movies / TV / books, discovery should
run against real `media_items` and understand natural-language intent
("cozy space movies", "books about grief") without regressing exact-title
lookups or leaking anything sensitive.

The requirements shaping this phase:

- **Retrieval, not generation.** Users need to _find_ existing curated titles,
  not read machine-written prose. No LLM-generated text is introduced.
- **Meaning + keywords.** Pure keyword search misses paraphrases; pure semantic
  search can demote an exact-title match and hallucinate loose neighbors. We
  need both.
- **Keyword must never depend on embeddings.** Search has to work with zero
  embeddings, no OpenAI key, or the semantic path disabled — the page must
  never fail.
- **A hard security boundary around embeddings and secrets.** The
  `OPENAI_API_KEY` is server-only; raw vectors must never reach the browser;
  the app (not the browser) generates the trusted query embedding.
- **Small, controlled corpus.** The 28 curated titles are a stable, reviewable
  dataset — ideal for a human-reviewed evaluation harness and cheap embeddings.
- **No new heavy dependencies.** Keep secret-free, offline builds dependency-free
  (no vector-DB service, no OpenAI SDK).

## Decision

Ship **AI Discovery v1** as a **hybrid retrieval** system over the curated
Supabase catalog:

1. **Two retrieval signals, fused.** Postgres full-text search (lexical) and
   pgvector cosine similarity (semantic) are combined with **Reciprocal-Rank
   Fusion** (`RRF_K = 60`). **Exact-title protection** guarantees a direct
   title query is never demoted below its lexical match.
2. **pgvector inside the existing Postgres**, not a separate vector database.
   The `vector` extension lives in the `extensions` schema; embeddings live in a
   **private** `public.media_search_documents` table (`vector(512)` + content +
   `content_hash` + provider/model/dimensions provenance + timestamps, FK
   `ON DELETE CASCADE`, an all-or-nothing embedding CHECK, and an HNSW cosine
   index).
3. **OpenAI `text-embedding-3-small` at `dimensions: 512`** (Matryoshka
   truncation) for cost/storage reduction, behind a small internal
   `EmbeddingProvider` interface (`lib/search/embedding-provider.ts`). A
   deterministic `FakeEmbeddingProvider` powers tests/offline eval; a
   server-only OpenAI adapter runs behind the interface. (Originally a direct
   REST `fetch` to keep builds dependency-free; **reconciled to the official
   `openai` SDK** — see the [amendment](#amendment-2026-08-25-embedding-provenance-correctness).)
4. **Central config** in `lib/search/config.ts` (model, `dimensions = 512`,
   `RRF_K = 60`, candidate limits = 50, `DEFAULT_RESULT_LIMIT = 24`,
   `MAX_RESULT_LIMIT = 50`, `MAX_QUERY_LENGTH = 200`,
   `EMBEDDING_TIMEOUT_MS = 2500`, pipeline batch/concurrency/retry knobs) plus a
   server-only kill switch `SEMANTIC_SEARCH_ENABLED` (a falsey token disables
   semantic; keyword keeps working).
5. **A versioned, pure canonical embedding document**
   (`lib/search/canonical-document.ts`): catalog-only fields (title, subtitle,
   kind, year, genres, credits by kind, synopsis) in a stable order with
   normalization, versioned (`CANONICAL_DOCUMENT_VERSION = "v1"`) and folded
   with a SHA-256 content hash. Skip-unchanged / stale-on-change re-embedding
   keys off the **complete embedding identity** (content hash, document version,
   provider, model, dimensions, and a complete vector), not the content hash
   alone — see the [amendment](#amendment-2026-08-25-embedding-provenance-correctness).
   No user data, no secrets, no mock-user attribution.
6. **Forward-only migrations** (after `20260814160300`): catalog enrichment +
   a STORED `search_tsv` with a GIN index (lexical on the public catalog),
   the private embedding table + pgvector, and the search functions —
   `keyword_search` (`SECURITY INVOKER`, public catalog) plus `semantic_search`
   / `hybrid_search` (`SECURITY DEFINER`, the narrow, justified exception to
   read the private embedding table). A later forward-only migration
   (`20260815120300`, **local-only** / not yet hosted) makes semantic retrieval
   **provenance-guarded** — see the
   [amendment](#amendment-2026-08-25-embedding-provenance-correctness).
7. **A server-only query service with keyword fallback.** Validate the query,
   always run keyword; when semantic is enabled and configured, request **one**
   query embedding with a 2500 ms timeout, then run hybrid; on timeout/failure,
   return keyword results and never fail the page. The service also checks for a
   **compatible embedding corpus first** and stays keyword-only (without paying
   for a query embedding) when none exists. Mode is recorded as
   `hybrid` | `keyword` | `keyword_fallback`.

See [`docs/ai-discovery-system-card.md`](../ai-discovery-system-card.md) for the
system card and [`docs/backend-architecture.md`](../backend-architecture.md) for
the schema/security detail.

### Why retrieval before generative AI

Generative answers introduce hallucination, moderation, latency, recurring
per-token cost, and prompt-injection surface — none of which a "help me find a
title I'll love" job requires. Retrieval over a curated corpus is verifiable
(every result is a real catalog row), cheap, fast, and honest. Generation, if
ever justified, can layer on top of a trustworthy retrieval base.

### Why Postgres/pgvector instead of a separate vector database

The corpus is 28 rows and grows slowly; a dedicated vector service (Pinecone,
Weaviate, a self-hosted store) would add an operational dependency, a second
source of truth, and a sync problem for **no** measurable recall benefit at this
scale. Keeping embeddings in the same Postgres means one backup/restore, one
migration ledger, one RLS model, transactional consistency with the catalog
(FK `ON DELETE CASCADE`), and reuse of the existing security posture. HNSW
cosine indexing in pgvector is more than adequate here.

### Why hybrid beats semantic-only

Lexical search nails exact titles, names, and rare tokens but misses
paraphrase; semantic search captures intent but can rank a loose thematic
neighbor above the literally-named title and is sensitive to embedding drift.
RRF fusion (`k = 60`) takes the best of both without hand-tuned weights, and
**exact-title protection** guarantees that typing a title returns that title
first. Fusing rank positions (not raw scores) also avoids having to calibrate
incomparable lexical `ts_rank` and cosine scales.

### Why the corpus is intentionally controlled

A small, human-curated catalog is a feature this phase, not a limitation: it
keeps embedding cost trivial, makes a **human-reviewed golden dataset**
feasible, gives deterministic evaluation, and avoids ingestion/licensing
complexity. External catalog ingestion (TMDB / Open Library / Google Books) and
an unbounded corpus are explicitly out of scope.

### Model + dimension selection

`text-embedding-3-small` is inexpensive and strong for short catalog documents.
We request `dimensions: 512` (Matryoshka truncation) rather than the full
1536: at this corpus size the retrieval quality difference is negligible while
storage and index size drop ~3×. The choice is captured in config **and**
persisted per row (`provider` / `model` / `dimensions`, alongside the document
version) so a future model, dimension, or document-format change is detectable
and re-embeddable rather than silent — and, per the
[amendment](#amendment-2026-08-25-embedding-provenance-correctness), the
semantic arm only ever compares embeddings from the **same** identity as the
query.

### The embedding security boundary

- `OPENAI_API_KEY` is **server-only** — never `NEXT_PUBLIC_`, never sent to the
  browser, never written to logs or error messages.
- The **application** generates the one trusted query embedding server-side; the
  browser never supplies vectors, weights, model, dimensions, or SQL.
- Raw embedding vectors are never exposed: `media_search_documents` has RLS
  enabled with **no** policies and `anon`/`authenticated` revoked, so the Data
  API cannot read it; only `service_role` writes it, and only the
  `SECURITY DEFINER` search functions read it — returning **only** safe catalog
  fields + a rank (never the vector).
- The pipeline embeds a **pure, catalog-only** canonical document — no user
  data, no secrets, no mock-user attribution.

### Exact-title protection

A query that matches a title exactly must return that title as the top result
regardless of semantic neighbors. This is enforced in the fusion step so that a
direct title lookup is never demoted — the single most important
"does search feel broken?" failure mode.

### Evaluation strategy

A human-reviewed **golden dataset** over the stable catalog drives an offline
harness (`npm run eval:search`) measuring **Recall@5**, **MRR**,
**exact-title top-1 accuracy**, **zero-result rate**, per-category breakdowns,
and latency (when live). It runs in three modes: a **deterministic secret-free**
mode (fixture rankings via `FakeEmbeddingProvider`), a **keyword baseline**, and
a **live hybrid** mode gated on a local Supabase + `OPENAI_API_KEY`. It emits
JSON + human-readable output and exits nonzero on a threshold regression. In
`--live` mode it **fails closed** — exiting nonzero before evaluating if the
corpus is not complete and provenance-matched — and the deterministic mode is a
secret-free integration/regression check of the plumbing, **not** proof of
semantic relevance (see the
[amendment](#amendment-2026-08-25-embedding-provenance-correctness)).

### Failure / fallback behavior

Query validation runs first (string, normalized, non-empty, ≤ 200 chars; an
empty query never calls OpenAI). Keyword always runs. If semantic is enabled and
configured, exactly one query embedding is requested with a **2500 ms timeout**;
on timeout or any embedding/DB failure the service returns keyword results and
records mode `keyword_fallback` — the page never errors. Media-kind filters are
allow-listed and the result limit is server-clamped.

### Privacy & logging policy

Raw user query text is **never persisted**. Structured logs may carry a
correlation id, search mode, query **length**, embedding model, token count,
keyword/embedding/db/total latency, result count, a safe error category, and a
fallback reason — **never** the query itself, tokens/session, user identity,
API responses, or vectors.

### Cost & latency considerations

Catalog embeddings are computed once (and only re-computed when the versioned
canonical hash changes), so steady-state cost is dominated by **one** small
query embedding per explicit search — and searches are explicit (submit), not
per-keystroke. `dimensions: 512` keeps storage/index small; the 2500 ms timeout
bounds tail latency, with keyword as an always-available floor.

## Alternatives considered

- **Keyword-only (`tsvector` + GIN, no embeddings).** Cheapest and always
  available (it is our fallback), but misses natural-language intent and
  paraphrase. Kept as the floor, not the ceiling.
- **Semantic-only (pgvector, no lexical).** Understands intent but demotes exact
  titles and is sensitive to embedding drift; unacceptable for
  "type a title, get that title". Rejected in favor of hybrid.
- **A dedicated vector database** (Pinecone / Weaviate / Qdrant). Overkill for
  28 rows: extra service, extra secret, a sync/consistency problem, and cost for
  no recall gain at this scale. Revisit only when the corpus and QPS grow by
  orders of magnitude (see below).
- **Client-side embedding or client-supplied vectors/weights.** Would leak the
  API key and let a malicious client control ranking or read vectors. Rejected
  outright — the app owns the trusted embedding.
- **Adding the OpenAI SDK.** Originally deferred in favor of a direct REST
  `fetch` behind the `EmbeddingProvider` interface to keep builds
  dependency-free. **Later adopted** (the official `openai` SDK, server-only,
  behind the same seam) — see the
  [amendment](#amendment-2026-08-25-embedding-provenance-correctness).
- **Full 1536 dimensions.** Marginal quality benefit at this corpus size for ~3×
  the storage/index footprint. Rejected for `dimensions: 512`.
- **Generative answers / RAG summaries now.** Hallucination, moderation, cost,
  and latency with no benefit to a find-a-title job. Deferred.

## Consequences

**Positive**

- Natural-language and keyword discovery over the **real** catalog, with exact
  titles protected and results that are always real catalog rows.
- One datastore, one security model, one migration ledger; embeddings are
  transactionally consistent with the catalog.
- Keyword search works with **no** OpenAI key, the kill switch off, or the
  semantic path unavailable — the page never fails.
- Secret-free, offline builds stay dependency-free; a deterministic eval harness
  makes quality measurable and regressions blocking.

**Negative / costs**

- A `SECURITY DEFINER` read path exists (narrowly scoped and justified below);
  it must be reviewed with care on every change.
- Embeddings must be (re)generated when the versioned canonical document
  changes. This is no longer silent: staleness keys off the complete embedding
  identity and the database semantic arm refuses to mix embedding spaces, so a
  stale or incompatible corpus degrades safely to keyword-only (see the
  [amendment](#amendment-2026-08-25-embedding-provenance-correctness)).
- A recurring (if tiny) per-query embedding cost and an external dependency on
  OpenAI availability (mitigated by the timeout + keyword fallback).

## Security implications

- `OPENAI_API_KEY` is server-only; never `NEXT_PUBLIC_`, never logged, never in
  errors or the browser.
- `media_search_documents` has RLS enabled with **no** policies, `anon` /
  `authenticated` revoked; only `service_role` writes and only the search
  functions read it. Raw vectors are never returned by the Data API or the
  functions.
- `keyword_search` is `SECURITY INVOKER` over the public catalog.
  `semantic_search` / `hybrid_search` are `SECURITY DEFINER` **only** to read
  the private embedding table, and are hardened: pinned empty `search_path`,
  fully schema-qualified, no dynamic SQL, clamped limits, read-only, returning
  only safe catalog fields + rank, with EXECUTE revoked from `public` and
  granted to `anon` + `authenticated`. They also take the **server-supplied**
  expected embedding provenance so they only read rows in the query's embedding
  space (see the
  [amendment](#amendment-2026-08-25-embedding-provenance-correctness)); the
  expected provenance is never client input.
- Untrusted query text flows **only** through `websearch_to_tsquery` — never
  interpolated into SQL. The result limit is server-clamped and media-kind
  filters are allow-listed. The browser never supplies vectors, weights, model,
  dimensions, or SQL.

## Conditions that would justify changing vector storage, model, or ranking

- **Vector storage → a dedicated vector DB:** the corpus grows to hundreds of
  thousands / millions of rows, or query volume, latency, or index memory in
  Postgres becomes the bottleneck, or filtered-ANN needs outgrow pgvector.
- **Model / dimensions:** a materially better or cheaper embedding model ships,
  live evaluation shows the 512-dim truncation costs meaningful recall, or a
  multilingual/multimodal requirement appears. The persisted `provider` /
  `model` / `dimensions` provenance makes a re-embed detectable and safe.
- **Ranking strategy:** evaluation shows RRF (`k = 60`) is beaten by a tuned or
  learned scheme (e.g. weighted fusion, a cross-encoder re-rank), or exact-title
  protection needs to generalize to aliases/localized titles. Any change must be
  proven against the golden dataset with the thresholds still enforced.

## Amendment (2026-08-25): embedding provenance correctness

A follow-up correction hardens the boundary between the **query** embedding and
the **stored** document embeddings so the two are never compared across
incompatible embedding spaces. Nothing in the original decision is reversed;
this tightens points 3, 5, 6, and 7 above.

- **Staleness now keys off the complete embedding identity.** Previously
  skip-unchanged compared only the content hash + embedding presence, so a later
  real OpenAI run could skip rows embedded by the deterministic
  `FakeEmbeddingProvider` and then compare real query embeddings against fake
  document embeddings. A stored row is now treated as **unchanged** only when
  **all** of content hash, document version, embedding provider, embedding
  model, embedding dimensions, **and** a complete vector match what the current
  run would produce; any mismatch (fake→OpenAI, or a provider / model /
  dimensions / document-version / content change) is re-embedded automatically.
  Idempotency holds — a re-run with the same identity performs zero embedding
  calls and zero writes. A `--force` flag on `npm run embed:catalog` is a
  recovery escape hatch only, not a substitute for the automatic detection.
- **Semantic retrieval is provenance-guarded at the database.** A new
  forward-only migration `20260815120300_provenance_guarded_search.sql` (the
  **22nd** migration, **local-only** / not yet hosted) drops the old unguarded
  `semantic_search(vector, media_kind, integer)` /
  `hybrid_search(text, vector, media_kind, integer)` overloads and recreates
  them taking the **server-supplied** expected provenance
  (`provider text, model text, dimensions int, document_version text`), so the
  semantic arm only considers stored rows whose provenance matches all four (and
  that carry a complete vector). It also adds
  `compatible_embedding_count(provider, model, dimensions, document_version)`
  so the app can cheaply detect a missing / partial / stale / incompatible
  corpus. All three functions keep the `SECURITY DEFINER` hardening above (pinned
  empty `search_path`, fully schema-qualified, no dynamic SQL, read-only, EXECUTE
  revoked from `public` and granted to `anon` + `authenticated`);
  `keyword_search` stays `SECURITY INVOKER`. RRF (`k = 60`) and exact-title
  protection are preserved, and the expected provenance always comes from the
  server (config constants + `CANONICAL_DOCUMENT_VERSION`), never the browser.
- **The application fails safely to keyword-only.** `lib/supabase/search.ts`
  calls `compatible_embedding_count` **first**; with no compatible corpus it
  stays keyword-only, does **not** pay for a query embedding, and records mode
  `keyword_fallback` with reason `incompatible_corpus`. It never claims `hybrid`
  unless a compatible semantic corpus was actually used. The kill switch,
  keyword fallback, exact-title protection, raw-vector privacy,
  anonymous+authenticated Explore access, and no-env public browsing are all
  preserved.
- **Evaluation fails closed.** In `--live` mode `npm run eval:search` verifies
  every catalog title has a stored embedding matching the active provider /
  model / dimensions / document version and exits nonzero **before** evaluating
  if any fake / stale / incomplete / incompatible vector remains, never
  reporting live semantic metrics for a mismatched corpus. The JSON report gained
  the evaluated `identity`, `catalogCount`, `compatibleCorpusCount`,
  `corpusComplete`, and `embeddingTokens`. The deterministic (fake) mode is a
  **secret-free integration/regression** check of the plumbing, **not** proof of
  semantic relevance — fake-vector cosine similarity does not demonstrate
  semantic quality; only a genuine `--live` OpenAI run is evidence of it.
- **OpenAI adapter reconciled to the official SDK.** This reconciles the
  original agreed architecture, which justified a direct REST `fetch` for a
  dependency-free build. `lib/search/openai-embedding-provider.ts` now uses the
  official `openai` npm SDK (added to `dependencies`, v7.x) behind the same
  `EmbeddingProvider` seam, preserving the strict timeout/abort passthrough,
  retry/error classification, and API-key redaction. Tradeoff: one server-only
  dependency is added; because it is imported only in server code, **client
  bundles are unaffected**. `OPENAI_API_KEY` remains server-only (never
  `NEXT_PUBLIC_`, never logged, never returned).

## Note on this environment

No live semantic evaluation was run in this environment: **no OpenAI key was
present**, so the OpenAI adapter and the live-hybrid eval mode were not
exercised and **no live semantic quality numbers are claimed**. The
deterministic secret-free eval mode (fixtures via `FakeEmbeddingProvider`) and
the keyword baseline are the exercised paths. Live hybrid metrics must be
produced against a local Supabase stack with `OPENAI_API_KEY` set before any
semantic quality figure is asserted. The provenance-correctness changes above
were verified **locally only** (a local `supabase db reset` applied all
migrations including `20260815120300`; the full pgTAP suite and unit suite
passed; generated types re-generated byte-identical); migration
`20260815120300` has **not** been applied to hosted Supabase, and the live
OpenAI dry-run / backfill / `eval:search --live` steps were **not** run.
