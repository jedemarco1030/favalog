-- Favalog Phase 4C.1: add video games as a first-class media kind (forward-only).
--
-- WHY THIS IS ITS OWN MIGRATION. PostgreSQL forbids USING a newly added enum
-- value inside the same transaction that adds it ("unsafe use of new value").
-- The Supabase CLI applies each migration file in its own transaction, so the
-- value is added here and only referenced (constraints, functions, the
-- game_statuses table) by the NEXT migration, after this one has committed.
--
-- `add value if not exists` keeps a re-run idempotent. Enum values cannot be
-- removed, which is acceptable: 'game' is a deliberate, permanent product kind.
-- Existing 'movie' / 'tv' / 'book' rows and every function keyed on
-- public.media_kind are unaffected.

alter type public.media_kind add value if not exists 'game';
