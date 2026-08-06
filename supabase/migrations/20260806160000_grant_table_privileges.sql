-- Favalog: table-level privilege grants for the Data API roles.
--
-- FORWARD-ONLY FIX. The RLS foundation (20260805150700_row_level_security.sql)
-- enabled RLS and created least-privilege policies, but never GRANTed the
-- underlying table privileges to the `anon` / `authenticated` roles. Because
-- this project intentionally leaves `auto_expose_new_tables` unset (the modern
-- cloud default — new entities are NOT auto-exposed), those roles had *no*
-- privileges at all, so every policy-guarded read/write failed with
-- `42501 permission denied` (surfaced by the pgTAP suite).
--
-- Privileges here are deliberately paired with the existing policies:
--   * RLS still decides *which rows* each role may touch;
--   * these GRANTs decide *which verbs* the role may attempt at all.
-- Granting a verb without a matching policy is still safe — RLS denies the rows.
--
-- The catalog (`media_items`) is public-READ only for anon/authenticated; its
-- writes remain restricted to trusted server-side processes (service_role /
-- migrations), never the browser. `service_role` (server-only, bypasses RLS)
-- receives full DML so trusted ingestion keeps working.

-- ---------------------------------------------------------------------------
-- Public reads (anon + authenticated). RLS narrows rows where applicable
-- (e.g. private lists remain invisible via the existing SELECT policies).
-- ---------------------------------------------------------------------------
grant select on table public.profiles      to anon, authenticated;
grant select on table public.media_items   to anon, authenticated;
grant select on table public.diary_entries to anon, authenticated;
grant select on table public.reviews       to anon, authenticated;
grant select on table public.lists         to anon, authenticated;
grant select on table public.list_items    to anon, authenticated;
grant select on table public.favorites     to anon, authenticated;
grant select on table public.follows       to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner writes (authenticated only). RLS binds every write to auth.uid().
-- Verbs mirror the policies defined in the RLS migration:
--   profiles   : insert/update (no delete policy — deletion cascades from auth)
--   follows    : insert/delete (a relationship is present or absent)
--   everything : full insert/update/delete
-- media_items is intentionally omitted: no catalog writes for ordinary users.
-- ---------------------------------------------------------------------------
grant insert, update                 on table public.profiles      to authenticated;
grant insert, update, delete         on table public.diary_entries to authenticated;
grant insert, update, delete         on table public.reviews       to authenticated;
grant insert, update, delete         on table public.lists         to authenticated;
grant insert, update, delete         on table public.list_items    to authenticated;
grant insert, update, delete         on table public.favorites     to authenticated;
grant insert, delete                 on table public.follows       to authenticated;

-- ---------------------------------------------------------------------------
-- Trusted server role (server-only; bypasses RLS). Full DML including the
-- catalog, so provider/curation ingestion keeps working without the browser.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on table public.profiles      to service_role;
grant select, insert, update, delete on table public.media_items   to service_role;
grant select, insert, update, delete on table public.diary_entries to service_role;
grant select, insert, update, delete on table public.reviews       to service_role;
grant select, insert, update, delete on table public.lists         to service_role;
grant select, insert, update, delete on table public.list_items    to service_role;
grant select, insert, update, delete on table public.favorites     to service_role;
grant select, insert, update, delete on table public.follows       to service_role;
