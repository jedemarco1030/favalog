-- Favalog backend foundation: extensions, enums, and shared helpers.
--
-- This is the first migration. Migrations are the single source of truth for
-- the database schema; never edit the database out of band. See
-- docs/backend-architecture.md for the full schema overview.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- `citext` gives us case-insensitive text, used for usernames so that "Jamie"
-- and "jamie" can never both be registered. `pgcrypto` provides gen_random_uuid.
create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums (stable, bounded domains only)
-- ---------------------------------------------------------------------------
-- The kind of a catalog title. Deliberately bounded: Favalog's MVP is movies,
-- TV, and books, and these are shared experiences rather than separate products.
create type public.media_kind as enum ('movie', 'tv', 'book');

-- A list's access model. Mirrors the reserved `ListVisibility` domain type.
-- `followers` visibility is represented but not fully enforced until follows
-- power a real relationship check (documented in backend-architecture.md).
create type public.list_visibility as enum ('public', 'followers', 'private');

-- ---------------------------------------------------------------------------
-- Shared trigger function: keep `updated_at` fresh on UPDATE.
-- ---------------------------------------------------------------------------
-- SECURITY: `security definer` is intentionally NOT used here — the function
-- only mutates the row being written and needs no elevated privileges. The
-- search_path is pinned to an empty string so the function never resolves
-- unqualified names against a caller-controlled search_path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function that sets updated_at = now() on row UPDATE. Applied to every table carrying an updated_at column.';
