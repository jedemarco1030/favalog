# CI handoff: refresh-lifecycle database job enhancement

The provider-metadata refresh lifecycle (migration
`20260815121000_external_media_refresh_lifecycle.sql` and its pgTAP suite) was
delivered with a small enhancement to the existing `database` job in
`.github/workflows/ci.yml`. That workflow change **could not be pushed from v0**
because the v0 GitHub App lacks the `workflows` permission
(`refusing to allow a GitHub App to create or update workflow ... without
'workflows' permission`). Apply it manually with a token/user that has
`workflows` scope.

## Why it is safe to defer

The change is an enhancement, not a prerequisite: the existing `database` job
already starts a local Supabase stack (which applies every migration) and runs
`npm run db:test` (pgTAP, including the new
`external_media_refresh_lifecycle.test.sql`) plus the `lib/database.types.ts`
drift guard. The new migration and its tests therefore already run in CI without
this patch. The patch only (1) makes the clean-reset explicit and fail-loud, and
(2) uploads the regenerated types as an artifact when the drift guard fails, so
the correct generated file can be committed verbatim.

## Applying the patch

Save the diff below and apply from the repository root:

```bash
git apply docs/ci/refresh-lifecycle-ci.patch   # if you saved it as a file, or
git apply - <<'PATCH'                            # paste the diff on stdin
...diff from below...
PATCH
```

## The diff

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 3a41f73..c057a6e 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -91,6 +91,13 @@ jobs:
       - name: Start local Supabase stack
         run: npx supabase start

+      # Apply EVERY migration from a clean reset so the pgTAP suite and the type
+      # drift check run against a database built purely from the committed
+      # migrations (not from any accumulated local state). Fails loudly if a
+      # migration cannot apply, rather than silently skipping.
+      - name: Apply all migrations from a clean reset
+        run: npx supabase db reset
+
       - name: Run database tests (pgTAP)
         run: npm run db:test

@@ -104,6 +111,19 @@ jobs:
           git diff --exit-code -- lib/database.types.ts \
             || { echo "::error::lib/database.types.ts is out of date. Run 'npm run supabase:types' and commit the result."; exit 1; }

+      # HANDOFF: when the drift check above fails because the environment that
+      # authored a migration could not regenerate types (e.g. no Docker), upload
+      # the freshly generated file so it can be committed to the branch verbatim
+      # and the drift check rerun. Never hand-author this file.
+      - name: Upload regenerated database types (drift handoff)
+        if: ${{ failure() }}
+        uses: actions/upload-artifact@v4
+        with:
+          name: database-types-regenerated
+          path: lib/database.types.ts
+          if-no-files-found: warn
+          retention-days: 7
+
       - name: Stop local Supabase stack
         if: ${{ always() }}
         run: npx supabase stop --no-backup
```

## Related follow-up: regenerate the generated types

The new migration adds columns and RPCs, so `lib/database.types.ts` must be
regenerated (never hand-authored). With Docker + the Supabase CLI available:

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:types   # writes lib/database.types.ts
```

Commit the result so the drift guard passes. If you cannot run Docker locally,
let CI run the `database` job with the patch above applied and download the
`database-types-regenerated` artifact, then commit that file verbatim.
