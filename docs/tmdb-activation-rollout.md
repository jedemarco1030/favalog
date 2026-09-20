# TMDB activation & scheduled metadata refresh — owner-controlled rollout runbook

- **Status:** Activation readiness implemented and locally verifiable; **production
  activation pending** (owner-controlled).
- **Scope:** The exact, ordered procedure to activate TMDB movie/TV discovery
  and import in production, keep imported metadata fresh with the bounded
  periodic refresh worker, and regenerate affected embeddings — without deleting
  or rewriting any user records.
- **Related:** [ADR 0004](adr/0004-external-provider-catalog-ingestion.md),
  [AI Discovery operations](ai-discovery-operations.md),
  [scheduler handoff](ci/catalog-refresh-scheduler-handoff.md),
  [refresh lifecycle CI handoff](ci/refresh-lifecycle-ci-handoff.md).

This runbook is written so that **nothing here runs automatically**. Every step
is an explicit, owner-authorized action against hosted infrastructure. Read-only
production checks are kept separate from owner-authorized imports, refreshes, and
embedding writes.

## What is true right now — do not conflate these

1. **Owner-provided TMDB clarification (context, not blanket approval).** The
   owner supplied evidence (a screenshot of TMDB staff member Travis Bell) that
   TMDB considers **periodically refreshed cached metadata** acceptable and that
   **embeddings for semantic search** are not "AI training" in the described use
   case. This is owner-provided clarification for **those specific uses** — it is
   **not** blanket approval of unrelated uses or commercial licensing, and it is
   **not** a TMDB-mandated refresh interval. No discussion URL and no exact
   TMDB-prescribed interval are asserted anywhere in this repo.
2. **Locally implemented and verified activation readiness.** The provider
   gating, canonical-identity preservation, bounded periodic refresh worker,
   embedding-consistency handling, executable scheduler (as an applyable
   workflow file), and the test/CI coverage are implemented on this branch and
   verifiable locally with the commands in [Verifying locally](#verifying-locally).
3. **Production activation is still pending.** `TMDB_ENABLED` remains **false**
   in hosted production. No hosted secret has been set, no hosted mutation has
   been performed, nothing has been deployed, and the schedule is inert. Turning
   any of this on is exclusively the steps below.

## Historical vs. currently measured counts

- The **2026-09-01** production observation (29 catalog titles / 29 compatible
  OpenAI embedding documents; the 28 curated titles plus Open Library Work
  `OL893414W` → canonical **Dune**) is **point-in-time historical evidence**,
  not a live measurement. Do not restate it as the current count.
- After the rollout below imports movie/TV titles and re-embeds them, the
  catalog and compatible-embedding counts **will change**. Record the new
  numbers from the read-only checks in step 6 as a **new dated observation**;
  keep the historical figure alongside it rather than overwriting history.

## The freshness target is an engineering default

The refresh worker uses a **7-day** freshness target with **daily** due checks.
This is an **engineering default chosen by Favalog**, documented as such, and is
**not** a TMDB-prescribed interval. It is tunable via `--freshness-days` and the
schedule cron without code changes.

## Prerequisites

- Owner access to the hosted Supabase project (service-role key, project ref)
  and the Vercel project environment.
- A maintainer with the GitHub `workflows` permission to add the scheduler file
  (the v0 GitHub App cannot commit under `.github/workflows/`; see the
  [scheduler handoff](ci/catalog-refresh-scheduler-handoff.md)).
- TMDB v4 read token (`TMDB_API_READ_TOKEN`) and confirmed permission for the
  clarified uses above.
- `OPENAI_API_KEY` for the embedding backfill.

## Supported rollout commands (perform in order, out of band, least privilege)

All hosted writes go through the operator CLIs, which enforce the remote-write
guard: a live hosted write requires **both** `--allow-remote` **and**
`--confirm-project-ref=<exact-ref>` matching the ref resolved from the Supabase
URL. `--dry-run` (refresh) and remote dry runs (embed) stay write-free. Replace
`<ref>` with the hosted project ref (the `<ref>` in `https://<ref>.supabase.co`).

### 1. Apply the forward-only migrations

Push the refresh-lifecycle migrations the same way as prior forward-only pushes
(`supabase db push`; **never** `db reset --linked`, **never** a remote seed).
The migrations that back this feature are:

- `20260815120700_refresh_external_media_provider_metadata.sql` — the
  `service_role`-only `refresh_external_media(...)` RPC and provenance columns.
- `20260815121000_external_media_refresh_lifecycle.sql` — the
  `mark_external_media_refresh_failed(...)` / `mark_external_media_removed(...)`
  RPCs and `provider_checked_at` / `provider_removed_at` bookkeeping.

Then regenerate types and confirm no drift:

```bash
supabase db push
npm run supabase:types   # must produce no diff
```

Do **not** edit any already-applied migration.

### 2. Deploy the application and refresh tooling

Deploy the current branch to Vercel so the reconciled gating/attribution and the
committed refresh/embed CLIs are live. Deployment alone changes no behavior:
every provider path stays gated off until step 4.

### 3. Configure protected secrets, project identity, and refresh controls

- **Vercel (server-only, never `NEXT_PUBLIC_`)**: `TMDB_API_READ_TOKEN`,
  `SUPABASE_SECRET_KEY`, and keep `EXTERNAL_CATALOG_ENABLED=true`. Leave
  `TMDB_ENABLED` unset/`false` for now.
- **GitHub `catalog-refresh` environment** (for the scheduler; see the handoff):
  secrets `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF`,
  `TMDB_API_READ_TOKEN`, `OPENAI_API_KEY`; variable `CATALOG_REFRESH_ENABLED`
  left **unset** (disabled) until step 8.

Never place the service-role key, project password, or the TMDB token in any
`NEXT_PUBLIC_` variable or client bundle.

### 4. Enable TMDB discovery/import under the existing flags

Set `TMDB_ENABLED=true` in the server environment (with
`EXTERNAL_CATALOG_ENABLED=true` already set and the token configured). Federated
Explore then offers TMDB movie/TV results and identity-only import. Disabled or
unconfigured TMDB continues to make no provider requests.

### 5. Verify attribution and import one movie and one TV title

As a signed-in, onboarded user on the deployed app:

- Confirm the mandatory TMDB attribution notice and logo render with external
  results (search, and the title/credits surfaces).
- Import one movie and one TV title. Confirm each redirects to `/title/[slug]`,
  is keyword-searchable immediately, and that Log/Rate/Review/Favorite/Add-to-list
  work. Confirm a movie and a TV show with the **same numeric TMDB id** remain
  **distinct** canonical rows, and that an already-existing title links out
  rather than offering a duplicate import.

### 6. Generate eligible embeddings and verify retrieval

TMDB rows are embedding-eligible only when the Section 1 control
`TMDB_EMBEDDING_ENABLED=true` is set for the embedding run. Run the guarded,
owner-controlled backfill, then verify:

```bash
TMDB_EMBEDDING_ENABLED=true OPENAI_API_KEY=… npm run embed:catalog -- \
  --allow-remote --confirm-project-ref=<ref>
```

- Confirm `compatible_embedding_count` grew to match the eligible corpus
  (record this as a **new dated observation** — see
  [Historical vs. currently measured counts](#historical-vs-currently-measured-counts)).
- Confirm semantic and keyword retrieval both return the imported titles on
  `/explore`, and that keyword search still works if semantic is disabled.

### 7. Run refresh and confirm an unchanged repeat is idempotent

Preview first (read-only), then run a live bounded refresh, then re-run and
confirm the second pass changes nothing:

```bash
# Read-only preview (provider reads only; no DB or embedding writes)
npm run refresh:catalog -- --dry-run \
  --allow-remote --confirm-project-ref=<ref> \
  --provider tmdb --freshness-days 7

# Live bounded refresh (oldest-checked-first, bounded batch + concurrency)
npm run refresh:catalog -- \
  --allow-remote --confirm-project-ref=<ref> \
  --provider tmdb --limit 200 --concurrency 4 --freshness-days 7
```

- Confirm the structured summary reports `checked` / `changed` / `unchanged` /
  `unavailable` / `failed` / `remaining due`.
- Immediately re-run the live command. Because freshness was just advanced, the
  second run should report **0 due** (or only genuinely changed rows), an
  unchanged successful refresh must **not** churn content hashes or embeddings,
  and no media or user reference is deleted on a provider error.

### 8. Activate the periodic schedule and confirm its first successful run

Follow the [scheduler handoff](ci/catalog-refresh-scheduler-handoff.md):

1. A `workflows`-scoped maintainer adds `.github/workflows/catalog-refresh.yml`.
2. Configure the `catalog-refresh` environment secrets/variables (step 3).
3. Rehearse with **Run workflow → `dry_run = true`** (set
   `CATALOG_REFRESH_ENABLED=true` first if you want the dry run to actually
   execute the CLI in `--dry-run` mode).
4. Set `CATALOG_REFRESH_ENABLED=true` to allow live scheduled runs.
5. Confirm the first scheduled run succeeds (redacted structured summary, no
   errors). Scheduled writes retain the CLI's target-confirmation guard — the
   run refuses if `SUPABASE_PROJECT_REF` does not match the URL's ref.

### 9. Disable / recovery steps (never delete user records)

- **Disable the schedule only:** set `CATALOG_REFRESH_ENABLED` to anything other
  than `true` (or delete it). Manual TMDB import via the app flags is unaffected.
- **Disable provider requests entirely:** turn off `TMDB_ENABLED` (and/or
  `EXTERNAL_CATALOG_ENABLED`). The refresh CLI is fail-closed — a disabled
  provider makes no request and the scheduled run is a clean no-op.
- **What survives disabling:** every already-imported TMDB title, its slug,
  aliases, canonical id, and all user diary/review/list/favorite references stay
  intact and keep resolving; metadata simply stops being refreshed and goes
  stale until re-enabled. Disabling does **not** retract metadata already
  delivered to browsers, and rollback does **not** delete user records.
- **Detecting overdue refreshes:** run the step-7 `--dry-run` command; the
  summary's `remaining due` is the backlog. A persistently growing backlog means
  the schedule is not keeping up (raise `--limit` or investigate failures); a
  sustained `failed`/`unavailable` count points at provider/credential issues.

## Authoritative removals vs. transient outages

The worker separates a **confirmed provider removal** from a **transient
outage**. A single timeout or `429` never marks a record removed or successfully
refreshed; transient failures back off (respecting `Retry-After`) and leave the
row due for a later run. Only a confirmed authoritative removal routes through
`mark_external_media_removed(...)`, which suppresses the provider content while
**retaining** the canonical identity and every user reference. Favalog never
serves removed provider content indefinitely and never hard-deletes user-owned
rows on a provider error.

## Verifying locally

The full matrix (no live TMDB/OpenAI credentials or hosted DB required for the
no-environment jobs; seeded jobs require local Supabase) is:

```bash
npm run validate:full   # format + lint + typecheck + unit/coverage + build + e2e
npm run db:test         # pgTAP (constraints, RLS, refresh RPCs)
npm run supabase:types  # regenerate; must produce no diff
```

Provider behavior is exercised with deterministic fixtures (the CLIs' `--fake`
provider registry) and local Supabase; CI does not call live providers.

## Constraints honored by this rollout

- Forward-only migrations only; no edits to applied migrations.
- RLS is not weakened; the service-role key and other privileged credentials
  never reach the browser and are not required for normal startup or static
  build.
- Privileged operator access (refresh/embed CLIs, `service_role` RPCs) stays
  outside ordinary browser/user read paths.
- This document changes no hosted secret, Vercel variable, or schedule state by
  itself; it is the instruction set for the owner to perform those actions.
