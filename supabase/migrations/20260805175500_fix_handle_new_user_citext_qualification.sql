-- Favalog backend fix: schema-qualify citext inside handle_new_user().
--
-- Forward-only correction. The original handle_new_user() (migration
-- 20260805150100_profiles.sql) is pinned to `search_path = ''` (correct, per
-- Supabase SECURITY DEFINER guidance) but casts the candidate username with an
-- unqualified `::citext`. The citext extension is installed into the
-- `extensions` schema (migration 20260805150000_extensions_and_helpers.sql:
-- `create extension citext with schema extensions`), so with an empty
-- search_path the unqualified cast fails with `type "citext" does not exist`.
--
-- Symptom: the on_auth_user_created trigger raises, so EVERY auth sign-up
-- (email/password and OAuth) fails with "Database error creating new user" and
-- no public.profiles row is provisioned.
--
-- Fix: fully qualify the cast as `extensions.citext`. Existing migrations are
-- immutable, so this is a new forward-only migration that redefines the
-- function via CREATE OR REPLACE (idempotent, non-destructive). The trigger
-- itself is unchanged and continues to reference this function by name.
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
  base_username := coalesce(meta_username, split_part(new.email, '@', 1));

  -- Sanitize to the allowed character set and length window.
  base_username := regexp_replace(base_username, '[^A-Za-z0-9_]', '', 'g');
  if char_length(base_username) < 3 then
    base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  base_username := left(base_username, 30);

  -- Resolve collisions deterministically by appending an incrementing suffix.
  -- citext lives in the `extensions` schema, so the cast must be qualified: an
  -- empty search_path cannot resolve a bare `citext`.
  final_username := base_username;
  while exists (select 1 from public.profiles p where p.username = final_username::extensions.citext) loop
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
  'Creates an initial public.profiles row for each new auth.users row. SECURITY DEFINER with a pinned search_path per current Supabase guidance; citext is schema-qualified (extensions.citext) so it resolves under the empty search_path.';
