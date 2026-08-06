-- Favalog backend fix: case-insensitive username collision resolution in
-- handle_new_user().
--
-- Forward-only correction (existing migrations are immutable). A prior fix
-- (20260805175500) schema-qualified the `::extensions.citext` CAST so it
-- resolves under the pinned empty search_path. But the collision-detection loop
-- still relied on the citext `=` OPERATOR:
--
--     where p.username = final_username::extensions.citext
--
-- Casts are resolved globally (via pg_cast) regardless of search_path, but
-- OPERATORS are resolved through the search_path. The citext-specific `=`
-- operator lives in the `extensions` schema, so under `search_path = ''` it is
-- invisible; Postgres instead falls back to the built-in `text = text` operator
-- (both citext operands implicitly cast to text), which is CASE-SENSITIVE.
--
-- Symptom: a mixed-case duplicate handle (e.g. "BOB" when "bob" already exists)
-- slips past the loop unchanged, then violates the case-insensitive
-- `profiles_username_key` unique index at INSERT time — so that sign-up fails
-- with "Database error creating new user" instead of getting a "_1" suffix.
-- Same-case duplicates were unaffected (text equality still matched), which is
-- why the gap went unnoticed.
--
-- Fixes (both forward-only, same function via CREATE OR REPLACE):
--   1. Compare with an explicit, search_path-independent case fold —
--      `lower(p.username::text) = lower(final_username)` — which mirrors the
--      citext unique index's folding without depending on the extensions `=`
--      operator.
--   2. Lowercase the email-derived handle fallback so a mixed-case address
--      (BOB@…) yields the same base handle as its lowercase form (bob) and
--      therefore a clean `bob_1` suffix on collision, instead of a doomed
--      mixed-case `BOB` that the citext unique index would reject. Handles set
--      explicitly via sign-up metadata keep their original casing (citext still
--      makes them collision-safe).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_username text;
  base_username text;
  final_username text;
  suffix int := 0;
begin
  meta_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  -- Email-derived handles are folded to lowercase (emails are case-insensitive);
  -- an explicitly supplied metadata handle keeps its casing.
  base_username := coalesce(meta_username, lower(split_part(new.email, '@', 1)));

  -- Sanitize to the allowed character set and length window.
  base_username := regexp_replace(base_username, '[^A-Za-z0-9_]', '', 'g');
  if char_length(base_username) < 3 then
    base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  base_username := left(base_username, 30);

  -- Resolve collisions deterministically by appending an incrementing suffix.
  -- Fold case explicitly (lower(...)) so the check matches the citext unique
  -- index regardless of search_path; the citext `=` operator is not visible
  -- under the pinned empty search_path.
  final_username := base_username;
  while exists (
    select 1 from public.profiles p
    where lower(p.username::text) = lower(final_username)
  ) loop
    suffix := suffix + 1;
    final_username := left(base_username, 27) || '_' || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      final_username
    )
  );

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates an initial public.profiles row for each new auth.users row. SECURITY DEFINER with a pinned empty search_path; username collision detection folds case explicitly (lower()) so it matches the citext unique index without relying on the search_path-scoped citext operator.';
