-- Favalog AI Discovery v1 (2/3): pgvector + the private embedding store.
--
-- Enables the `vector` extension (in the dedicated `extensions` schema, per
-- Supabase convention) and creates public.media_search_documents: one embedding
-- row per catalog title, holding the exact canonical text that was embedded, a
-- deterministic content hash for staleness detection, the provider/model/
-- dimension provenance, and the embedding vector itself.
--
-- SECURITY POSTURE:
--   * The table is PRIVATE. RLS is enabled with NO policies, and SELECT/INSERT/
--     UPDATE/DELETE are revoked from anon + authenticated. Ordinary browser
--     roles therefore have NO access at all — they can neither read the raw
--     vectors (never exposed through the Data API) nor write embedding rows.
--   * Only service_role (used by the trusted, server-only embedding pipeline
--     with the secret key) is granted write access; it also bypasses RLS.
--   * Read access for search is provided EXCLUSIVELY through the narrowly scoped
--     SECURITY DEFINER search functions added in the next migration, which
--     return only safe catalog fields + ranking metadata — never raw vectors.
--
-- Rows cascade-delete with their media (FK ON DELETE CASCADE), so removing a
-- catalog title can never orphan an embedding.

create extension if not exists vector with schema extensions;

create table if not exists public.media_search_documents (
  -- One embedding document per catalog title; the PK is the FK so there is
  -- exactly one row per media and it disappears with its media.
  media_id uuid primary key
    references public.media_items (id) on delete cascade,

  -- The EXACT canonical text that was (or will be) sent to the provider. Stored
  -- for reproducibility/auditing and as the input the content hash is taken of.
  content text not null,
  -- Deterministic SHA-256 (hex) of the versioned canonical document. Drives
  -- "unchanged rows are not re-embedded" and "a content change marks staleness":
  -- the pipeline recomputes the hash from the current catalog row and compares.
  content_hash text not null,
  -- Version of the canonical-document FORMAT the content/hash were produced
  -- under; bumping the app-side version invalidates every hash → intentional
  -- re-embed.
  document_version text not null default 'v1',

  -- The embedding and its provenance. All five are null together until the row
  -- is embedded (enforced by the CHECK below), so a content row can exist and
  -- power keyword search before any semantic embedding exists.
  embedding extensions.vector(512),
  embedding_model text,
  embedding_provider text,
  embedding_dimensions integer,
  embedded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint media_search_documents_content_not_blank
    check (char_length(btrim(content)) > 0),
  constraint media_search_documents_content_hash_format
    check (content_hash ~ '^[0-9a-f]{64}$'),
  -- The chosen dimensionality is part of the embedding identity.
  constraint media_search_documents_dimensions_ck
    check (embedding_dimensions is null or embedding_dimensions = 512),
  -- Embedding + its provenance are all-or-nothing: either the row is unembedded
  -- (all five null) or fully embedded (all five present). This prevents a vector
  -- without a recorded model, or provenance without a vector.
  constraint media_search_documents_embedding_provenance_ck
    check (
      (embedding is null
        and embedding_model is null
        and embedding_provider is null
        and embedding_dimensions is null
        and embedded_at is null)
      or
      (embedding is not null
        and embedding_model is not null
        and embedding_provider is not null
        and embedding_dimensions is not null
        and embedded_at is not null)
    )
);

comment on table public.media_search_documents is
  'PRIVATE per-title embedding store for AI Discovery. Holds the canonical embedded text, its content hash (staleness), provider/model/dimension provenance, and the pgvector embedding. RLS-enabled with NO policies and no anon/authenticated grants: raw vectors are never exposed through the Data API. Read only via the SECURITY DEFINER search functions (safe fields + rank only); written only by the trusted server-side pipeline (service_role).';
comment on column public.media_search_documents.embedding is
  'The pgvector embedding (cosine space). NEVER returned to clients; the search functions expose only safe catalog fields and ranking metadata.';
comment on column public.media_search_documents.content_hash is
  'Deterministic SHA-256 (hex) of the versioned canonical document. Used to skip unchanged rows and to detect catalog-content changes as stale.';

-- Approximate-nearest-neighbour index for cosine distance. HNSW gives good
-- recall/latency for a small corpus; the operator class lives in `extensions`.
create index if not exists media_search_documents_embedding_hnsw
  on public.media_search_documents
  using hnsw (embedding extensions.vector_cosine_ops);

-- Keep updated_at fresh on every write (reuses the shared trigger function).
drop trigger if exists media_search_documents_set_updated_at
  on public.media_search_documents;
create trigger media_search_documents_set_updated_at
  before update on public.media_search_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: lock the table down to the trusted server pipeline only.
-- ---------------------------------------------------------------------------
alter table public.media_search_documents enable row level security;

revoke all on table public.media_search_documents from anon;
revoke all on table public.media_search_documents from authenticated;
grant select, insert, update, delete
  on table public.media_search_documents to service_role;
