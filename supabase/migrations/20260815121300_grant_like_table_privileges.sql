-- Favalog: table-level privilege grants for the review/list like tables.
--
-- FORWARD-ONLY FIX. The like foundation (20260815121200_review_and_list_likes.sql)
-- created public.review_likes / public.list_likes, enabled RLS, and defined
-- least-privilege policies, but never GRANTed the underlying table privileges to
-- the `anon` / `authenticated` roles. As documented in
-- 20260806160000_grant_table_privileges.sql, this project intentionally leaves
-- `auto_expose_new_tables` unset, so brand-new tables receive *no* role
-- privileges at all. The SECURITY INVOKER mutations (set_review_like /
-- set_list_like) therefore failed with `42501 permission denied for table
-- review_likes` the moment an authenticated caller attempted an INSERT/DELETE
-- (surfaced by the pgTAP suite).
--
-- Privileges here are deliberately paired with the existing like policies:
--   * RLS still decides *which rows* each role may touch (own rows only:
--     `auth.uid() = user_id`);
--   * these GRANTs decide *which verbs* the role may attempt at all.
-- Aggregate counts and viewer bits continue to be served exclusively by the
-- SECURITY DEFINER read functions (get_review_like_states / get_list_like_states),
-- which own the tables and bypass these grants; the direct SELECT grant below is
-- narrowed by RLS to the caller's own rows, so liker identities are never
-- exposed to other users.

-- ---------------------------------------------------------------------------
-- Own-row reads (anon + authenticated). RLS restricts rows to auth.uid();
-- anon has a null uid and therefore sees nothing.
-- ---------------------------------------------------------------------------
grant select on table public.review_likes to anon, authenticated;
grant select on table public.list_likes   to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner writes (authenticated only). RLS binds every write to auth.uid().
-- A like is present or absent, so verbs mirror follows: insert/delete (no update).
-- ---------------------------------------------------------------------------
grant insert, delete on table public.review_likes to authenticated;
grant insert, delete on table public.list_likes   to authenticated;

-- ---------------------------------------------------------------------------
-- Trusted server role (server-only; bypasses RLS). Full DML for parity with the
-- other application tables.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on table public.review_likes to service_role;
grant select, insert, update, delete on table public.list_likes   to service_role;
