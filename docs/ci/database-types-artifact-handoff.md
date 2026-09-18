# Database types: browser-only verification & artifact handoff

This handoff makes `lib/database.types.ts` verifiable and fixable **without
WebStorm or local Docker**. It reuses the existing `database` CI job (disposable
local Supabase → migrations → pgTAP → `supabase:types`) and adds a downloadable
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

Apply this on a **feature branch**, never directly on `main`.

1. Open `https://github.com/jedemarco1030/favalog/edit/<feature-branch>/.github/workflows/ci.yml`
   (replace `<feature-branch>`; create it first from `main` if it doesn't exist).
2. Make exactly the two changes in the diff below, inside the `database:` job.
3. Commit to the feature branch and open a PR.

### Exact minimal patch (`.github/workflows/ci.yml`)

```diff
@@ jobs:
   database:
     name: Supabase schema & RLS tests
     runs-on: ubuntu-latest
+    # Identify generated-type artifacts by the SOURCE commit. On pull_request,
+    # `github.sha` is the ephemeral merge commit; `head.sha` is the real branch
+    # head where the regenerated file must be committed. On push, both are the
+    # pushed commit.
+    env:
+      SOURCE_SHA: ${{ github.event.pull_request.head.sha || github.sha }}
     steps:
       - uses: actions/checkout@v4
@@ database steps: after "Run database tests (pgTAP)"
       - name: Run database tests (pgTAP)
         run: npm run db:test

-      # Drift guard (secret-free): regenerate types from the local stack and
-      # fail if the committed `lib/database.types.ts` is out of date with the
-      # migrations. This also flags the initial hand-authored placeholder as
-      # needing a real generation. No remote credentials are involved.
+      # Regenerate types from the freshly-migrated local stack at the EXACT
+      # checked-out commit, BEFORE any drift comparison. No remote credentials
+      # are involved.
+      - name: Generate database types
+        run: npm run supabase:types
+
+      # Upload the generated file BEFORE the drift check so it stays downloadable
+      # even when the drift step fails. Named by the SOURCE commit so retrieval
+      # is unambiguous and can be verified against the branch head.
+      - name: Upload generated database types
+        if: ${{ !cancelled() }}
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
+        if: ${{ !cancelled() }}
+        run: |
+          {
+            echo "### Generated \`lib/database.types.ts\` artifact"
+            echo
+            echo "- Artifact: \`database-types-${SOURCE_SHA}\`"
+            echo "- Source commit: \`${SOURCE_SHA}\`"
+            echo "- Branch: \`${GITHUB_REF_NAME}\`"
+            echo
+            echo "Download it from the **Artifacts** section of this run, unzip \`database.types.ts\`, and commit it to \`lib/database.types.ts\` on the commit above. Re-running CI on the resulting commit must clear this drift check."
+          } >> "$GITHUB_STEP_SUMMARY"
+
+      # Drift guard (secret-free): fail if the committed `lib/database.types.ts`
+      # is out of date with the migrations. PRESERVED as a hard failure until the
+      # regenerated file (uploaded above) is committed. No remote credentials.
       - name: Check generated types are up to date
         run: |
-          npm run supabase:types
           git diff --exit-code -- lib/database.types.ts \
-            || { echo "::error::lib/database.types.ts is out of date. Run 'npm run supabase:types' and commit the result."; exit 1; }
+            || { echo "::error::lib/database.types.ts is out of date. Download the 'database-types-${SOURCE_SHA}' artifact from this run and commit it to lib/database.types.ts (see job summary)."; exit 1; }

       - name: Stop local Supabase stack
         if: ${{ always() }}
         run: npx supabase stop --no-backup
```

Nothing else in `ci.yml` changes. The step ordering guarantees the artifact is
uploaded **before** the drift check runs, so it is available even when drift
fails. `supabase:types` no longer runs inside the drift step (it runs in the new
`Generate database types` step), so the drift step is now a pure comparison.

## Requirement mapping

1. **Types from the exact commit, post-migration** — the `database` job already
   runs `npx supabase start` (and `db:test` applies migrations); the new
   `Generate database types` step runs `supabase:types` against that freshly
   migrated stack at the checked-out commit.
2. **Uploaded before drift compares** — `Upload generated database types` sits
   between generation and the drift check, with `if: ${{ !cancelled() }}`.
3. **Identified by source commit + summary instructions** — artifact name is
   `database-types-<SOURCE_SHA>`; the summary step prints the name, commit,
   branch, and retrieval steps to `$GITHUB_STEP_SUMMARY`.
4. **Failing drift preserved** — the final `Check generated types are up to
date` step still `exit 1`s on any diff, now pointing at the artifact.
5. **Retrieve, verify commit, commit to branch** — v0 automates this (below).
6. **Rerun & confirm** — re-running CI on the new commit reruns pgTAP + drift.

## After the patch merges: automated retrieval (v0 can do this)

Once the patched workflow has run on a feature branch, ask v0 to finish. v0 will:

1. Resolve the branch head commit and find the matching run:
   ```bash
   HEAD_SHA="$(git rev-parse HEAD)"
   gh run list --branch <feature-branch> --workflow CI --json databaseId,headSha,status
   ```
2. Confirm the run's `headSha` matches `HEAD_SHA` (source-commit verification),
   then download the artifact for that commit:
   ```bash
   gh run download <run-id> --name "database-types-${HEAD_SHA}" --dir /tmp/db-types
   ```
3. Copy `/tmp/db-types/database.types.ts` to `lib/database.types.ts`, confirm it
   is a generated file (not hand-edited), and commit **to the feature branch**
   (never `main`).
4. Push and let CI re-run; the `database` job's pgTAP suite and the drift check
   must both pass on the resulting commit.

### Browser-only fallback (if artifact tooling is ever unavailable)

1. Open the failed CI run → **Artifacts** → download `database-types-<sha>`.
2. Unzip to get `database.types.ts`.
3. Either commit it to `lib/database.types.ts` via GitHub's browser editor on
   the feature branch, or **upload the file into this chat** and v0 will commit
   it to the branch for you.

## Guardrails

- Do **not** hand-edit `lib/database.types.ts` or weaken/skip the drift check.
- Do **not** commit generated types to `main` directly; always via the feature
  branch / PR.
- Local Docker and WebStorm are never required — generation happens in CI.
