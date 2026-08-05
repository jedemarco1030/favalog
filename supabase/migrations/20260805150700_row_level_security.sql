-- Favalog backend foundation: Row Level Security.
--
-- RLS is enabled on every public application table. Policies are explicit and
-- least-privilege. There are deliberately NO `using (true) with check (true)`
-- policies for user-owned writes. The service_role key (server-only) bypasses
-- RLS and is how trusted server processes ingest catalog data.
--
-- Reads use `auth.uid()`, which is NULL for the anonymous role, so public-read
-- policies are written to permit anon where a public surface requires it.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Public profiles are readable by anyone (anon + authenticated).
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

-- A user may create their own profile row (the auth trigger normally does this
-- via SECURITY DEFINER; this policy covers direct self-provisioning).
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- A user may update only their own profile.
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No DELETE policy: profile deletion is intentional and happens via the
-- auth.users -> profiles ON DELETE CASCADE, not by ordinary client writes.

-- ---------------------------------------------------------------------------
-- media_items  (public catalog; writes restricted to service_role)
-- ---------------------------------------------------------------------------
alter table public.media_items enable row level security;

create policy "Media items are publicly readable"
  on public.media_items for select
  using (true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated: catalog writes are
-- performed only by trusted server-side processes using the service_role key,
-- which bypasses RLS. Privileged writes are never exposed to the browser.

-- ---------------------------------------------------------------------------
-- diary_entries  (public read for public profiles; owner write)
-- ---------------------------------------------------------------------------
alter table public.diary_entries enable row level security;

-- Public-read decision: diary entries back the public-profile concept, so they
-- are publicly readable. Revisit if per-entry privacy is introduced later.
create policy "Diary entries are publicly readable"
  on public.diary_entries for select
  using (true);

create policy "Users can insert their own diary entries"
  on public.diary_entries for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own diary entries"
  on public.diary_entries for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own diary entries"
  on public.diary_entries for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- reviews  (public read; owner write)
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

create policy "Reviews are publicly readable"
  on public.reviews for select
  using (true);

create policy "Users can insert their own reviews"
  on public.reviews for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own reviews"
  on public.reviews for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own reviews"
  on public.reviews for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- lists  (public lists readable; owner sees own regardless; owner write)
-- ---------------------------------------------------------------------------
alter table public.lists enable row level security;

-- Interim visibility policy: 'public' lists are readable by everyone; owners
-- always see their own lists. 'followers' and 'private' lists are NOT publicly
-- readable and are treated the same as private until the follows relationship
-- powers a real check (documented in docs/backend-architecture.md). We do NOT
-- fake followers-only access before that policy exists.
create policy "Public or owned lists are readable"
  on public.lists for select
  using (visibility = 'public' or auth.uid() = user_id);

create policy "Users can insert their own lists"
  on public.lists for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own lists"
  on public.lists for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own lists"
  on public.lists for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- list_items  (readable when the parent list is readable; writable by list owner)
-- ---------------------------------------------------------------------------
alter table public.list_items enable row level security;

create policy "List items follow parent list visibility"
  on public.list_items for select
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_items.list_id
        and (l.visibility = 'public' or l.user_id = auth.uid())
    )
  );

-- A user may modify list_items only when they own the parent list. The EXISTS
-- check binds the write to list ownership rather than trusting the client.
create policy "Owners can insert items into their lists"
  on public.list_items for insert to authenticated
  with check (
    exists (
      select 1 from public.lists l
      where l.id = list_items.list_id and l.user_id = auth.uid()
    )
  );

create policy "Owners can update items in their lists"
  on public.list_items for update to authenticated
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_items.list_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lists l
      where l.id = list_items.list_id and l.user_id = auth.uid()
    )
  );

create policy "Owners can delete items from their lists"
  on public.list_items for delete to authenticated
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_items.list_id and l.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- favorites  (public read for public profiles; owner write)
-- ---------------------------------------------------------------------------
alter table public.favorites enable row level security;

create policy "Favorites are publicly readable"
  on public.favorites for select
  using (true);

create policy "Users can insert their own favorites"
  on public.favorites for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own favorites"
  on public.favorites for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own favorites"
  on public.favorites for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- follows  (public read; creator-only write on the follower side)
-- ---------------------------------------------------------------------------
alter table public.follows enable row level security;

create policy "Follows are publicly readable"
  on public.follows for select
  using (true);

create policy "Users can create their own follow relationships"
  on public.follows for insert to authenticated
  with check (auth.uid() = follower_id);

create policy "Users can delete their own follow relationships"
  on public.follows for delete to authenticated
  using (auth.uid() = follower_id);

-- No UPDATE policy on follows: a relationship is either present or absent.
