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

### Catalog materialization telemetry — `catalog_materialize` (v1B)

Emitted server-side by `lib/catalog/log.ts` (`logCatalogMaterialization`) when a
user imports an external title via the federated-Explore materialization flow.
Redaction-safe, safe fields only:

- `provider` (`tmdb` | `open_library`), `operation`, `outcome`,
  `resolution` (`linked` | `existing` | `created` | `ambiguous`), a **coarse
  latency bucket**, `retryCount`, and a safe `errorCategory`.

It **never** carries raw query text, ids, title/slug, user email, credentials,
descriptions, provider payloads, or vectors. Use `resolution` to watch canonical
de-duplication health (a spike in `ambiguous` means the deterministic resolver is
refusing to attach — investigate catalog data, not the code path) and `outcome` /
`errorCategory` for import reliability.

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

## Catalog Platform v1B — federated Explore operations

Federated external discovery on `/explore` (TMDB + Open Library) plus on-demand
materialization is wired but ships **off by default**. See
[ADR 0004](adr/0004-external-provider-catalog-ingestion.md) and the
[backend architecture](backend-architecture.md#catalog-platform-v1b--canonical-identity--federated-explore).

> **Not performed by this change.** The current change is **documentation-only
> and local-only**: hosted Supabase is **not** mutated, no Vercel variables are
> changed, nothing is deployed, and no hosted import or re-embedding is done.
> Migration `20260815120600` and its pgTAP are verified **locally** only. The
> procedure below is the **future** owner-controlled rollout, not a record of
> work already done.

### Kill switches — `EXTERNAL_CATALOG_ENABLED`, `TMDB_ENABLED`, `OPEN_LIBRARY_ENABLED`

Federation has a global **server-only kill switch** and per-provider flags. They
are **off by default** (except `OPEN_LIBRARY_ENABLED=true`): external discovery
runs **only** when `EXTERNAL_CATALOG_ENABLED` is truthy, the provider's flag is
truthy, **and** the relevant provider is configured.
It is **not** `NEXT_PUBLIC_`. To **roll back** federation immediately, unset it
(or set a falsey token) in the server environment: `/explore` reverts to its
exact **local-only** hybrid search — no external calls, no import forms, no
build/render impact. The materialization Server Action also re-checks the flag,
so a disabled flag rejects imports too.

### Future hosted rollout procedure (owner-controlled, forward-only)

Perform in order, out of band, with least privilege:

1. **Apply the migration (forward-only).** Push `20260815120600` to hosted
   Supabase the same way as prior forward-only pushes (`supabase db push`;
   **never** `db reset --linked`, **never** remote seed). Regenerate types
   (`npm run supabase:types`) and confirm no drift.
2. **Run hosted pgTAP** for the new canonical-identity assertions
   (`supabase/tests/database/media_external_ids.test.sql`).
3. **Set server-only variables in Vercel** (production/preview as desired):
   `EXTERNAL_CATALOG_ENABLED=true`, `OPEN_LIBRARY_ENABLED=true`, plus
   `OPEN_LIBRARY_CONTACT_EMAIL`.
4. **TMDB COMPLIANCE GATE:** Do **NOT** set `TMDB_ENABLED=true` in production
   (leave it unset or explicitly `false`) and do **NOT** add the
   `TMDB_API_READ_TOKEN` to Vercel production until you have confirmed
   appropriate permission/licensing by contacting TMDB through its official
   API licensing/support channel. Holding a read token is not proof of
   permission.
5. **Re-embed newly materialized rows** via the guarded, owner-controlled
   backfill so imported titles become semantically searchable (they are
   keyword-searchable immediately regardless):

   ```bash
   OPENAI_API_KEY=… npm run embed:catalog -- \
     --allow-remote --confirm-project-ref=<exact-project-ref>
   ```

### Read-only post-deployment SQL checks (SELECT-only, hosted DB)

```sql
-- 1) The migration is recorded in the remote ledger.
select version from supabase_migrations.schema_migrations
where version = '20260815120600';

-- 2) Catalog row counts by source (the original curated corpus should be 28).
select source, count(*) from public.media_items group by source order by source;

-- 3) The original 28 curated rows are unchanged (never duplicated/renamed).
select count(*) as favalog_rows from public.media_items where source = 'favalog';
--   expect 28

-- 4) Alias link counts (0 until the first import; each import adds one link).
select provider, kind, count(*)
from public.media_external_ids group by provider, kind order by provider, kind;

-- 5) The materialization RPC is SECURITY INVOKER, pinned empty search_path,
--    service_role-only EXECUTE.
select p.proname, p.prosecdef as security_definer, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'materialize_external_media';
--   expect security_definer = false and proconfig containing search_path=""

-- 6) RLS is enabled on the alias table (defence-in-depth).
select relrowsecurity from pg_class
where oid = 'public.media_external_ids'::regclass;
--   expect true
```

### Manual production verification (after enabling)

1. With the flag **off**, confirm `/explore` shows **no** external sections and
   behaves exactly as local-only.
2. With the flag **on** and a provider configured, run a committed query and
   confirm the separate, **attributed** "More movies & TV" / "More books"
   sections appear (server-rendered), while local results are unaffected.
3. Confirm a title that already exists in the catalog links to `/title/[slug]`
   and is **not** offered for import.
4. As a signed-in, onboarded user, import a new external title and confirm the
   redirect to its `/title/[slug]`, that Log/Rate/Review/Favorite/Add-to-list
   work, and that it is keyword-searchable immediately.
5. Confirm the imported title is **not** yet semantically matched until the
   guarded re-embed runs.
6. Confirm the TMDB attribution notice + logo and the Open Library credit render
   with external results.
7. In telemetry, confirm `catalog_materialize` shows the expected `resolution` /
   `outcome` and **no** query text or ids.

### Rollback

Unset (or set falsey) `EXTERNAL_CATALOG_ENABLED` → `/explore` reverts to
local-only immediately; imports are rejected. The alias table and RPC remain in
place (harmless when the flag is off). No data migration is needed to disable.

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
- **External federation (v1B):** when `EXTERNAL_CATALOG_ENABLED` is on, the
  provider flag is on, and a provider is configured, a committed Explore query
  is sent **server-side** to TMDB / Open Library to fetch results — a
  provider-facing request, the
  deliberate cost of federated discovery. Favalog's own `catalog_search` and
  `catalog_materialize` events stay query-free (safe metadata only). With the
  flag off/unset, no external request is made.
- `requestId` correlates server log lines only; it is **not** sent to product
  analytics (which stays low-cardinality/anonymous).
- **Retention:** server logs and Vercel Analytics follow the hosting platform’s
  defaults; because no personal data is emitted, retention risk is low. Owners
  should still set a **short, explicit** retention for operational logs and
  confirm Analytics retention — this repo does not configure either.

## Incident log

### 2026-08-31 — E2E fixtures briefly wrote to hosted Supabase

**What happened.** While first bringing up the deterministic Catalog Platform
v1B fixtures E2E suite, the mutation-capable Playwright run inherited this
repo's `.env.local`, which points at the **hosted** Supabase project
(`bbfutvrzdrutuijmslpl.supabase.co`) rather than a local stack. Next.js and the
service-role admin helper therefore resolved the **hosted** target, so two early
fixture runs provisioned a test account and materialized one fixture title
against production instead of local.

**Exact temporary scope.** The known fixture identity only: the auth user
`e2e-materialize@example.com` (username `e2ematerialize`) and one materialized
fixture catalog row (`source='tmdb'`, `external_id='movie:999001'`, title
"Fixture Voyager Chronicles"). No real user data was modified.

**Cleanup performed.** The specific fixture user and the single fixture
`media_items` row were deleted by their exact known identity (targeted deletes,
never a broad wipe) at the time of discovery.

**Read-only verification (2026-08-31).** A strictly read-only, SELECT/`head`
audit against the hosted project (using the exact fixture identity, not broad
scans) confirmed **zero** remaining fixture `media_items`, `media_external_ids`,
search documents, fixture auth user, fixture profile, and therefore no
fixture-owned diary entries / reviews / favorites / lists / list items. The
catalog baseline is unchanged: `media_items` total **28**, `media_external_ids`
**0** (the v1B alias table remains local-only), and `media_search_documents`
(the compatible embedding corpus) **28**. No additional mutation was performed
because no leftover row was found.

**Permanent remediation (loopback-only).** Every mutation-capable E2E entry
point is now pinned to a **local loopback** Supabase target and can never
implicitly load `.env.local`:

- A single shared, unit-tested guard (`scripts/lib/local-supabase-target.mjs`)
  structurally parses each Supabase URL and accepts only unambiguous loopback
  hosts (`127.0.0.1` / `localhost` / `::1`), rejecting missing, malformed,
  quoted, non-HTTP(S), user-info-obscured, and remote URLs, and verifying all
  relevant URLs agree on the local target.
- The protected runner (`scripts/run-e2e-local.mjs`) resolves LOCAL credentials
  from the running local stack (`supabase status`) or an explicitly-ignored
  `.env.e2e.local`, hard-verifies loopback **before** building, starting
  Next.js, or executing tests, and injects them so they win over `.env.local`.
  It drives **all** mutation-capable suites — the ordinary `configured` suite
  and the fixtures suites — and there is **no** override that permits a hosted
  target.
- The fixtures admin client (`e2e/fixtures/admin.ts`) re-asserts loopback before
  creating a service-role client (i.e. before provisioning a user or writing any
  row), and `playwright.config.ts` refuses to configure any non–`no-env` suite
  when a present Supabase URL is not loopback.
- The `no-env` suite (`scripts/run-e2e-no-env.mjs`) explicitly **removes**
  Supabase/provider credentials rather than inheriting them.

**Secret exposure.** None. No secrets were printed, committed, or logged during
the incident, the cleanup, or the read-only audit; only counts and the already
known non-secret fixture identifiers were emitted.

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
  Embedding is restricted to an allowlist (`favalog`, `openlibrary`) via
  `lib/search/embedding-source-policy.ts`; TMDB titles are excluded.
- **Contact TMDB:** Contact TMDB's official API licensing/support channel (e.g.
  https://www.themoviedb.org/talk) to confirm AI/ML-use permission before
  enabling TMDB in production.
