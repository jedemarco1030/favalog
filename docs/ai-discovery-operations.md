# AI Discovery — Operations runbook (v1)

- **Status:** Active
- **Date:** 2026-08-28
- **Scope:** Operational hardening of the existing hybrid catalog retrieval
  system ([ADR 0003](adr/0003-ai-discovery-hybrid-catalog-retrieval.md),
  [system card](ai-discovery-system-card.md)). This phase adds **observability,
  continuous evaluation, and aggregate quality signals** — it introduces **no**
  new recommendation or generative-AI feature.

This runbook is the operational contract for AI Discovery. It defines the
metrics, their formulas, initial guardrails, what is a firm alert versus a
baseline observation, investigation steps, safe rollback, the guarded
re-embedding procedure, and the privacy boundaries.

> **What is and is not configured.** This implementation **emits** the events
> below (structured server logs + coarse Vercel Web Analytics events). It does
> **not** create Vercel dashboards, alerts, log drains, or retention policies.
> Standing up dashboards/alerts and setting retention is an **owner task** (see
> [Owner setup tasks](#owner-setup-tasks)). Nothing here claims a dashboard or
> alert exists in Vercel.

## Three distinct signal sources — do not conflate them

1. **Offline evaluation** (`npm run eval:search`) — retrieval **quality** over a
   human-reviewed golden dataset. Its **deterministic (fake)** mode is a
   secret-free integration/regression check of the plumbing (also run in CI);
   only a genuine **`--live`** OpenAI run is evidence of **semantic quality**.
2. **Operational health** (server telemetry, event `catalog_search`) — is search
   **available/healthy**? Mode, latency, tokens, errors. For **operators**.
3. **Aggregate user-behaviour** (Vercel Analytics events `explore_search`,
   `explore_result_selected`) — are users **finding and selecting** results?
   Coarse, anonymized, low-cardinality. For **product**.

Offline quality does not prove production health; production health does not
prove semantic quality; behaviour signals are aggregate and never per-user.

## Data sources

### Server operational telemetry — `catalog_search`

Emitted once per executed search by `lib/supabase/search.ts` via
`lib/search/log.ts` (`buildSearchLog` → single JSON line). The schema is
**closed and versioned** (`schemaVersion`, fixed `event: "catalog_search"`).
Safe fields only:

`requestId`, `mode` (`hybrid` | `keyword` | `keyword_fallback`), `kind`
(`all`|`movie`|`tv`|`book`), `queryLength` (length, never text), `resultCount`,
`zeroResult`, `semanticAttempted`, `compatibleCorpus`, `embeddingModel`,
`embeddingTokens`, and the **separate** latencies `keywordMs`, `compatMs`
(compatibility check), `embeddingMs`, `hybridDbMs` (hybrid DB), `totalMs`, plus
`errorCategory` and `fallbackReason`.

No event is emitted for an **empty** query (no OpenAI call, no misleading
"completed search") or when Supabase is **unavailable** (no-env browsing).

`semanticAttempted` is `true` **only** when a successful keyword path actually
entered the semantic upgrade (beginning with the compatible-corpus check). It is
`false` when validation fails, Supabase is unavailable, semantic is
disabled/unconfigured, or **keyword retrieval fails** — a keyword database
failure therefore logs `semanticAttempted: false`, `compatibleCorpus: false`,
and no compatibility / embedding / hybrid timing. `compatibleCorpus` is `true`
only when the compatibility check returned a positive count; an
incompatible-corpus run is a real attempt (`semanticAttempted: true`,
`compatibleCorpus: false`).

### Aggregate product analytics — `explore_search`, `explore_result_selected`

Emitted client-side by `components/media/explore-search.tsx` via the adapter
`lib/analytics/search-analytics.ts` (Vercel Web Analytics). Coarse properties
only:

- `explore_search`: `mode`, `filter`, `zeroResult`, `resultCountBucket`
  (`0` | `1-3` | `4-10` | `11+`).
- `explore_result_selected`: `mode`, `filter`, `resultKind`, `rankBucket`
  (`1` | `2-3` | `4-10` | `11+`).

Analytics is best-effort and wrapped so a failure/blocked transport can **never**
affect navigation or search.

## Metrics and precise formulas

Computed over a rolling window `W` (suggested: 1h for alerting, 24h for
baselines). Let `N` = count of `catalog_search` events in `W`.

| Metric                                                   | Formula                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Search availability**                                  | `1 − (count(errorCategory present) / N)`                                          |
| **Error rate**                                           | `count(errorCategory present) / N`                                                |
| **Semantic attempt rate**                                | `count(semanticAttempted = true) / N`                                             |
| **Fallback rate**                                        | `count(mode = "keyword_fallback") / count(semanticAttempted = true)`              |
| **Hybrid success rate**                                  | `count(mode = "hybrid") / count(semanticAttempted = true)`                        |
| **Compatible-corpus health**                             | `count(compatibleCorpus = true) / count(semanticAttempted = true)`                |
| **p95 total latency**                                    | 95th percentile of `totalMs`                                                      |
| **p95 keyword / embedding / hybrid-DB / compat latency** | 95th percentile of `keywordMs` / `embeddingMs` / `hybridDbMs` / `compatMs`        |
| **Zero-result rate**                                     | `count(zeroResult = true) / N`                                                    |
| **Embedding token volume**                               | `sum(embeddingTokens)` over `W`                                                   |
| **Result selection rate (aggregate)**                    | `count(explore_result_selected) / count(explore_search where zeroResult = false)` |
| **Selection rank mix (aggregate)**                       | distribution of `rankBucket` over `explore_result_selected`                       |

Fallback / hybrid / compatible-corpus ratios use `semanticAttempted = true` as
the denominator: when the semantic upgrade never began — semantic intentionally
off (kill switch or unconfigured), or the keyword arm failed before the upgrade
could start — those ratios are undefined, not zero. Because a keyword-DB failure
keeps `semanticAttempted = false`, it counts toward **error rate**, never toward
the fallback/hybrid/compatible-corpus denominators.

## Initial SLOs / guardrails

**Firm alerts** (page/notify an operator):

| Guardrail                 | Threshold                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Search availability       | **≥ 99.5%** (alert if < 99% over 1h)                                                         |
| Error rate                | **< 0.5%** (alert if ≥ 1% over 1h)                                                           |
| p95 total latency         | **< 1500 ms** (alert if > 2500 ms — at/over the embedding timeout)                           |
| Compatible-corpus health  | **= 100%** while `semanticAttempted` (alert on any `compatibleCorpus = false` in production) |
| Fallback rate (sustained) | alert if **> 50%** sustained over 1h while semantic is enabled                               |

**Baseline observations** (watch/trend; investigate on anomaly, not a page):

- Fallback rate below the sustained-alert line (expected small nonzero from
  transient timeouts).
- Zero-result rate (a **product** signal — high values may mean catalog gaps or
  intent mismatch, not an outage).
- Embedding token volume (cost) — trend daily; investigate anomalous growth
  (e.g. > 3× the trailing 7-day daily baseline).
- p95 keyword / embedding / hybrid-DB / compat latencies (component trends).
- Result selection rate and rank mix (aggregate engagement).

Thresholds are deliberately conservative starting points for a small catalog;
re-tune from observed baselines.

## Investigation playbooks

### Provider (OpenAI) failure

- **Signals:** fallback rate up; `fallbackReason` in `timeout` / `transient` /
  `auth` / `rate_limit` / `server` / `network`; `mode = keyword_fallback`;
  availability unaffected (keyword still serves).
- **Do:** confirm keyword results still render (they should). Check OpenAI
  status and the `embeddingMs` p95 (timeouts cluster near 2500 ms). If sustained,
  **roll back semantic** (below) to stop paying for failing embeddings; keyword
  keeps working. Re-enable once the provider recovers.

### Corpus incompatibility

- **Signals:** `compatibleCorpus = false` with `semanticAttempted = true`;
  `fallbackReason = incompatible_corpus`; hybrid success rate → 0.
- **Meaning:** the hosted embedding corpus does not match the server's expected
  identity (provider/model/dimensions/document version) — often after a model,
  dimension, or `CANONICAL_DOCUMENT_VERSION` change without a re-embed.
- **Do:** verify the identity in `lib/search/config.ts` +
  `CANONICAL_DOCUMENT_VERSION` matches the stored corpus
  (`compatible_embedding_count`). Run the **guarded re-embedding** (below). Until
  then search safely serves keyword-only.

### Latency regression

- **Signals:** p95 `totalMs` up. Localize with component latencies: `keywordMs`
  (DB/index), `compatMs` (compatibility check), `embeddingMs` (provider),
  `hybridDbMs` (pgvector/HNSW + fusion).
- **Do:** if `embeddingMs` dominates → provider slowness (consider rollback).
  If `hybridDbMs`/`keywordMs` dominate → inspect DB load, indexes (GIN / HNSW),
  and connection health. The embedding timeout bounds tail latency; keyword is
  the floor.

### Database failure

- **Signals:** `errorCategory = database`; availability down; keyword-arm error
  returns the safe error state.
- **Do:** check Supabase/Postgres health and migrations. This is the one path
  that surfaces an error to the user (a controlled "try again" state), so treat
  as availability-impacting.

### Unexpected token growth

- **Signals:** `sum(embeddingTokens)` rises without a matching search-volume
  rise.
- **Do:** one embedding is charged **per executed search** only (never on empty
  queries or bare Explore visits, never per keystroke). Investigate abnormal
  request volume/automation. As a cost circuit-breaker, **roll back semantic**
  (keyword still serves) while investigating.

## Safe rollback — `SEMANTIC_SEARCH_ENABLED`

Semantic retrieval has a **server-only kill switch**. Set
`SEMANTIC_SEARCH_ENABLED` to a falsey token (`false` / `0` / `off` / `no`) in the
server environment to disable the paid semantic path **immediately**; keyword
full-text search keeps working and the page never fails. It is **not**
`NEXT_PUBLIC_`, so it changes server behaviour without shipping new application
logic. Unset (or truthy) re-enables it (semantic then also requires
`OPENAI_API_KEY`). With semantic off, telemetry shows `semanticAttempted = false`
and `mode = keyword` (never `keyword_fallback`).

## Guarded re-embedding procedure (owner-operated)

Re-embedding the hosted corpus is **never automatic** and the remote-write guard
is **never bypassed**. To (re)populate hosted embeddings after a model /
dimensions / document-version change:

```bash
OPENAI_API_KEY=… npm run embed:catalog -- \
  --allow-remote --confirm-project-ref=<exact-project-ref>
```

- A remote **live** write requires **both** `--allow-remote` **and**
  `--confirm-project-ref=<ref>` matching the ref resolved from the Supabase URL.
- A remote **`--fake`** write is **always** rejected (even with `--force`).
- `--force` is a recovery escape hatch (re-embed unchanged rows); it never
  bypasses remote protection, and remote dry runs stay write-free.

After a real backfill, verify `compatible_embedding_count` matches the catalog
size and re-check production `/explore` behaviour (see ADR 0003’s production
verification). Then confirm `compatibleCorpus = true` in telemetry.

## Privacy boundaries and retention

- **Never** in telemetry or analytics: raw/normalized **query text**, media
  **title/slug**, embedding **vectors** or provider responses, **user id /
  username / email / session / cookie / IP / user agent**, API keys, or DB
  credentials. Only a query **length** and coarse categoricals/buckets are kept.
- **Application-owned telemetry stays query-free:** Favalog does **not
  intentionally write raw query text** to its database, its structured
  `catalog_search` event, or any custom product-event properties. Explore does
  use a **shareable `?q=` URL**, so the query lives in the browser address bar /
  history and hosting infrastructure may process or retain request search
  parameters per its configuration and retention policy — that platform request
  metadata is separate from application-owned telemetry.
- **Analytics URL redaction:** the root `<Analytics>` integration
  (`components/analytics/analytics.tsx`) uses `beforeSend` +
  `redactAnalyticsUrl` to strip the `?q=` parameter from every analytics event
  URL, failing closed on an unparseable URL. This controls only Favalog's
  analytics telemetry — **not** Vercel Runtime Logs, whose request-log
  search-parameter handling and retention remain owner/platform concerns.
- `requestId` correlates server log lines only; it is **not** sent to product
  analytics (which stays low-cardinality/anonymous).
- **Retention:** server logs and Vercel Analytics follow the hosting platform’s
  defaults; because no personal data is emitted, retention risk is low. Owners
  should still set a **short, explicit** retention for operational logs and
  confirm Analytics retention — this repo does not configure either.

## Owner setup tasks (not done by this change)

These require access to the Vercel project / hosting console and are **not**
configured by this implementation:

- Build dashboards over the `catalog_search` log stream (availability, error
  rate, fallback rate, latency percentiles, zero-result rate, token volume) and
  the `explore_search` / `explore_result_selected` analytics events.
- Configure the **firm alerts** above (availability, error rate, p95 latency,
  compatible-corpus health, sustained fallback).
- Set explicit log/analytics **retention**.
- Perform the guarded re-embedding when the embedding identity changes.
