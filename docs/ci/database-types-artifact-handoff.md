# Database types: browser-only verification & artifact handoff

This handoff makes `lib/database.types.ts` verifiable and fixable **without
WebStorm or local Docker**. It reuses the existing `database` CI job (disposable
local Supabase → migrations → pgTAP → type generation) and adds a downloadable
artifact so the regenerated file survives a failing drift check.

It is scoped to the **CI type-drift handoff only**. It requires **no hosted
migration, no production deploy, and no TMDB / refresh-scheduler activation** —
those remain separate, owner-controlled steps.

## Why this is needed

The v0 GitHub App token lacks the `workflows` permission, so v0 **cannot push
changes to `.github/workflows/`**. The workflow patch below must be applied by a
maintainer through GitHub's browser editor (or any local Git client with
`workflows` scope). Everything after the patch — retrieving the artifact and
committing the generated file — v0 **can** do automatically with its existing
token (verified: `gh api .../artifacts` and `gh run download` both work).

## One-time browser setup: apply the workflow patch

Apply this on the existing working branch **`v0/db-types-artifact-handoff`**,
which already contains every required migration fix (including the corrective
`supabase/migrations/20260815121100_reconcile_search_overloads.sql`). Applying
the patch here keeps the workflow change and the schema fixes on the same branch
so the very first CI run exercises the reconciled migrations. Do **not** create a
separate branch off `main` for this — a branch without the reconcile migration
would regenerate types against the old ambiguous overloads.

1. Open the file in GitHub's browser editor:

   ```
   https://github.com/jedemarco1030/favalog/edit/v0/db-types-artifact-handoff/.github/workflows/ci.yml
   ```

2. Make exactly the changes in the diff below, inside the `database:` job.
3. Commit to `v0/db-types-artifact-handoff` and open a PR (if one is not already
   open).

### Exact patch (`.github/workflows/ci.yml`)

```diff
@@ jobs:
   database:
     name: Supabase schema & RLS tests
     runs-on: ubuntu-latest
+    # Identify generated-type artifacts by the SOURCE commit — the real branch
+    # head, NEVER the ephemeral pull_request merge commit. On pull_request,
+    # `github.sha` is that throwaway merge commit; `pull_request.head.sha` is the
+    # branch head where the regenerated file must ultimately be committed. On
+    # push, both are the pushed commit.
+    env:
+      SOURCE_SHA: ${{ github.event.pull_request.head.sha || github.sha }}
     steps:
-      - uses: actions/checkout@v4
+      # Check out the SOURCE commit itself, not the default merge ref. Migrations
+      # and generated types must reflect the exact code under review, and the
+      # artifact must be reproducible from `SOURCE_SHA`.
+      - uses: actions/checkout@v4
+        with:
+          ref: ${{ github.event.pull_request.head.sha || github.sha }}
+
+      # Fail loudly unless the checkout is EXACTLY the source commit, so a
+      # mislabelled artifact can never be produced from a merge or other commit.
+      - name: Assert checkout is at source commit
+        run: |
+          HEAD_SHA="$(git rev-parse HEAD)"
+          echo "HEAD=$HEAD_SHA SOURCE_SHA=$SOURCE_SHA"
+          test "$HEAD_SHA" = "$SOURCE_SHA" \
+            || { echo "::error::Checkout $HEAD_SHA != SOURCE_SHA $SOURCE_SHA"; exit 1; }

       - name: Set up Node.js
         uses: actions/setup-node@v4
         with:
           node-version: ${{ env.NODE_VERSION }}
           cache: npm

       - name: Install dependencies
         run: npm ci

       - name: Start local Supabase stack
         run: npx supabase start

       - name: Run database tests (pgTAP)
         run: npm run db:test

-      # Drift guard (secret-free): regenerate types from the local stack and
-      # fail if the committed `lib/database.types.ts` is out of date with the
-      # migrations. This also flags the initial hand-authored placeholder as
-      # needing a real generation. No remote credentials are involved.
-      - name: Check generated types are up to date
-        run: |
-          npm run supabase:types
-          git diff --exit-code -- lib/database.types.ts \
-            || { echo "::error::lib/database.types.ts is out of date. Run 'npm run supabase:types' and commit the result."; exit 1; }
+      # Regenerate types from the freshly-migrated local stack at SOURCE_SHA,
+      # BEFORE any drift comparison. Generate into a TEMP file first, require a
+      # successful command AND nonempty output, then atomically replace the
+      # committed file. `set -o pipefail` + the redirect mean a failed generation
+      # exits nonzero and leaves `database.types.ts` untouched, so a broken or
+      # empty file is never uploaded or compared. No remote credentials.
+      - name: Generate database types
+        id: gen_types
+        run: |
+          set -euo pipefail
+          tmpfile="$(mktemp)"
+          supabase gen types typescript --local --schema public > "$tmpfile"
+          test -s "$tmpfile" \
+            || { echo "::error::Generated types output was empty."; exit 1; }
+          mv "$tmpfile" lib/database.types.ts
+
+      # Upload the generated file BEFORE the drift check so it stays downloadable
+      # even when drift fails — but ONLY when generation actually succeeded, so a
+      # failed or empty generation can never masquerade as a valid artifact.
+      # Named by SOURCE_SHA so retrieval is unambiguous and verifiable.
+      - name: Upload generated database types
+        if: ${{ steps.gen_types.outcome == 'success' }}
+        uses: actions/upload-artifact@v4
+        with:
+          name: database-types-${{ env.SOURCE_SHA }}
+          path: lib/database.types.ts
+          if-no-files-found: error
+          retention-days: 7
+
+      # Record the artifact name, source commit, and retrieval instructions in
+      # the job summary so the file can be found and applied from a browser.
+      - name: Publish types artifact instructions to job summary
+        if: ${{ steps.gen_types.outcome == 'success' }}
+        run: |
+          {
+            echo "### Generated \`lib/database.types.ts\` artifact"
+            echo
+            echo "- Artifact: \`database-types-${SOURCE_SHA}\`"
+            echo "- Source commit: \`${SOURCE_SHA}\`"
+            echo "- Branch: \`${GITHUB_REF_NAME}\`"
+            echo
+            echo "Download it from the **Artifacts** section of this run, unzip \`database.types.ts\`, and commit it to \`lib/database.types.ts\` at the source commit above. Re-running CI on the resulting commit must clear this drift check."
+          } >> "$GITHUB_STEP_SUMMARY"
+
+      # Drift guard (secret-free): fail if the committed `lib/database.types.ts`
+      # is out of date with the migrations. PRESERVED as a hard failure until the
+      # regenerated file (uploaded above) is committed. Pure comparison now —
+      # generation happens in the step above. No remote credentials.
+      - name: Check generated types are up to date
+        run: |
+          git diff --exit-code -- lib/database.types.ts \
+            || { echo "::error::lib/database.types.ts is out of date. Download the 'database-types-${SOURCE_SHA}' artifact from this run and commit it to lib/database.types.ts (see job summary)."; exit 1; }

       - name: Stop local Supabase stack
         if: ${{ always() }}
         run: npx supabase stop --no-backup
```

Nothing else in `ci.yml` changes. The step ordering guarantees the artifact is
uploaded **before** the drift check runs, so it is available even when drift
fails. Type generation no longer runs inside the drift step — it runs in the new
`Generate database types` step against the SOURCE_SHA checkout — so the drift
step is now a pure comparison.

## Requirement mapping

1. **Checkout of SOURCE_SHA before migrations/types** — the job sets
   `SOURCE_SHA` to `pull_request.head.sha` on PRs and `github.sha` on push,
   checks out that exact ref (not the default PR merge commit), and the
   `Assert checkout is at source commit` step fails the job unless
   `git rev-parse HEAD` equals `SOURCE_SHA`. Migrations (`db:test`) and type
   generation therefore run on the real source commit, never a merge commit
   merely labelled with the branch-head SHA.
2. **Robust generation** — `Generate database types` has `id: gen_types`, runs
   under `set -euo pipefail`, writes to a `mktemp` file, requires a nonempty
   result (`test -s`), and only then atomically `mv`s it over
   `lib/database.types.ts`. A failed command or empty output fails the step and
   leaves the committed file untouched.
3. **Upload only on successful generation, before drift** — `Upload generated
database types` is gated on `steps.gen_types.outcome == 'success'` and sits
   between generation and the drift check.
4. **Failing drift preserved** — the final `Check generated types are up to
date` step still `exit 1`s on any diff, now pointing at the artifact.
5. **Identified by source commit + summary instructions** — artifact name is
   `database-types-<SOURCE_SHA>`; the summary step prints the name, commit,
   branch, and retrieval steps to `$GITHUB_STEP_SUMMARY`.
6. **Retrieve, verify, commit to branch, rerun** — v0 automates this (below).

## After the patch merges: automated retrieval (v0 can do this)

Once the patched workflow has run on `v0/db-types-artifact-handoff`, ask v0 to
finish. A **failed overall run is expected** here — the drift check is designed
to fail until the regenerated file is committed, so the artifact from a failed
run is exactly what we want. v0 will:

1. **Verify repository and workflow.** Confirm the run belongs to
   `jedemarco1030/favalog` and the `CI` workflow's `database` job:

   ```bash
   gh repo view --json nameWithOwner --jq '.nameWithOwner'   # must be jedemarco1030/favalog
   gh run list --branch v0/db-types-artifact-handoff --workflow CI \
     --json databaseId,headSha,status,conclusion,workflowName
   ```

2. **Verify the source commit.** Resolve the branch head and require the run's
   `headSha` to match it (a failed `conclusion` is acceptable/expected):

   ```bash
   git fetch origin v0/db-types-artifact-handoff
   SOURCE_SHA="$(git rev-parse origin/v0/db-types-artifact-handoff)"
   # pick the run whose headSha == $SOURCE_SHA
   ```

3. **Verify the generation step succeeded.** Even though the overall run failed
   on drift, the `Generate database types` step must have concluded `success`:

   ```bash
   gh api repos/jedemarco1030/favalog/actions/runs/<run-id>/jobs \
     --jq '.jobs[] | select(.name|test("Supabase schema")) | .steps[]
            | select(.name=="Generate database types") | .conclusion'
   # must print: success
   ```

4. **Download the artifact for that exact commit:**

   ```bash
   gh run download <run-id> --name "database-types-${SOURCE_SHA}" --dir /tmp/db-types
   ```

5. **Recheck the branch head, then commit.** Before writing the file, re-resolve
   `origin/v0/db-types-artifact-handoff`; if it no longer equals `SOURCE_SHA`,
   the branch moved — discard the artifact and start over from a fresh run
   against the new head (regenerate), never commit a stale file. When it still
   matches, copy `/tmp/db-types/database.types.ts` to `lib/database.types.ts`,
   confirm it is a generated file (not hand-edited), and commit **to
   `v0/db-types-artifact-handoff`** (never `main`).
6. **Rerun & confirm.** Push and let CI re-run; the `database` job's pgTAP suite
   and the drift check must both pass on the resulting commit.

### Browser-only fallback (if artifact tooling is ever unavailable)

1. Open the failed CI run → **Artifacts** → download `database-types-<sha>`.
2. Unzip to get `database.types.ts`.
3. Either commit it to `lib/database.types.ts` via GitHub's browser editor on
   `v0/db-types-artifact-handoff`, or **upload the file into this chat** and v0
   will commit it to that branch for you.

## Guardrails

- Do **not** hand-edit `lib/database.types.ts` or weaken/skip the drift check.
- Do **not** commit generated types to `main` directly; always via the
  `v0/db-types-artifact-handoff` branch / its PR.
- Do **not** apply the patch on a branch that lacks
  `20260815121100_reconcile_search_overloads.sql`; the regenerated types would
  encode the old ambiguous overloads.
- Local Docker and WebStorm are never required — generation happens in CI.
- No hosted Supabase change and no production deploy are part of this handoff.

```

```
