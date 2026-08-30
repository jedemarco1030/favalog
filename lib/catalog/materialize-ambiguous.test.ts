import { describe, expect, it } from "vitest";

import { createFakeProvider } from "./fake-provider";
import {
  AMBIGUOUS_MATERIALIZE_MESSAGE,
  createCatalogMaterializer,
  isAmbiguousMaterializeError,
  type CatalogRpcClient,
} from "./materialize";
import { createProviderRegistry } from "./provider-registry";

function registry() {
  return createProviderRegistry([createFakeProvider({ id: "tmdb" })]);
}

/** An RPC that always fails with a given DB error message. */
function failingRpc(message: string): CatalogRpcClient {
  return {
    async rpc() {
      return { data: null, error: { message } };
    },
  };
}

describe("materialize ambiguous canonical match handling", () => {
  it("maps the P0003 ambiguous fail-safe to a distinguishable validation error", async () => {
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: failingRpc("ambiguous external identity match"),
    });
    const error = await m
      .materialize({ provider: "tmdb", kind: "movie", externalId: "1001" })
      .catch((e) => e);

    expect(isAmbiguousMaterializeError(error)).toBe(true);
    expect(error).toMatchObject({ category: "validation" });
    expect(error.message).toBe(AMBIGUOUS_MATERIALIZE_MESSAGE);
  });

  it("keeps a generic DB write error as a non-ambiguous unavailable error", async () => {
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: failingRpc("some other db failure"),
    });
    const error = await m
      .materialize({ provider: "tmdb", kind: "movie", externalId: "1001" })
      .catch((e) => e);

    expect(isAmbiguousMaterializeError(error)).toBe(false);
    expect(error).toMatchObject({ category: "unavailable" });
  });

  it("isAmbiguousMaterializeError is false for unrelated values", () => {
    expect(isAmbiguousMaterializeError(new Error("boom"))).toBe(false);
    expect(isAmbiguousMaterializeError(undefined)).toBe(false);
    expect(isAmbiguousMaterializeError("nope")).toBe(false);
  });
});
