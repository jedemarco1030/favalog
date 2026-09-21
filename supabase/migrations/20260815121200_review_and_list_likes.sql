-- Favalog: Phase 4B.3 — Persistent Review and List Likes.
--
-- A signed-in, onboarded user may like/unlike an accessible real review or an
-- accessible real list. Explicit desired-state (not a toggle), idempotent, at
-- most one like per (user, target).
--
-- RELATIONAL DESIGN — two dedicated join tables (NOT a polymorphic table):
--   public.review_likes (user_id, review_id)
--   public.list_likes   (user_id, list_id)
--   A polymorphic (target_type, target_id) table cannot carry real foreign keys.
--   Two narrow tables give enforceable FKs, a composite PK for uniqueness +
--   idempotency, and ON DELETE CASCADE cleanup for both the target and the
--   account. There is no separate "position"/ordering concern (unlike favorites).
--
-- AUTHORIZATION MODEL:
--   * MUTATIONS are SECURITY INVOKER (consistent with set_follow / set_favorite):
--     they run with the caller's identity and with RLS in force. The caller's
--     identity comes exclusively from auth.uid(); there is NO user-id parameter.
--     Target accessibility is checked by reading the target under the invoker's
--     RLS — an inaccessible (private / not-followed-followers / nonexistent)
--     target yields no row and fails with a uniform "unknown …" error, so a
--     bare ID never discloses existence or allows interaction.
--   * READS are SECURITY DEFINER aggregation functions that return ONLY an
--     aggregate count plus the caller's own viewer bit — never liker user-id
--     rows. This is required because the like tables' RLS restricts SELECT to
--     the caller's own rows (so a plain invoker COUNT would only see its own
--     like). The definer functions re-implement the target accessibility
--     predicate explicitly (RLS is not in force under SECURITY DEFINER), so an
--     inaccessible list simply produces no row. This is controlled aggregation,
--     not service-role access: the functions expose counts, never relationships.
--   * All functions pin search_path='' and schema-qualify every reference.
--   * EXECUTE is revoked from public; mutations are granted to authenticated
--     only; batched reads are granted to anon + authenticated (signed-out
--     visitors see real counts, viewer bit false).
--
-- CONCURRENCY:
--   Each mutation serializes concurrent same-pair requests with a
--   transaction-scoped advisory lock on (uid, target). Combined with the
--   composite PK and INSERT ... ON CONFLICT DO NOTHING, the row is unique and
--   the returned state is accurate for the completed operation. This does not
--   claim immunity to a later concurrent request changing the state afterward.
--
-- REVOCATION CONTRACT:
--   Losing access to a followers-only list does NOT delete an existing like.
--   The list, its count, and the viewer bit disappear from that viewer's reads
--   (accessibility predicate fails), and the viewer cannot mutate the like while
--   inaccessible. Regaining access reveals the persisted like. Deleting the
--   target or the account cascades the like away.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table public.review_likes (
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  review_id  uuid        not null references public.reviews (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);

-- Reverse lookup for counting likes of a review.
create index review_likes_review_id_idx on public.review_likes (review_id);

comment on table public.review_likes is
  'One row per (user, review) like. Composite PK enforces at-most-one like per user per review and makes writes idempotent. FKs cascade on review or account deletion.';

create table public.list_likes (
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  list_id    uuid        not null references public.lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

-- Reverse lookup for counting likes of a list.
create index list_likes_list_id_idx on public.list_likes (list_id);

comment on table public.list_likes is
  'One row per (user, list) like. Composite PK enforces at-most-one like per user per list and makes writes idempotent. FKs cascade on list or account deletion.';

-- ---------------------------------------------------------------------------
-- 2. Row Level Security — a user may see and write ONLY their own like rows.
--    Aggregate counts are never served from direct table SELECT; they come
--    exclusively from the SECURITY DEFINER read functions below, so liker
--    identities are never exposed to clients.
-- ---------------------------------------------------------------------------
alter table public.review_likes enable row level security;

create policy "Users can read their own review likes"
  on public.review_likes for select
  using (auth.uid() = user_id);

create policy "Users can like reviews as themselves"
  on public.review_likes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove their own review likes"
  on public.review_likes for delete to authenticated
  using (auth.uid() = user_id);

alter table public.list_likes enable row level security;

create policy "Users can read their own list likes"
  on public.list_likes for select
  using (auth.uid() = user_id);

create policy "Users can like lists as themselves"
  on public.list_likes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove their own list likes"
  on public.list_likes for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Batched read functions (SECURITY DEFINER) — accessibility-enforcing
--    aggregation. Return one row per ACCESSIBLE input id; inaccessible or
--    nonexistent ids are omitted entirely (no disclosure). viewer_has_liked is
--    the caller's own bit only.
-- ---------------------------------------------------------------------------
create or replace function public.get_review_like_states(p_review_ids uuid[])
returns table (
  review_id        uuid,
  like_count       bigint,
  viewer_has_liked boolean
)
language sql
security definer
set search_path = ''
as $$
  -- Reviews are publicly readable, so accessibility == existence. Distinct the
  -- input, join to existing reviews, left join likes for the aggregate, and
  -- compute the caller's own bit via auth.uid().
  select r.id as review_id,
         count(rl.user_id) as like_count,
         coalesce(bool_or(rl.user_id = auth.uid()), false) as viewer_has_liked
  from (select distinct unnest(p_review_ids) as id) ids
  join public.reviews r on r.id = ids.id
  left join public.review_likes rl on rl.review_id = r.id
  group by r.id;
$$;

comment on function public.get_review_like_states(uuid[]) is
  'Batched review like counts + caller viewer bit for existing (public) reviews. SECURITY DEFINER controlled aggregation: returns counts only, never liker identities.';

revoke all on function public.get_review_like_states(uuid[]) from public;
grant execute on function public.get_review_like_states(uuid[]) to anon, authenticated;

create or replace function public.get_list_like_states(p_list_ids uuid[])
returns table (
  list_id          uuid,
  like_count       bigint,
  viewer_has_liked boolean
)
language sql
security definer
set search_path = ''
as $$
  -- Accessibility predicate is applied explicitly because RLS is not in force
  -- under SECURITY DEFINER. A list is visible when it is public, owned by the
  -- caller, or a followers-list the caller follows. Everything else is omitted.
  select l.id as list_id,
         count(ll.user_id) as like_count,
         coalesce(bool_or(ll.user_id = auth.uid()), false) as viewer_has_liked
  from (select distinct unnest(p_list_ids) as id) ids
  join public.lists l on l.id = ids.id
  left join public.list_likes ll on ll.list_id = l.id
  where l.visibility = 'public'
     or l.user_id = auth.uid()
     or (
       l.visibility = 'followers'
       and auth.uid() is not null
       and exists (
         select 1 from public.follows f
         where f.follower_id = auth.uid()
           and f.following_id = l.user_id
       )
     )
  group by l.id;
$$;

comment on function public.get_list_like_states(uuid[]) is
  'Batched list like counts + caller viewer bit for lists the caller may access (public/own/followed). SECURITY DEFINER controlled aggregation that re-implements the list visibility predicate; inaccessible lists are omitted so a bare id discloses nothing. Returns counts only, never liker identities.';

revoke all on function public.get_list_like_states(uuid[]) from public;
grant execute on function public.get_list_like_states(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Mutation RPCs (SECURITY INVOKER) — explicit desired-state, idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.set_review_like(
  p_review_id uuid,
  p_is_liked  boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_exists  boolean;
  v_rows    int;
  v_changed boolean := false;
  v_state   record;
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'set_review_like must be called by an authenticated user';
  end if;

  if p_is_liked is null then
    raise exception 'invalid like state'
      using errcode = '22023',
            hint = 'is_liked must be true or false';
  end if;

  if p_review_id is null then
    raise exception 'invalid review id'
      using errcode = '22023',
            hint = 'review id must be provided';
  end if;

  -- Accessibility check under the caller's RLS (reviews are public → visible iff
  -- they exist). A missing/invisible review fails uniformly without disclosure.
  select true into v_exists
  from public.reviews r
  where r.id = p_review_id;

  if v_exists is not true then
    raise exception 'unknown review: %', p_review_id
      using errcode = 'P0002',
            hint = 'no accessible review matches the provided id';
  end if;

  -- Serialize concurrent same-pair requests; works even when no row exists yet.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_uid::text),
    pg_catalog.hashtext(p_review_id::text)
  );

  if p_is_liked then
    insert into public.review_likes (user_id, review_id)
    values (v_uid, p_review_id)
    on conflict (user_id, review_id) do nothing;
    get diagnostics v_rows = row_count;
    v_changed := (v_rows > 0);
  else
    delete from public.review_likes
    where user_id = v_uid
      and review_id = p_review_id;
    get diagnostics v_rows = row_count;
    v_changed := (v_rows > 0);
  end if;

  -- Reuse the batched read as the single source of truth for the returned
  -- count + viewer bit (sees this transaction's own write).
  select gl.like_count, gl.viewer_has_liked
  into v_state
  from public.get_review_like_states(array[p_review_id]) gl;

  return jsonb_build_object(
    'review_id',        p_review_id,
    'like_count',       coalesce(v_state.like_count, 0),
    'viewer_has_liked', coalesce(v_state.viewer_has_liked, p_is_liked),
    'changed',          v_changed
  );
end;
$$;

comment on function public.set_review_like(uuid, boolean) is
  'Atomically and idempotently sets the caller''s like on an accessible review. SECURITY INVOKER; identity from auth.uid(); serialized on (user, review); returns { review_id, like_count, viewer_has_liked, changed }.';

revoke all on function public.set_review_like(uuid, boolean) from public;
revoke all on function public.set_review_like(uuid, boolean) from anon;
grant execute on function public.set_review_like(uuid, boolean) to authenticated;

create or replace function public.set_list_like(
  p_list_id  uuid,
  p_is_liked boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_exists  boolean;
  v_rows    int;
  v_changed boolean := false;
  v_state   record;
begin
  if v_uid is null then
    raise exception 'authentication required'
      using errcode = '28000',
            hint = 'set_list_like must be called by an authenticated user';
  end if;

  if p_is_liked is null then
    raise exception 'invalid like state'
      using errcode = '22023',
            hint = 'is_liked must be true or false';
  end if;

  if p_list_id is null then
    raise exception 'invalid list id'
      using errcode = '22023',
            hint = 'list id must be provided';
  end if;

  -- Accessibility check under the caller's RLS: the SELECT only returns a row
  -- when the list is public, owned, or a followed followers-list. A private,
  -- not-followed, or nonexistent list yields no row and fails uniformly, so a
  -- bare id neither discloses existence nor permits interaction.
  select true into v_exists
  from public.lists l
  where l.id = p_list_id;

  if v_exists is not true then
    raise exception 'unknown list: %', p_list_id
      using errcode = 'P0002',
            hint = 'no accessible list matches the provided id';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_uid::text),
    pg_catalog.hashtext(p_list_id::text)
  );

  if p_is_liked then
    insert into public.list_likes (user_id, list_id)
    values (v_uid, p_list_id)
    on conflict (user_id, list_id) do nothing;
    get diagnostics v_rows = row_count;
    v_changed := (v_rows > 0);
  else
    delete from public.list_likes
    where user_id = v_uid
      and list_id = p_list_id;
    get diagnostics v_rows = row_count;
    v_changed := (v_rows > 0);
  end if;

  select gl.like_count, gl.viewer_has_liked
  into v_state
  from public.get_list_like_states(array[p_list_id]) gl;

  return jsonb_build_object(
    'list_id',          p_list_id,
    'like_count',       coalesce(v_state.like_count, 0),
    'viewer_has_liked', coalesce(v_state.viewer_has_liked, p_is_liked),
    'changed',          v_changed
  );
end;
$$;

comment on function public.set_list_like(uuid, boolean) is
  'Atomically and idempotently sets the caller''s like on an accessible list (public/own/followed). SECURITY INVOKER; identity from auth.uid(); RLS-in-force existence check prevents interaction with or disclosure of inaccessible lists; serialized on (user, list); returns { list_id, like_count, viewer_has_liked, changed }.';

revoke all on function public.set_list_like(uuid, boolean) from public;
revoke all on function public.set_list_like(uuid, boolean) from anon;
grant execute on function public.set_list_like(uuid, boolean) to authenticated;
