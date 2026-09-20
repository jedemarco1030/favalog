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

The scheduler is **inert until the owner explicitly activates it** (see
[Activation](#activation)). Adding the file does not start refreshing anything.

## Design summary

- **Triggers**: manual `workflow_dispatch` (with an optional `dry_run` input)
  and a daily `schedule` (off-peak cron).
- **Activation gate**: the single `refresh` job is guarded by
  `if: ${{ vars.CATALOG_REFRESH_ENABLED == 'true' }}`. The repository/environment
  variable **defaults to unset (disabled)**, so scheduled and dispatched runs
  no-op at the job guard until the owner sets it to `true`.
- **Protected secrets + explicit target**: all credentials come from GitHub
  Environment secrets, and the hosted project is pinned with
  `--confirm-project-ref` so the CLI's remote-write guard authorizes the write
  only when the resolved Supabase URL matches that exact ref. There is no
  inferred project.
- **Minimal permissions**: `permissions: contents: read` only.
- **Overlap prevention**: a workflow-level `concurrency` group with
  `cancel-in-progress: false` serializes runs, on top of the per-identity
  `pg_advisory_xact_lock` each refresh RPC already holds.
- **Bounded refresh → bounded stale-embedding backfill**: the refresh step runs
  first (bounded batch, oldest-due-first), then the embedding step regenerates
  only missing/stale eligible vectors (also bounded). The embedding step is
  skipped on a dry run.
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
        description: "Read-only preview (provider reads only; no DB or embedding writes)"
        type: boolean
        default: false
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

jobs:
  refresh:
    name: Bounded refresh + stale-embedding backfill
    runs-on: ubuntu-latest
    # ACTIVATION GATE. Stays OFF until the owner sets the repository (or
    # environment) variable CATALOG_REFRESH_ENABLED to the string "true".
    # Until then every scheduled and dispatched run resolves to a no-op here.
    if: ${{ vars.CATALOG_REFRESH_ENABLED == 'true' }}
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

      # STEP 1 — bounded provider refresh of already-imported TMDB rows.
      # Provider activation is set inline (fail-closed if the token is absent).
      # The remote-write guard requires BOTH --allow-remote and a matching
      # --confirm-project-ref; a dry run stays write-free regardless.
      - name: Bounded provider refresh
        env:
          EXTERNAL_CATALOG_ENABLED: "true"
          TMDB_ENABLED: "true"
          TMDB_API_READ_TOKEN: ${{ secrets.TMDB_API_READ_TOKEN }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
        run: |
          npm run refresh:catalog -- \
            ${{ inputs.dry_run && '--dry-run' || '' }} \
            --allow-remote \
            --confirm-project-ref="${{ secrets.SUPABASE_PROJECT_REF }}" \
            --provider tmdb \
            --limit 200 \
            --concurrency 4 \
            --freshness-days 7

      # STEP 2 — bounded regeneration of missing/stale eligible embeddings.
      # Skipped on a dry run (no writes to preview). TMDB_EMBEDDING_ENABLED must
      # be "true" for TMDB rows to be embedding-eligible (Section 1 control);
      # leave it unset to keep TMDB rows out of embeddings.
      - name: Bounded stale-embedding backfill
        if: ${{ !inputs.dry_run }}
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

| Name                      | Value  | Purpose                                                    |
| ------------------------- | ------ | ---------------------------------------------------------- |
| `CATALOG_REFRESH_ENABLED` | `true` | Master activation switch. Absent/anything-else = disabled. |

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

## Activation

The scheduler ships **disabled**. To activate, the owner:

1. Adds `.github/workflows/catalog-refresh.yml` (above).
2. Configures the variables and secrets (above), leaving
   `CATALOG_REFRESH_ENABLED` unset for a first dry-run rehearsal.
3. Rehearses read-only: **Actions → Catalog metadata refresh → Run workflow**,
   with `dry_run = true`. (While `CATALOG_REFRESH_ENABLED` is unset the job is
   skipped; set it to `true` first if you want the dry run to actually execute
   the refresh CLI in `--dry-run` mode.)
4. Sets `CATALOG_REFRESH_ENABLED=true` to allow live scheduled runs.
5. Confirms the first scheduled run succeeds (structured summary, no errors).

## Disabling (independently)

- **Disable the schedule only** (keep provider requests possible for manual
  imports): set `CATALOG_REFRESH_ENABLED` to anything other than `true` (or
  delete the variable). The daily job then no-ops at the guard. Manual TMDB
  discovery/import via the app flags (`EXTERNAL_CATALOG_ENABLED` / `TMDB_ENABLED`)
  is unaffected.
- **Disable provider requests entirely** (app + scheduler): turn off
  `TMDB_ENABLED` (and/or `EXTERNAL_CATALOG_ENABLED`) in the app environment. The
  refresh CLI is fail-closed — a disabled provider makes **no** request and the
  scheduled run is a clean no-op even if `CATALOG_REFRESH_ENABLED` is still
  `true`.
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

The scheduler is additive and owner-gated. Nothing on the branch runs it, and it
cannot act until the owner adds the file, sets the secrets, and flips
`CATALOG_REFRESH_ENABLED=true`. The underlying CLIs, RPCs, and guards are already
committed and covered by the unit and pgTAP suites on this branch.
