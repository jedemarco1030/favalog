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
