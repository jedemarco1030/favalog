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
   the private embedding table + pgvector, search functions, provenance-guarded
   retrieval, and a **semantic relevance cutoff**. All of these — through
   `20260815120400` (the 23rd migration overall) — are **applied to hosted
   Supabase** — see the
   [amendment](#amendment-2026-08-25-embedding-provenance-correctness) and the
   [production-state / incident note](#amendment-2026-08-27-production-state-reconciliation--remote-write-safety).
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
**exact-title top-1 accuracy**, **positive zero-result rate**,
**negative clean rate**, per-category breakdowns,
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

Favalog does **not intentionally write raw query text** to its database, its
structured `catalog_search` event, or any custom product-event properties.
Explore does, however, intentionally use a **shareable `?q=` URL**, so the query
appears in the address bar: it is placed in browser history, and hosting
infrastructure may process or retain request search parameters according to its
own configuration and retention policy. That platform request metadata is
distinct from Favalog's application-owned telemetry, which stays query-free.
Structured logs carry a versioned,
closed event (`event: "catalog_search"`, `schemaVersion`) with only a
correlation id, search mode, query **length**, allow-listed kind, result count,
a zero-result flag, semantic-attempted and compatible-corpus indicators,
embedding model, token count, the **separate** keyword / compatibility-check /
embedding / hybrid-database / total latencies, a safe error category, and a
fallback reason — **never** the query itself, media title/slug, tokens/session,
user identity, API responses, or vectors. The observability, evaluation, and
aggregate-analytics operational hardening is specified in the
[Operations v1 amendment](#amendment-2026-08-28-ai-discovery-operations-v1) and
the [operations runbook](../ai-discovery-operations.md).

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
  **22nd** migration, now **hosted**) drops the old unguarded
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

## Note on this environment (Local Evaluation 2026-08-25)

A genuine live OpenAI evaluation was performed locally against a local Supabase
stack over the curated 28-title catalog on **2026-08-25**.

**Environment & Identity:**

- **Provider:** `openai`
- **Model:** `text-embedding-3-small`
- **Dimensions:** `512`
- **Document Version:** `v1`
- **Corpus:** 28/28 compatible rows

**Relevance Cutoff:**
The 23rd migration `20260815120400_semantic_similarity_cutoff.sql` (now hosted)
adds an optional `p_max_distance` parameter to `semantic_search` and
`hybrid_search`. The value is server-supplied from `lib/search/config.ts`
(`SEMANTIC_MAX_COSINE_DISTANCE = 0.72`, min similarity ≈ 0.28). This precision/
recall trade raised negative rejection from 0.000 to 0.800 at a small cost to
Recall@5 (0.947 → 0.921).

**Final Metrics (28-title catalog):**

- **Keyword Baseline:** Recall@5 0.658, MRR 0.737, exact-title top-1 1.000,
  positiveZeroResultRate 0.263, negativeCleanRate 1.000.
- **Hybrid (Live OpenAI):** Recall@5 0.921, MRR 1.000, exact-title top-1 1.000,
  positiveZeroResultRate 0.000, negativeCleanRate 0.800.
- **Threshold Check:** PASS (Recall@5 ≥ 0.55, MRR ≥ 0.6, top-1 = 1.0,
  positiveZero ≤ 0.3, negativeClean ≥ 0.8).

**Deployment Status:**
These are **local** numbers (live OpenAI against a local Supabase stack) and
remain the documented evidence of semantic quality. Production activation
followed on 2026-08-27 — see the
[2026-08-27 production-state reconciliation](#amendment-2026-08-27-production-state-reconciliation--remote-write-safety):
all 23 migrations (through `20260815120400`) are **hosted**, commit `2c9ab54` is
deployed to production, the hosted embedding corpus has been **backfilled with
compatible OpenAI embeddings**, and **production semantic search is enabled and
browser-verified**. The small-catalog limitation still applies: the cutoff
should be recalibrated if the catalog or model changes.

## Amendment (2026-08-27): production-state reconciliation & remote-write safety

This amendment reconciles the documented state with the verified external state
and records an operational-safety hardening. Nothing in the original decision or
the 2026-08-25 amendment is reversed.

**Corrected production state (verified, 2026-08-27):**

- **Schema is hosted.** All 23 migrations through `20260815120400` are present in
  the linked Supabase migration ledger — including the favorites RPC
  (`20260814160300`) and the five AI Discovery migrations
  (`20260815120000`–`20260815120400`). Earlier notes calling migrations 18–23
  "local-only / not yet hosted" were inaccurate and are corrected here.
- **Application is deployed.** Commit `2c9ab54` is the production commit on
  Vercel (status Ready); the current repository tip includes commits `77790be`
  and `d9453e5`.
- **Hosted embedding corpus is populated.** The earlier accidental hosted
  **fake**-embedding write was **cleaned up before** the guarded real backfill
  (so no placeholder vectors remained), and the owner-controlled guarded OpenAI
  backfill then **completed successfully**. `public.media_search_documents` now
  holds a complete, compatible embedding corpus (provider `openai`, model
  `text-embedding-3-small`, `dimensions: 512`, document version `v1`). The
  read-only hosted corpus, provenance, compatible-corpus, security, and
  idempotency checks all returned their documented expected results, with
  `compatible_embedding_count` for that provenance matching the 28-title
  catalog.
- **Production semantic retrieval is active and verified.** With a compatible
  hosted corpus, `compatible_embedding_count > 0` and production serves hybrid
  results, still degrading to keyword-only (mode `keyword` / `keyword_fallback`)
  on any semantic failure. Browser verification on the deployed `/explore`
  (2026-08-27) confirmed the intent query
  `a thoughtful sci-fi story about memory and grief` returns relevant results
  while the out-of-catalog query `how to file my income taxes online this year`
  returns zero results with the controlled "No matches yet" state. The local
  live evaluation (above, 2026-08-25) remains the documented evidence of
  **semantic quality** and stays distinct from this hosted-database and
  production-browser verification.

**Incident: accidental hosted fake-embedding write — why remote-target
confirmation was added.**

The embedding CLI (`scripts/embed-catalog.mjs`) resolved its Supabase target
purely from environment configuration and wrote wherever that pointed. During
operation it was pointed at the **hosted** project (a service key was present)
and a `--fake` run wrote deterministic placeholder vectors into the hosted
`media_search_documents`. Fake vectors are not a valid semantic space, so a
silent contamination like this would make hosted "hybrid" results meaningless
while appearing to work; the rows were removed, but the near-miss showed the
tool trusted an ambient service key as authorization to mutate production.

To prevent recurrence, the CLI was refactored so its safety- and drift-critical
logic lives in a tested module (`scripts/embed-catalog-core.ts`) that
**classifies the resolved Supabase URL** as local (`localhost` / `127.0.0.1` /
the documented local endpoint) vs remote/hosted and applies an explicit
write-authorization guard, with no interactive prompt (deterministic for
automation):

- A **remote `--fake`** write **always** fails nonzero — even with `--force`.
- A **remote live** write fails nonzero **unless** the operator supplies **both**
  `--allow-remote` and `--confirm-project-ref=<ref>` whose value **matches** the
  project reference resolved from the Supabase URL.
- `--force` never bypasses remote protection; **remote dry runs stay write-free**
  and clearly label the remote target; local writes keep their prior behavior.
- Authorization is **never** inferred from the mere presence of a service key,
  and key redaction / safe structured logging (only a target classification +
  hostname/project ref, never keys or vectors) is preserved.

The guard is covered by unit/CLI tests (`scripts/embed-catalog-core.test.ts`)
that prove local fake/live allowed; remote fake (and remote fake `+ --force`)
rejected; remote live without confirmation, and with a wrong project ref,
rejected; a fully confirmed remote live run reaching the pipeline in a mocked
test; and a dry run performing no writes — none of which touch a real network or
hosted database.

**Owner-controlled production enablement (completed 2026-08-27).** Turning on
production semantic search was a deliberate, owner-operated step: the guarded
remote backfill was run with a real key —
`npm run embed:catalog -- --allow-remote --confirm-project-ref=<ref>` (with
`OPENAI_API_KEY` set) — and the hosted counts plus production browser behavior
were re-verified (above). The remote-write guard **remains the required
process** for any future production re-embedding; it is never bypassed and never
automatic. This documentation update performs no backfill, remote write, push,
deploy, or Vercel environment change.

## Amendment (2026-08-28): AI Discovery Operations v1

This amendment adds **privacy-preserving observability, continuous evaluation,
and aggregate online-quality signals** for the existing retrieval system. It is
**operational hardening only** — no new recommendation or generative-AI feature.
Nothing in the original decision or the earlier amendments is reversed. The full
operational contract lives in the
[operations runbook](../ai-discovery-operations.md).

- **Versioned, closed server telemetry.** The `catalog_search` structured log is
  now an explicitly versioned (`schemaVersion`), fixed-name, closed event built
  by a single audited choke point (`lib/search/log.ts`). It adds
  `zeroResult`, `semanticAttempted`, and `compatibleCorpus` indicators, and — to
  fix a genuine ambiguity — **splits the single `dbMs` field** into a distinct
  compatibility-check latency and hybrid-database latency (detailed just below).
  `semanticAttempted` is `true` **only** when a successful keyword path actually
  enters the semantic upgrade (beginning with the compatible-corpus check); it
  stays `false` when validation fails, Supabase is unavailable, semantic is
  disabled/unconfigured, or **keyword retrieval fails** — so a keyword database
  failure never misreports an attempt that never began. An incompatible corpus
  is a real attempt, correctly reported as `semanticAttempted: true` with
  `compatibleCorpus: false`. The split fields are a distinct
  compatibility-check latency (`compatMs`) and hybrid-database latency
  (`hybridDbMs`) so one database duration never overwrites the other. It still
  carries only safe fields (correlation id, mode, kind, query **length**, result
  count, embedding model, token count, latencies, safe error category, fallback
  reason) and **never** the query text, media title/slug, vectors, provider
  responses, user identity, or credentials. The telemetry seam stays
  dependency-injected so tests never require Vercel, OpenAI, or Supabase; an
  empty query emits nothing (no OpenAI call, no misleading completed-search
  event) and no-env stays silent.
- **Aggregate product analytics.** Explore emits two coarse Vercel Web Analytics
  events via a small tested adapter (`lib/analytics/search-analytics.ts`):
  `explore_search` (a rendered outcome) and `explore_result_selected` (a user
  selecting a result). Only low-cardinality properties are sent — retrieval
  mode, filter kind, result kind, zero-result flag, and **bucketed**
  result-count / rank — never the query, title, slug, request id, or any user
  identity. Analytics is best-effort: a failing or blocked transport can never
  affect navigation or search. As a second layer, the root `<Analytics>`
  integration is wrapped (`components/analytics/analytics.tsx`) so its
  `beforeSend` hook strips the shareable `?q=` parameter from **every** analytics
  event URL (page views and custom events) via the pure, tested
  `redactAnalyticsUrl` (`lib/analytics/redact-analytics-url.ts`); a URL that
  cannot be parsed **fails closed** (the event is dropped rather than sent
  unsanitized). This governs only Favalog's own analytics telemetry — it does
  **not** control Vercel Runtime Logs or any request-log search-parameter
  handling and retention, which stay platform/owner concerns.
- **Continuous evaluation in CI.** The secret-free seeded Explore integration job
  now runs the **deterministic** evaluation harness in JSON mode over the fake
  embeddings, preserves its threshold-based nonzero-exit gate (with shell
  `pipefail` so a piped failure can't look successful), fails clearly on a
  missing report, and uploads the JSON as a named artifact **honestly labelled
  deterministic integration/regression evidence — not live semantic-quality
  evidence**. No OpenAI or hosted-Supabase secrets are added, and CI never
  contacts or mutates production.
- **Operational contract.** Metric names/formulas, initial SLOs/guardrails
  (availability, error rate, fallback rate, p95 latency, zero-result rate,
  compatible-corpus health, token volume), firm-alert-vs-baseline classification,
  investigation playbooks, safe rollback via `SEMANTIC_SEARCH_ENABLED`, and the
  guarded re-embedding procedure are in the
  [operations runbook](../ai-discovery-operations.md).
- **Not configured here.** This change only **emits** events. Vercel dashboards,
  alerts, log drains, and retention policies are **not** configured by it and
  remain an explicit owner task; no production/Vercel settings were changed.
