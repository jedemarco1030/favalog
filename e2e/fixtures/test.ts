import { test as base } from "@playwright/test";
import { routeProviderArtwork } from "../lib/fixture-artwork";

export const test = base.extend({
  context: async ({ context }, provide) => {
    await routeProviderArtwork(context);
    await provide(context);
  },
});
export { expect } from "@playwright/test";
