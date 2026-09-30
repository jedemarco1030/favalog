-- Disposable, rolled-back tests. Hosted catalog and user data are never touched.
begin;
select plan(22);

create temporary table _demo_before as
  select id, slug, external_id, title, average_rating from public.media_items
  where source = 'favalog' and external_id in ('m_duneparttwo', 't_paperwatch', 't_undertheeaves');
create temporary table _references_before as
  select 'diary' as kind, id, media_id from public.diary_entries
  union all select 'reviews', id, media_id from public.reviews
  union all select 'favorites', id, media_id from public.favorites
  union all select 'lists', id, media_id from public.list_items;

select ok((select relrowsecurity from pg_class where oid = 'public.media_items'::regclass), 'catalog RLS remains enabled');
select ok(not has_table_privilege('anon', 'public.media_items', 'INSERT'), 'anonymous catalog writes remain forbidden');
select ok(not has_table_privilege('authenticated', 'public.media_items', 'UPDATE'), 'authenticated catalog writes remain forbidden');
select is((select count(*)::integer from _demo_before where id = md5('favalog:' || external_id)::uuid), 3, 'immutable legacy IDs still exist');
select is((select count(*)::integer from public.keyword_search('Paper Watch', null, 50) where media_id = md5('favalog:t_paperwatch')::uuid), 0, 'keyword search hides the exact Paper Watch demonstration');
select is((select count(*)::integer from public.keyword_search('Under the Eaves', null, 50) where media_id = md5('favalog:t_undertheeaves')::uuid), 0, 'keyword search hides the exact Under the Eaves demonstration');

insert into public.media_items (id, kind, source, external_id, slug, title, year)
values ('99000000-0000-0000-0000-000000000001', 'movie', 'favalog', 'curated-demo-test', 'curated-demo-test', 'Verified Internal Catalog Test', 2024);
select is((select count(*)::integer from public.keyword_search('Verified Internal Catalog Test', null, 50) where slug = 'curated-demo-test'), 1, 'legitimate internal media remains discoverable');

-- Remove ONLY an unrelated local SEARCH fixture to isolate the name collision;
-- the historical Dune demonstration and every saved reference are preserved.
delete from public.media_items where source = 'favalog' and external_id = 'test-fixture:m_duneparttwo';
create temporary table _import as select public.materialize_external_media(
  'tmdb', 'movie', 'movie:693134', 'Dune: Part Two', null, 'Provider metadata', 2024,
  null, null, 4.5, array['Science Fiction'], '{}'::jsonb, repeat('a', 64), 'v1'
) as result;
select is((select result->>'resolution' from _import), 'created', 'a genuine provider title creates its own identity despite the demo name');
select is((select slug from public.media_items where id = md5('favalog:m_duneparttwo')::uuid), 'dune-part-two', 'the saved demonstration route is not renamed');
select isnt((select (result->>'media_id')::uuid from _import), md5('favalog:m_duneparttwo')::uuid, 'provider identity is not silently merged into a demo');
select is((public.materialize_external_media(
  'tmdb', 'movie', 'movie:693134', 'Dune: Part Two', null, 'Provider metadata', 2024,
  null, null, 4.5, array['Science Fiction'], '{}'::jsonb, repeat('a', 64), 'v1'
)->>'media_id'), (select result->>'media_id' from _import), 'repeat import resolves the same canonical provider identity');
select is((select count(*)::integer from public.media_items where source = 'tmdb' and external_id = 'movie:693134'), 1, 'provider identity remains unique');
select is((select count(*)::integer from public.keyword_search('Dune: Part Two', 'movie', 50) where media_id = (select (result->>'media_id')::uuid from _import)), 1, 'the real provider title is discoverable immediately');
select results_eq(
  'select id, slug, external_id, title, average_rating from public.media_items where id in (select id from _demo_before) order by id',
  'select id, slug, external_id, title, average_rating from _demo_before order by id',
  'demo IDs, immutable routes, metadata, and historical ratings are preserved in storage');
select results_eq(
  $$select kind, id, media_id from (select 'diary' as kind, id, media_id from public.diary_entries union all select 'reviews', id, media_id from public.reviews union all select 'favorites', id, media_id from public.favorites union all select 'lists', id, media_id from public.list_items) r order by kind, id$$,
  'select kind, id, media_id from _references_before order by kind, id',
  'all existing diary, review, favorite, and list references survive');
select ok(not has_function_privilege('anon', 'public.materialize_external_media(text,public.media_kind,text,text,text,text,integer,text,text,numeric,text[],jsonb,text,text)', 'EXECUTE'), 'anonymous materialization remains forbidden');
select ok(not has_function_privilege('authenticated', 'public.materialize_external_media(text,public.media_kind,text,text,text,text,integer,text,text,numeric,text[],jsonb,text,text)', 'EXECUTE'), 'authenticated direct materialization remains forbidden');

insert into public.media_search_documents (media_id, content, content_hash, document_version, embedding, embedding_provider, embedding_model, embedding_dimensions, embedded_at)
select id, 'test', repeat('b', 64), 'v1', ('[1' || repeat(',0',511) || ']')::extensions.vector,
  'fake', 'demo-isolation-test', 512, now()
from public.media_items where id in (md5('favalog:t_paperwatch')::uuid, '99000000-0000-0000-0000-000000000001'::uuid)
on conflict (media_id) do update set embedding = excluded.embedding, embedding_provider = excluded.embedding_provider, embedding_model = excluded.embedding_model, embedding_dimensions = excluded.embedding_dimensions, document_version = excluded.document_version, embedded_at = excluded.embedded_at;
select is(public.compatible_embedding_count('fake','demo-isolation-test',512,'v1'), 1, 'the compatible corpus excludes demonstration embeddings');
select is((select count(*)::integer from public.semantic_search(('[1' || repeat(',0',511) || ']')::extensions.vector,'fake','demo-isolation-test',512,'v1',null,50,null) where media_id = md5('favalog:t_paperwatch')::uuid), 0, 'semantic search excludes demonstration embeddings');
select is((select count(*)::integer from public.hybrid_search('Paper Watch',('[1' || repeat(',0',511) || ']')::extensions.vector,'fake','demo-isolation-test',512,'v1',null,50,null) where media_id = md5('favalog:t_paperwatch')::uuid), 0, 'both hybrid arms exclude demonstrations');

insert into public.media_external_ids (media_id, provider, kind, external_id)
values (md5('favalog:t_paperwatch')::uuid, 'tmdb', 'tv', 'tv:999991');
select throws_ok($$select public.materialize_external_media('tmdb','tv','tv:999991','Paper Watch',null,'',2023,null,null,null,array[]::text[],'{}'::jsonb,repeat('c',64),'v1')$$, 'P0003', null, 'a new exact alias conflict fails safely rather than merging identities');
select is((select media_id from public.media_external_ids where provider='tmdb' and external_id='tv:999991'), md5('favalog:t_paperwatch')::uuid, 'conflicting alias is preserved for explicit owner reconciliation');

select finish();
rollback;
