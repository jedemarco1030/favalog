# 0002 — Authentication & onboarding on Supabase Auth

- **Status:** Accepted
- **Date:** 2026-08-05
- **Phase:** 2 (authentication & onboarding)
- **Builds on:** [0001 — Supabase/PostgreSQL as the Favalog backend](0001-supabase-backend.md)

## Context

ADR 0001 established a Supabase foundation (migrations, RLS, `@supabase/ssr`
clients, a session-refresh `proxy.ts`, and a `handle_new_user` profile trigger)
without wiring any of it into the UI. Phase 2 needs a real, secure
authentication experience — sign up, sign in, email confirmation, password
reset, optional Google OAuth, session-aware navigation, and first-time profile
onboarding — while:

- keeping every public mock-data experience browsable without signing in;
- not migrating the product pages off `@/lib/data` and not adding persistent
  user actions (out of scope for this phase);
- still building and running with no Supabase environment variables set.

## Decision

Implement authentication with **Supabase Auth via `@supabase/ssr`**, following
the current Next.js 16 App Router guidance:

1. **Server-only Data Access Layer** (`lib/auth/data.ts`) is the single
   authorization boundary. `getCurrentUser`/`getCurrentProfile`/`requireUser`/
   `requireCompleteProfile` validate the session with `supabase.auth.getUser()`
   (never `getSession()`), are memoized with React `cache()`, and are marked
   `server-only`.
2. **Server Actions** handle all user-submitted forms (sign in/up, reset,
   update password, onboarding, sign out). Each re-validates input server-side,
   re-establishes the user, and depends on RLS as a second layer. **Route
   Handlers** handle the protocol callbacks that require them, split cleanly:
   `/auth/callback` for OAuth/PKCE code exchange and `/auth/confirm` for
   email-confirmation / recovery token-hash verification (no deprecated
   implicit-flow fragments, no duplicate callback).
3. **Pure, unit-tested helpers** carry the security-sensitive logic:
   `safe-redirect` (same-origin-only return-to), `validation`
   (normalize/validate mirroring DB constraints), `errors` (safe, neutral
   message mapping), `capability` (no-env detection), and `profile`
   (completeness). Keeping them pure makes them trivially testable without
   Supabase.
4. **Proxy = optimistic only.** `proxy.ts`/`updateSession` refreshes cookies and
   performs at most a lightweight `/onboarding` redirect; it is explicitly not
   the security boundary.
5. **Graceful no-env behavior.** All env access is non-throwing; with no
   Supabase config the app stays on mock data, auth entry points render a
   controlled unavailable state, and there is no module-import crash.
6. **Transitional profile strategy.** `/profile/[username]` keeps rendering the
   full mock profile for demo usernames and renders a minimal real-identity
   layer (with honest empty states) for usernames that resolve to a real
   Supabase profile. A real user is never attributed a mock user's activity.

## Alternatives considered

- **A dedicated `/account` route for the real identity instead of reusing
  `/profile/[username]`.** Cleaner boundary, but it fragments the profile
  concept and duplicates presentation. Rejected in favor of the hybrid route,
  which keeps a single profile surface and a clear migration path.
- **A single `getSession()`/`verifySession` helper used for every decision.**
  Simpler, but `getSession()` trusts unverified cookie contents and conflates
  "who is the user" with "is the user allowed". Rejected for distinct,
  intention-revealing DAL functions built on the validating `getUser()`.
- **Authorization in the proxy/middleware.** Convenient central choke point, but
  the framework guidance is explicit that the proxy must not be the only line of
  defense. Kept as an optimistic redirect only.
- **A new `onboarded_at` column to model completeness.** Unnecessary for the
  minimal definition (valid username + display name) the product chose; avoided
  an extra migration. Revisit if richer onboarding state is needed.
- **Client-side auth state (localStorage/context).** Causes an auth flash and is
  not a security boundary. Rejected; the shell reads the session on the server.

## Consequences

**Positive**

- One clear server-side authorization boundary; RLS backstops it in the DB.
- Security-critical logic is pure and unit-tested; UI degrades safely with no
  env.
- The product keeps running on mock data; only identity/onboarding is real.

**Negative / costs**

- The session-aware header adds a per-request `getUser()` call (mitigated by
  `cache()` and a `Suspense` boundary so the shell stays stable).
- The transitional profile route is intentionally hybrid until a later task
  migrates profiles to real data.

## Security implications

- Only public `NEXT_PUBLIC_` config reaches the browser; the secret key is never
  required for auth and is never read in client code.
- Every user-owned write is scoped to `auth.uid()` in both app code and RLS;
  client-provided ownership ids are never trusted.
- All redirect targets pass through `getSafeRedirectPath`; OAuth/email callback
  URLs are built from a trusted origin and constrained further by Supabase's
  redirect allow-list.
- Sign-up and password-reset responses are neutral (no account enumeration), and
  raw Supabase errors / unvalidated query params are never rendered.

## Note on this environment

Docker was unavailable when this phase was implemented (the daemon could not be
started), so the local Supabase stack could not run. Consequently
`supabase start`, `supabase db reset`, `supabase test db`, and
`supabase gen types` were **not** executed here: `lib/database.types.ts` remains
the clearly-labeled hand-authored placeholder (it already covers every table,
enum, and column the auth/onboarding flows require), and the new pgTAP tests
under `supabase/tests/database/` are committed but unexecuted locally. Regenerate
the types and run the database tests once a local stack is available
(`npm run supabase:types`, `npm run db:test`). The frontend build, unit/RTL
tests, Storybook build, and the secret-free Playwright specs do not require
Supabase and were run.
