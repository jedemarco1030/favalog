-- Exact historical identities, not all internal catalog rows. No media or
-- user-owned rows, aliases, slugs, or IDs are rewritten. Function signatures,
-- return fields, grants, ranking, cutoff, and removal filtering stay unchanged.
-- Guarded edits use the final installed definitions so RAWG and prior search
-- fixes are preserved. Fail closed if a future definition changes these anchors.
do $migration$
declare
  signature text;
  definition text;
  updated_definition text;
  excluded_ids constant text := $ids$'m_afterglow','m_paperlantern','m_lowcountry','m_duneparttwo','m_quietsignal','m_thecartographer','m_nightferry','m_arclighthouse','m_bluehourrun','m_slowmountain','t_northlight','t_gildedroom','t_harbourlines','t_latecheckin','t_signalglass','t_ridgeandriver','t_paperwatch','t_undertheeaves','b_smallhours','b_orbital_notes','b_bright_index','b_salt_tide','b_weight_of_sand','b_northroom','b_paperbirds','b_quietinstruments','b_seasofglass','b_theslowdial'$ids$;
  search_predicate text;
  candidate_predicate text;
begin
  -- A real alias on a legacy demonstration requires a separate reviewed
  -- identity reconciliation. Never silently detach or redirect that alias.
  if exists (
    select 1 from public.media_external_ids a
    join public.media_items m on m.id = a.media_id
    where m.source = 'favalog'
      and m.external_id = any(string_to_array(replace(excluded_ids, '''', ''), ','))
  ) then
    raise exception 'demonstration provider alias needs explicit owner reconciliation';
  end if;

  search_predicate := 'mi.provider_removed_at is null and not (mi.source = ''favalog'' and mi.external_id in (' || excluded_ids || '))';
  foreach signature in array array[
    'public.keyword_search(text,public.media_kind,integer)',
    'public.semantic_search(extensions.vector,text,text,integer,text,public.media_kind,integer,real)',
    'public.hybrid_search(text,extensions.vector,text,text,integer,text,public.media_kind,integer,real)',
    'public.compatible_embedding_count(text,text,integer,text)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if strpos(definition, 'mi.provider_removed_at is null') = 0 then
      raise exception 'missing discovery anchor in %', signature;
    end if;
    updated_definition := replace(definition, 'mi.provider_removed_at is null', search_predicate);
    execute updated_definition;
  end loop;

  signature := 'public.materialize_external_media(text,public.media_kind,text,text,text,text,integer,text,text,numeric,text[],jsonb,text,text)';
  definition := pg_get_functiondef(signature::regprocedure);
  candidate_predicate := 'where m.kind = p_kind and not (m.source = ''favalog'' and m.external_id in (' || excluded_ids || '))';
  if (length(definition) - length(replace(definition, 'where m.kind = p_kind', ''))) / length('where m.kind = p_kind') <> 2 then
    raise exception 'unexpected deterministic candidate definition';
  end if;
  updated_definition := replace(definition, 'where m.kind = p_kind', candidate_predicate);
  -- Exact aliases remain authoritative, but a newly introduced demo alias is
  -- an error rather than a silent identity merge. Application error mapping
  -- already treats P0003 as a controlled identity conflict.
  if strpos(updated_definition, 'if v_media_id is not null then') = 0 then
    raise exception 'missing exact identity anchor';
  end if;
  updated_definition := replace(updated_definition, 'if v_media_id is not null then',
    'if v_media_id is not null and exists (select 1 from public.media_items m where m.id = v_media_id and m.source = ''favalog'' and m.external_id in (' || excluded_ids || ')) then raise exception ''demonstration identity conflict'' using errcode = ''P0003''; end if; if v_media_id is not null then');
  execute updated_definition;
end;
$migration$;
