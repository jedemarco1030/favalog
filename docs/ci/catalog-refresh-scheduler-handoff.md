# CI handoff: catalog metadata refresh scheduler

Section 5 (the executable scheduling path for periodic provider-metadata
refresh) is delivered here as an **applyable workflow file**, not committed to
`.github/workflows/` directly, because the v0 GitHub App lacks the `workflows`
permission (`refusing to allow a GitHub App to create or update workflow ...
without 'workflows' permission`). A maintainer with `workflows` scope must add
the file below. Everything the workflow drives — the refresh CLI
(`scripts/refresh-catalog.mjs`) and the embedding CLI
(`scripts/embed-catalog.mjs`), their remote-write guards, activation flags, and
redacted run summaries — is already committed and tested on this branch.

**Scheduled** writes stay **inert until the owner explicitly activates them**
(see [Activation](#activation)). Adding the file does not start any scheduled
refresh. Manual `workflow_dispatch` is available immediately for rehearsal and
for exercising a single live refresh, and it **defaults to a read-only preview**.

## Design summary

- **Triggers**: manual `workflow_dispatch` (with `dry_run` and `limit` inputs)
  and a daily `schedule` (off-peak cron).
- **Split activation gate** — manual and scheduled runs are gated differently:
  - Manual `workflow_dispatch` **always runs**, regardless of
    `CATALOG_REFRESH_ENABLED`, so an operator can rehearse read-only or exercise
    one live refresh **without turning on scheduled writes**.
  - The daily `schedule` runs **only** when the owner has set the
    repository/environment variable `CATALOG_REFRESH_ENABLED` to the string
    `true`. It defaults to unset (disabled), so scheduled runs no-op at the job
    guard until the owner opts in.
- **Dry run is the manual default and is fully write-free.** `dry_run` defaults
  to `true` on manual dispatch. A dry run passes `--dry-run` to the refresh CLI
  (provider reads only, no DB writes) **and skips the embedding-generation step
  entirely** — no database-writing step and no embedding generation runs in a
  dry run. Scheduled runs are always live (never dry).
- **Provider + embedding flags are set inline in the workflow.** GitHub Actions
  does **not** inherit Vercel project environment variables, so
  `EXTERNAL_CATALOG_ENABLED`, `TMDB_ENABLED`, and `TMDB_EMBEDDING_ENABLED` are
  configured explicitly on the steps that need them (fail-closed if a required
  credential is absent).
- **Protected secrets + explicit target**: all credentials come from the
  `catalog-refresh` GitHub **Environment**, and the hosted project is pinned with
  `--confirm-project-ref` so the CLI's remote-write guard authorizes the write
  only when the resolved Supabase URL matches that exact ref. There is no
  inferred project.
- **Minimal permissions**: `permissions: contents: read` only.
- **Bounded execution**: every run is bounded by `--limit` (dispatch may narrow
  it, e.g. to `1`; the schedule uses the default batch) and `--concurrency`.
- **Overlap prevention**: a workflow-level `concurrency` group with
  `cancel-in-progress: false` serializes runs, on top of the per-identity
  `pg_advisory_xact_lock` each refresh RPC already holds.
- **Redacted failure reporting**: both CLIs emit structured, redacted run
  summaries (checked / changed / unchanged / unavailable / failed / remaining
  due). No credentials or raw provider payloads are logged.

## The workflow file

Create `.github/workflows/catalog-refresh.yml` with exactly this content:

```yaml
name: Catalog metadata refresh

on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: "Read-only preview (provider reads only; NO database or embedding writes)"
        type: boolean
        default: true
      limit:
        description: "Max due rows to process this run (1..500). Set to 1 to exercise a single newly-imported record."
        type: string
        default: "200"
  schedule:
    # Daily, off-peak, and deliberately off the top of the hour to avoid
    # contention. Cron is UTC. This is an ENGINEERING default (daily checks for
    # a 7-day freshness target), NOT a TMDB-prescribed interval.
    - cron: "17 4 * * *"

# Overlap prevention: never let two refresh runs proceed concurrently. We do
# NOT cancel an in-flight run — a partial refresh is safe and resumable, and
# cancelling mid-batch wastes the provider reads already spent.
concurrency:
  group: catalog-refresh
  cancel-in-progress: false

# Least privilege: the workflow only reads the repository to run the CLIs.
permissions:
  contents: read

env:
  NODE_VERSION: "22"
  # Manual dispatch defaults to a read-only preview (dry_run input default true);
  # any non-dispatch trigger (the schedule) is ALWAYS live.
  DRY_RUN: ${{ github.event_name == 'workflow_dispatch' && inputs.dry_run || 'false' }}
  # Bounded batch size. Dispatch may narrow it (e.g. "1"); the schedule and any
  # dispatch that leaves the field at its default use 200. The CLI re-clamps to
  # [1, 500] server-side; a caller can only narrow, never widen.
  REFRESH_LIMIT: ${{ (github.event_name == 'workflow_dispatch' && inputs.limit) || '200' }}

jobs:
  refresh:
    name: Bounded refresh + stale-embedding backfill
    runs-on: ubuntu-latest
    # SPLIT ACTIVATION GATE.
    #  - Manual `workflow_dispatch` ALWAYS runs, so an operator can rehearse a
    #    read-only preview or exercise ONE live refresh WITHOUT enabling
    #    scheduled writes.
    #  - The daily `schedule` runs ONLY when the owner has set the repository
    #    (or environment) variable CATALOG_REFRESH_ENABLED to the string "true".
    #    Until then every scheduled run resolves to a no-op here.
    if: ${{ github.event_name == 'workflow_dispatch' || vars.CATALOG_REFRESH_ENABLED == 'true' }}
    # Bind the protected secrets to a named environment so they can carry
    # required reviewers / branch protections if desired.
    environment: catalog-refresh
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      # Observability only: makes the resolved mode obvious in the run log.
      - name: Report run mode
        run: 'echo "event=${{ github.event_name }} dry_run=${{ env.DRY_RUN }} limit=${{ env.REFRESH_LIMIT }}"'

      # STEP 1 — bounded provider refresh of already-imported TMDB rows.
      # Provider + external-catalog activation is set INLINE here because GitHub
      # Actions does NOT inherit Vercel project environment variables. Fail-closed
      # if the token is absent. The remote-write guard requires BOTH --allow-remote
      # and a matching --confirm-project-ref; --dry-run stays write-free regardless.
      - name: Bounded provider refresh
        env:
          EXTERNAL_CATALOG_ENABLED: "true"
          TMDB_ENABLED: "true"
          TMDB_API_READ_TOKEN: ${{ secrets.TMDB_API_READ_TOKEN }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
        run: |
          npm run refresh:catalog -- \
            ${{ env.DRY_RUN == 'true' && '--dry-run' || '' }} \
            --allow-remote \
            --confirm-project-ref="${{ secrets.SUPABASE_PROJECT_REF }}" \
            --provider tmdb \
            --limit "${{ env.REFRESH_LIMIT }}" \
            --concurrency 4 \
            --freshness-days 7

      # STEP 2 — bounded regeneration of missing/stale eligible embeddings.
      # SKIPPED ENTIRELY on a dry run: a dry run performs NO database writes and
      # NO embedding generation. TMDB_EMBEDDING_ENABLED is set inline (Vercel env
      # is not inherited) and must be "true" for TMDB rows to be embedding-eligible
      # (Section 1 control); leave it unset to keep TMDB rows out of embeddings.
      - name: Bounded stale-embedding backfill
        if: ${{ env.DRY_RUN != 'true' }}
        env:
          TMDB_EMBEDDING_ENABLED: "true"
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          npm run embed:catalog -- \
            --allow-remote \
            --confirm-project-ref="${{ secrets.SUPABASE_PROJECT_REF }}" \
            --limit 200
```

## Required configuration (owner-controlled)

Set these in the repository under **Settings → Secrets and variables → Actions**,
scoped to the `catalog-refresh` environment so they inherit its protections.

### Variables

| Name                      | Value  | Purpose                                                                                                                           |
| ------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `CATALOG_REFRESH_ENABLED` | `true` | Enables the daily **scheduled** run. Absent/anything-else = scheduled runs no-op. Does **not** affect manual `workflow_dispatch`. |

### Secrets

| Name                   | Value                                                         |
| ---------------------- | ------------------------------------------------------------- |
| `SUPABASE_URL`         | Hosted project URL, e.g. `https://<ref>.supabase.co`.         |
| `SUPABASE_SECRET_KEY`  | Service-role key (server-only; never exposed to browsers).    |
| `SUPABASE_PROJECT_REF` | The exact project ref from the URL, e.g. `<ref>`. Must match. |
| `TMDB_API_READ_TOKEN`  | Server-only TMDB v4 read token.                               |
| `OPENAI_API_KEY`       | Embedding key (only used by the backfill step).               |

`SUPABASE_PROJECT_REF` must equal the project ref the CLI resolves from
`SUPABASE_URL` (the `<ref>` in `https://<ref>.supabase.co`). If it does not
match, the remote-write guard refuses the run — this is the intended
target-confirmation safeguard, not a bug.

Provider and embedding activation flags (`EXTERNAL_CATALOG_ENABLED`,
`TMDB_ENABLED`, `TMDB_EMBEDDING_ENABLED`) are **not** configured here — GitHub
Actions does not inherit Vercel environment variables, so the workflow sets them
inline on the steps that need them (see the YAML above).

## Activation

The **scheduler** ships disabled; manual dispatch is available immediately (and
defaults to a write-free preview). Recommended order:

1. Add `.github/workflows/catalog-refresh.yml` (above) and configure the
   variables and secrets, leaving `CATALOG_REFRESH_ENABLED` **unset**.
2. **Read-only rehearsal (no writes):** **Actions → Catalog metadata refresh →
   Run workflow**, leaving `dry_run = true` (the default). The job runs (manual
   dispatch is always allowed), the refresh CLI executes in `--dry-run` mode
   (provider reads only), and the embedding step is skipped. Confirm the
   structured summary and `remaining due` backlog look sane.
3. **Single live refresh of one record (optional, no scheduling):** see
   [Exercising one real refresh](#exercising-one-real-refresh-of-a-newly-imported-record)
   below. This still does not require `CATALOG_REFRESH_ENABLED`.
4. **Enable scheduled runs:** set `CATALOG_REFRESH_ENABLED=true`. The daily
   `schedule` then performs live bounded refreshes.
5. Confirm the first scheduled run succeeds (structured summary, no errors).

## Exercising one real refresh of a newly-imported record

An **immediate rerun that reports zero due records only proves scheduling
eligibility** — it does not prove that a metadata refresh was actually
exercised. To exercise a genuine refresh RPC against a real row, rely on the
freshness lifecycle:

- `materialize_media_item(...)` records `synced_at` but **leaves
  `provider_checked_at` NULL** — that column is only ever stamped by a successful
  refresh. The due filter treats `provider_checked_at IS NULL` as **due**, and
  `selectDue` orders `provider_checked_at asc nulls first`, so a freshly imported
  row is immediately due and sorts to the **front** of the batch.
- There is intentionally no per-record targeting flag, and `--freshness-days` is
  clamped to `>= 1` (you cannot pass `0` to force everything due). The
  NULL-checked-at ordering above is the supported mechanism.

Supported procedure (does **not** enable scheduling):

1. Import exactly one new TMDB record through the normal app import path, so the
   catalog gains a single row with `provider_checked_at = NULL`.
2. **Actions → Catalog metadata refresh → Run workflow** with **`dry_run = false`**
   and **`limit = 1`**. Manual dispatch is allowed while
   `CATALOG_REFRESH_ENABLED` is still unset, so scheduled writes stay off.
3. Because the NULL-checked row sorts first, the `--limit 1` live run calls the
   `refresh_external_media` RPC on exactly that row and performs a genuine
   refresh — the summary shows `checked` ≥ 1 with the row classified `changed`
   or `unchanged`, `provider_checked_at` gets stamped, and `remaining due`
   decreases. That is proof the refresh path executed, not merely that a run was
   eligible.

## Disabling (independently)

- **Disable the schedule only** (keep manual dispatch and manual imports
  possible): set `CATALOG_REFRESH_ENABLED` to anything other than `true` (or
  delete the variable). The daily job then no-ops at the guard. Manual
  `workflow_dispatch` and app-side TMDB discovery/import
  (`EXTERNAL_CATALOG_ENABLED` / `TMDB_ENABLED`) are unaffected.
- **Disable provider requests entirely** (app + scheduler): turn off
  `TMDB_ENABLED` (and/or `EXTERNAL_CATALOG_ENABLED`) in the app environment. The
  refresh CLI is fail-closed — a disabled provider makes **no** request and the
  run is a clean no-op even if `CATALOG_REFRESH_ENABLED` is still `true`.
- **Hard stop**: disable the workflow from the Actions tab, or remove the file.

## What happens to already-imported titles when flags are disabled

Disabling the flags stops **new** provider requests and **future** refreshes; it
does not delete or hide anything already imported. Previously materialized TMDB
titles, their slugs, aliases, canonical IDs, and all user diary/review/list/
favorite references remain intact and keep resolving. Their metadata simply
stops being refreshed and will go stale until refresh is re-enabled. Disabling
does **not** retract metadata already delivered to browsers.

## Detecting overdue refreshes

A refresh is "due" when `provider_checked_at` is null or older than the
freshness window (default 7 days). To see the current backlog without writing
anything, run the refresh CLI in dry-run mode against the hosted project (owner
credentials, read-only):

```bash
npm run refresh:catalog -- --dry-run \
  --allow-remote --confirm-project-ref=<ref> \
  --provider tmdb --freshness-days 7
```

The summary's `remaining due` count is the overdue backlog. A persistently large
or growing backlog across daily runs indicates the schedule is not keeping up
(raise `--limit`, or investigate failures in the run logs). A sustained
`failed`/`unavailable` count points at provider or credential issues — inspect
the redacted summaries; they never contain secrets or raw payloads.

## Why this is safe to defer

The scheduler is additive and owner-gated. Nothing on the branch runs a
scheduled refresh, and the daily trigger cannot act until the owner adds the
file, sets the secrets, and flips `CATALOG_REFRESH_ENABLED=true`. Manual
dispatch defaults to a write-free preview and requires an explicit
`dry_run = false` plus the target-confirmation guard to write anything. The
underlying CLIs, RPCs, and guards are already committed and covered by the unit
and pgTAP suites on this branch.
