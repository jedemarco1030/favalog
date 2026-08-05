# 0001 — Supabase/PostgreSQL as the Favalog backend

- **Status:** Accepted
- **Date:** 2026-08-05
- **Phase:** 2 (backend foundation)

## Context

The Favalog frontend MVP is complete and stable on a typed mock-data layer
(`@/lib/data`) with strict domain types (`lib/types.ts`). The next phase needs a
real backend that can eventually provide:

- authentication and per-user identity;
- persistence for diary entries, reviews, lists, favorites, and follows;
- a unified media catalog (movies / TV / books);
- authorization that cannot be bypassed by a compromised or malicious client.

Requirements for the choice:

- keep the framework-agnostic domain model and the mock-data-first architecture
  intact during the transition;
- a first-class **local** development story (no cloud dependency for ordinary
  work or CI);
- authorization enforced at the data layer, not only in application code;
- version-controlled, reviewable schema changes;
- typed access from a strict-TypeScript codebase.

## Decision

Adopt **Supabase (managed PostgreSQL + Auth + Row Level Security)** with the
**Supabase CLI** for local development, using:

- SQL **migrations** under `supabase/migrations/` as the single source of truth;
- **Row Level Security** on every public table for authorization;
- the current supported client packages **`@supabase/supabase-js`** and
  **`@supabase/ssr`** (cookie-based clients for the Next.js App Router);
- **generated TypeScript types** (`supabase gen types`) kept behind a mapping
  boundary so they never replace the domain model.

The Supabase CLI is added as a **dev dependency** so setup is reproducible.
Next.js/Turbopack remains the application framework and build system.

## Alternatives considered

- **Custom PostgreSQL backend (bespoke API + auth).** Maximum control, but we
  would rebuild authentication, RLS tooling, migrations, local orchestration,
  and type generation ourselves — significant effort with no near-term payoff.
- **Prisma + hosted Postgres.** Excellent DX and typed queries, but Prisma’s
  authorization lives in application code; it does not give database-enforced
  per-row security, and it would push us toward an ORM-centric model rather than
  portable SQL migrations. Rejected for this security-first phase (and the task
  explicitly excludes adding an ORM).
- **Another backend-as-a-service (e.g. Firebase).** Viable auth + hosting, but a
  document database is a poor fit for Favalog’s highly relational model
  (media ↔ diary ↔ reviews ↔ lists ↔ follows), and it lacks SQL migrations and
  RLS.

## Consequences

**Positive**

- Authorization is enforced in the database via RLS, independent of UI or API
  bugs.
- Schema is portable, reviewable SQL; changes are ordinary migrations.
- The full stack runs locally through the CLI; types are generated, not
  hand-written.
- The existing frontend is untouched and keeps running on mock data.

**Negative / costs**

- Local database work requires **Docker**, which is not always available (it was
  unavailable in the environment where this foundation was created — see below).
- RLS policies add cognitive overhead and must be tested deliberately.
- A JSONB `details` column on the catalog trades some schema rigidity for
  cross-kind flexibility; correctness of those fields is enforced at the mapping
  boundary rather than by the database.

## Security implications

- Only **public** configuration is exposed to the browser, via `NEXT_PUBLIC_`
  variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
- The **secret (service-role) key**, database password, and privileged
  connection strings are **server-only**, never committed, never logged, and not
  required for normal application startup.
- RLS policies are explicit and least-privilege; no `using (true) with check
(true)` policies exist for user-owned writes.
- Catalog writes are restricted to trusted server-side processes (service role);
  browser clients get read-only catalog access.
- The profile-provisioning trigger is `SECURITY DEFINER` with a pinned
  `search_path`, per current Supabase guidance.

## Future migration considerations

- Wire authentication (login/signup) and route protection on top of the
  session-refresh `proxy.ts` already in place.
- Introduce Supabase-backed fetchers/repositories behind `@/lib/data`, mapping
  rows to domain types — the UI should not change.
- Ingest a real media provider through the stable `(source, external_id)`
  identity without a schema change.
- Add real likes persistence and evaluate a dedicated activity/event table only
  when derived activity becomes too expensive.
- Enforce followers-only list visibility once the `follows` relationship powers
  a policy.

## Note on this environment

Docker was unavailable when this foundation was authored, so the local Supabase
stack could not be started. Consequently `supabase db reset`, `supabase test
db`, and `supabase gen types` were **not** executed here. All configuration,
migrations, seed, tests, clients, and scripts are in place; the generated types
file is a clearly-labeled hand-authored placeholder to be regenerated via
`npm run supabase:types` once Docker is available. See the README and
`docs/backend-architecture.md`.
