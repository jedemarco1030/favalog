-- Favalog: make real list slugs GLOBALLY unique so /list/[slug] resolves to
-- exactly one list.
--
-- ROUTE-IDENTITY DECISION (forward-only):
--   The application route is /list/[slug]. A slug that is unique only per owner
--   (the original lists_user_id_slug_key) cannot identify one list globally, so
--   a real-list read off [slug] would be ambiguous. We therefore add a global
--   UNIQUE index on lists.slug. This is strictly stricter than the existing
--   per-owner index (which is kept, harmlessly, since migrations are immutable
--   and forward-only). All slugs are generated SERVER-SIDE by public.create_list
--   (never accepted from the browser) with a deterministic collision-safe
--   suffix, so a list's slug is immutable and renaming its title never changes
--   the URL.
--
-- SAFETY:
--   Persistent list creation was never previously exposed, so real rows are
--   expected to be absent and this index will build cleanly. The guard below
--   makes the migration FAIL LOUDLY with a descriptive message (rather than a
--   bare duplicate-key error) in the unexpected event that duplicate slugs
--   already exist across owners.

do $$
declare
  v_dup_groups int;
begin
  select count(*) into v_dup_groups
  from (
    select slug
    from public.lists
    group by slug
    having count(*) > 1
  ) d;

  if v_dup_groups > 0 then
    raise exception
      'cannot add global-unique list slug index: % duplicate slug(s) exist across owners',
      v_dup_groups
      using hint = 'Resolve duplicate lists.slug values before applying this migration.';
  end if;
end $$;

-- Forward-only global uniqueness for real list slugs.
create unique index lists_slug_global_key on public.lists (slug);

comment on index public.lists_slug_global_key is
  'Global uniqueness for list slugs so /list/[slug] resolves to exactly one list. Slugs are generated server-side by public.create_list and are immutable.';
