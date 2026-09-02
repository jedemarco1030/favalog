# Catalog genre taxonomy & Open Library remediation

Phase 4A.1. This documents the canonical book-genre taxonomy introduced at the
Open Library normalization boundary, why raw provider subjects are **not**
genres, and the exact owner-controlled procedure to remediate the one existing
polluted hosted record (the imported Open Library _Dune_ Work `OL893414W`).

## Why a taxonomy

Open Library `subjects` are an uncontrolled folksonomy. A single Work can carry
awards, bestseller-list metadata, provider query syntax, embedded dates, places,
characters, people, organizations, and free-form cataloguing prose alongside a
handful of genuine genres — for example:

- `award:nebula_award=novel`
- `nyt:mass-market-monthly=2021-11-07`
- `Dune (Imaginary place)`
- `Dune (imaginary place), fiction`
- `Fiction, science fiction, general`

Persisting these verbatim as "genres" polluted the Explore Genre menu and every
title page. Before Phase 4A.1 the Open Library normalizer stored `subjects`
directly via `capGenres`.

## The canonical mapping

`lib/catalog/openlibrary/genres.ts` exports:

- `CANONICAL_BOOK_GENRES` — the closed, ordered, user-facing taxonomy.
- `canonicalizeBookGenres(subjects)` — a pure function applied inside
  `normalizeOpenLibraryWork`.

It is small and user-facing, stable across providers (a fixed vocabulary, not
derived from input), case- and whitespace-insensitive, deduplicated,
deterministic (first-seen order), explicitly allow-listed, and **fail-closed**:
anything not recognised is dropped rather than guessed. Known aliases
(`Sci-Fi`, `Science-fiction`, `Fiction, science fiction, general`, …) collapse
to one canonical value; a comma-composite subject resolves to its most specific
genre. Provider syntax (`:`/`=`), any embedded digit (dates/years/ids), and
parenthesised entity qualifiers (`… (Imaginary place)`) are rejected.

The taxonomy intentionally reuses the existing curated catalog's spellings
(e.g. `Literary Fiction`, `Science Fiction`, `Short Stories`, `Nonfiction`,
`Memoir`, `Essays`, `History`, `Speculative`) so **browse filtering and
displayed title genres share one vocabulary**. Because the fix is at the
normalization boundary, cleaned genres flow into the stored row, the search
document, and every future import — not just the dropdown.

No title or Work id is special-cased; the rules generalize to all future Open
Library imports.

## Raw subjects are provider tags, not genres

Raw Open Library `subjects` are provider **tags**. They are deliberately **not**
persisted and **not** exposed as genres. If a future phase wants them (e.g. as
an additional retrieval signal), they must be stored under a separate,
clearly-named field and must never be re-surfaced as product genres. This patch
adds no schema expansion for them — none is needed now.

## Remediating the existing hosted _Dune_ record

The hosted Open Library _Dune_ row (`source = openlibrary`,
`external_id = OL893414W`) was imported before this fix and still carries raw
subjects as genres. **Do not** mutate hosted Supabase during implementation and
**do not** add a migration that hard-codes _Dune_ — the trusted materializer
already provides a safe, general, idempotent refresh path.

Re-running the import re-fetches trusted upstream detail, re-normalizes it
through the new taxonomy, and upserts through `materialize_external_media`, which
resolves the existing provider link first. This preserves the media id, the
immutable slug, the `media_external_ids` alias, and all user data (lists,
favorites, diary entries, reviews). Re-running it again is a no-op beyond
`synced_at`.

### Owner-controlled production refresh (after deployment)

Run from a trusted operator machine with hosted service-role credentials
(`SUPABASE_URL` + `SUPABASE_SECRET_KEY`) and `OPEN_LIBRARY_CONTACT_EMAIL` set.
Substitute the real hosted project ref for `<project-ref>`.

1. Dry-run inspect the normalized record (no write) to confirm clean genres:

   ```bash
   npm run catalog -- inspect --provider openlibrary --kind book --external-id OL893414W
   ```

2. Refresh the hosted record (guarded remote write — requires BOTH flags):

   ```bash
   npm run catalog -- import --provider openlibrary --kind book --external-id OL893414W \
     --allow-remote --confirm-project-ref=<project-ref>
   ```

The remote-write guard is never bypassed and never automatic; a remote `--fake`
write is always rejected.

### Embedding staleness (exactly one)

Genres are part of both the stored content hash (`normalizedContentHash`) and
the canonical **embedding** document (`buildCanonicalDocument` includes a
`Genres:` line). Cleaning _Dune_'s genres therefore changes its canonical
document, which makes **exactly one** embedding stale (the _Dune_ row only). No
other row's document changes, and `NORMALIZATION_VERSION` /
`CANONICAL_DOCUMENT_VERSION` are unchanged, so no global re-embed is triggered.

Re-embed that one row with the guarded, owner-controlled pipeline (needs
`OPENAI_API_KEY`):

1. Dry-run to confirm exactly one missing/stale row is detected (no key/writes):

   ```bash
   npm run embed:catalog -- --dry-run
   ```

2. Confirmed remote re-embed (guarded remote write — requires BOTH flags):

   ```bash
   npm run embed:catalog -- --allow-remote --confirm-project-ref=<project-ref>
   ```

3. Idempotent rerun / final compatible-corpus verification — running the same
   command again re-embeds nothing (the row now matches on content hash,
   document version, provider, model, and dimensions), confirming a complete,
   compatible corpus:

   ```bash
   npm run embed:catalog -- --allow-remote --confirm-project-ref=<project-ref>
   ```

No production changes are performed as part of this patch. These commands are
the deferred, owner-controlled rollout to run **after** the code is deployed.

## Phase 4A.2 follow-up: the refresh actually reaches already-imported rows

Phase 4A.1 fixed normalization for _incoming_ data, but re-importing an
**already-linked** provider identity did not actually refresh the stored genres.

### Root cause (migration `20260815120600`)

The first resolution branch of `public.materialize_external_media` — an existing
row reached via the `media_external_ids` alias — updated subtitle / synopsis /
poster / backdrop and rewrote `content_hash` / `normalization_version` /
`synced_at`, but did **not** update `year`, `genres`, or `details`. So for a
provider-owned row a re-import reported success, advanced provenance to describe
the newly normalized payload, yet left the polluted `genres` in place — a
provenance/metadata mismatch, and the reason the cleanup never reached the hosted
_Dune_ row.

### Fix (migration `20260815120700`, forward-only)

A new forward-only migration recreates `materialize_external_media` with the same
signature and security posture (`SECURITY INVOKER`, pinned empty `search_path`,
fully schema-qualified, `service_role`-only EXECUTE, identifier-only return,
advisory locking, idempotency, ambiguity/duplicate protection). The alias branch
and the "existing provider row without an alias" branch now share **one** audited
`UPDATE` whose per-column `CASE` keys on whether the resolved row is
provider-owned (`media_items.source = p_source`):

- **Provider-owned row** → a genuine full refresh of every provider-controlled
  field (subtitle, synopsis, year, poster, backdrop, provider rating, canonical
  genres, kind-specific details) **atomically** with `content_hash` /
  `normalization_version` / `synced_at`, so provenance and the stored metadata
  can never disagree.
- **Curated `favalog` row reached via a canonical alias** → the conservative
  link policy is retained unchanged: curated title / year / genres / details /
  community rating are never overwritten; only genuinely empty presentation
  fields fill and provenance is stamped only when still empty.

Media id, immutable slug, the alias, and all user/community data (diary entries,
reviews, favorites, list memberships) are preserved for both. pgTAP coverage in
`supabase/tests/database/materialize_external_media_refresh.test.sql` proves the
refresh replaces polluted genres with canonical values, advances
year/details/provenance/timestamps together, preserves id/slug/alias and every
user-owned row, creates no duplicate, and never overwrites a curated row.

### Defense-in-depth on the browse read boundary

Independently of the write path, the Explore Genre dropdown is now derived
**only** from a closed product-genre vocabulary appropriate to each media kind
(`lib/browse/genre-vocabulary.ts`, applied in `lib/supabase/browse.ts`): book
rows admit only the canonical book taxonomy, movie/TV rows only the closed screen
vocabulary, and browsing All admits the union. Matching is case-insensitive and
fail-closed, so even a historical or malformed row holding raw subjects can never
repopulate the dropdown.

### Owner-controlled production remediation (after deployment)

Do **not** assume only _Dune_ is affected. After deploying the corrected code and
applying the migrations to hosted Supabase, the owner refreshes **every**
`source='openlibrary'` row. Run from a trusted operator machine with hosted
service-role credentials (`SUPABASE_URL` + `SUPABASE_SECRET_KEY`),
`OPEN_LIBRARY_CONTACT_EMAIL`, and (for the re-embed) `OPENAI_API_KEY`. Substitute
the real hosted project ref for `<project-ref>`.

1. **List every affected external id.** The operator CLI has no `list` command;
   query the hosted catalog directly (read-only), e.g. with the Supabase SQL
   editor or `psql`:

   ```sql
   select external_id, slug, genres
   from public.media_items
   where source = 'openlibrary'
   order by external_id;
   ```

2. **Re-import each affected external id** (guarded remote write — requires BOTH
   flags). Repeat for every id from step 1:

   ```bash
   npm run catalog -- import --provider openlibrary --kind book \
     --external-id <OLxxxxxW> --allow-remote --confirm-project-ref=<project-ref>
   ```

3. **Verify canonical genres and unchanged identity** — re-run the query from
   step 1 and confirm each row now shows only canonical book genres and the same
   `slug` (and unchanged media id).

4. **Embedding dry run** (no key/writes) to confirm which rows became stale — one
   per refreshed row whose genres changed (genres feed both the content hash and
   the canonical embedding document):

   ```bash
   npm run embed:catalog -- --dry-run
   ```

5. **Re-embed every stale row** (guarded remote write — requires BOTH flags):

   ```bash
   npm run embed:catalog -- --allow-remote --confirm-project-ref=<project-ref>
   ```

6. **Idempotent rerun** — running the same command again re-embeds nothing
   (each row now matches on content hash, document version, provider, model, and
   dimensions):

   ```bash
   npm run embed:catalog -- --allow-remote --confirm-project-ref=<project-ref>
   ```

7. **Verify the compatible corpus** equals the catalog count and confirm the
   production Genre dropdown on `/explore` contains only canonical options.

The remote-write guard is never bypassed and never automatic; a remote `--fake`
write is always rejected. `TMDB_ENABLED` stays `false`. No production changes are
performed as part of this patch.
