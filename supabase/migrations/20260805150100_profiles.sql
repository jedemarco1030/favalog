-- Favalog backend foundation: profiles.
--
-- A public.profiles row is the app-visible identity that maps 1:1 to a private
-- auth.users row. Authentication credentials live only in auth.users; this
-- table never stores passwords or secrets.

create table public.profiles (
  -- Shares the primary key with auth.users so the relationship is exactly 1:1.
  -- ON DELETE CASCADE: deleting the auth user removes their public profile.
  id uuid primary key references auth.users (id) on delete cascade,
  -- Case-insensitive, stable handle that /profile/[username] routes off.
  -- citext + the unique index below make "Jamie" and "jamie" collide.
  username citext not null,
  display_name text not null,
  bio text,
  location text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Handles are URL-safe, 3–30 chars, lower/upper letters, digits, underscore.
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 80),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 500),
  constraint profiles_location_length check (location is null or char_length(location) <= 120)
);

-- Enforces case-insensitive username uniqueness (citext folds case).
create unique index profiles_username_key on public.profiles (username);

comment on table public.profiles is
  'Public identity for an authenticated user, 1:1 with auth.users. Profile statistics are derived from diary/reviews/lists, never stored here.';

-- Keep updated_at fresh.
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-provision a profile when an auth user is created.
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is required: the trigger runs in the auth schema context on
-- INSERT into auth.users, but must insert into public.profiles. search_path is
-- pinned to empty so every reference is fully qualified and cannot be hijacked.
-- The username/display_name fall back to the email local-part when the client
-- did not pass raw_user_meta_data, keeping local/dev signups frictionless.
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
  final_username := base_username;
  while exists (select 1 from public.profiles p where p.username = final_username::citext) loop
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
  'Creates an initial public.profiles row for each new auth.users row. SECURITY DEFINER with a pinned search_path per current Supabase guidance.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
