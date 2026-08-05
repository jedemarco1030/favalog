import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

/**
 * Root Proxy (Next.js 16's renamed middleware convention — see the bundled docs
 * at `node_modules/next/dist/docs/01-app/.../file-conventions/proxy.md`).
 *
 * Its sole responsibility is Supabase auth session-cookie refresh via
 * `updateSession`. There is deliberately NO route authorization here yet; that
 * arrives with the authentication task. While Supabase is unconfigured (the
 * current mock-data deployment) `updateSession` is a no-op pass-through.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /*
   * Run on application routes only. Exclude Next.js internals, static assets,
   * and common image extensions so cookie refresh never blocks CSS/JS/images
   * and never runs for static files.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
