/**
 * Server wiring for trusted materialization.
 *
 * Combines the real server-only provider registry (TMDB + Open Library) with a
 * service-role admin client's `materialize_media_item` RPC into a ready
 * {@link CatalogMaterializer}. The RPC is wrapped behind the small
 * {@link CatalogRpcClient} seam so the pure materializer in `materialize.ts`
 * stays database-agnostic and unit-testable.
 *
 * Server-only: never import from a client component.
 */

import { createCatalogAdminClient } from "./admin-client";
import {
  createCatalogMaterializer,
  type CatalogRpcClient,
  type CatalogRpcResult,
} from "./materialize";
import { createServerProviderRegistry } from "./provider-registry";
import type { CatalogMaterializer } from "./types";

/**
 * Build the production {@link CatalogMaterializer}. Throws only if the
 * service-role admin config is missing (checked when the admin client is
 * created), so callers can decide how to degrade.
 */
export function createServerCatalogMaterializer(): CatalogMaterializer {
  const admin = createCatalogAdminClient();

  // Wrap the typed supabase-js client behind the minimal RPC seam. The cast
  // keeps the seam decoupled from the exact generated RPC signature while the
  // argument object is built and validated by the pure materializer.
  const rpc = admin.rpc.bind(admin) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  const rpcClient: CatalogRpcClient = {
    async rpc(fn, args): Promise<CatalogRpcResult> {
      const { data, error } = await rpc(fn, args);
      return { data, error: error ? { message: error.message } : null };
    },
  };

  return createCatalogMaterializer({
    registry: createServerProviderRegistry(),
    rpcClient,
  });
}
