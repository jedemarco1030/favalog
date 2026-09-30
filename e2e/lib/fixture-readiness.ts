import { expect, type Page } from "@playwright/test";

export const FIXTURE_SURFACES = [
  { id: "home", url: "/" },
  { id: "explore-empty", url: "/explore" },
  { id: "explore-search", url: "/explore?q=book" },
  { id: "title-detail", url: "/title/fixture-lantern-coast" },
] as const;

export async function waitForFixtureSurface(page: Page, capture = false) {
  const url = new URL(page.url());
  if (url.pathname === "/") {
    await expect(
      page
        .getByRole("heading", { name: "Fixture Lantern Coast", exact: true })
        .first(),
    ).toBeVisible();
    for (const name of [
      "Trending films",
      "Trending series",
      "Trending books",
    ]) {
      await expect(
        page.getByRole("region", { name, exact: true }),
      ).toBeVisible();
    }
  } else if (url.pathname === "/explore" && !url.searchParams.get("q")) {
    await expect(page.locator("[data-discovery-settled]")).toBeVisible();
    for (const name of ["Films", "Television", "Books"]) {
      await expect(
        page.getByRole("region", { name, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("region", { name: "Browse the catalog" }),
    ).toBeVisible();
  } else if (url.pathname === "/explore") {
    await expect(
      page.getByRole("heading", { name: "Fixture Field Guide", exact: true }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Fixture Lantern Coast",
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  if (capture) {
    await page.locator("main img").evaluateAll((images) => {
      for (const image of images) (image as HTMLImageElement).loading = "eager";
    });
  }
  const selector = capture
    ? "main img"
    : 'main img[src*="image.tmdb.org"], main img[src*="covers.openlibrary.org"], main img[src*="media.rawg.io"]';
  await expect(page.locator(selector).first()).toBeAttached();
  await expect
    .poll(() =>
      page.locator(selector).evaluateAll((nodes, includeOffscreen) => {
        const required = nodes.filter((node) => {
          const rect = node.getBoundingClientRect();
          return (
            rect.width > 0 &&
            (includeOffscreen || (rect.top < innerHeight && rect.bottom > 0))
          );
        });
        return (
          required.length > 0 &&
          required.every((node) => {
            const image = node as HTMLImageElement;
            return image.complete && image.naturalWidth > 0;
          })
        );
      }, capture),
    )
    .toBe(true);
  await page.locator(selector).evaluateAll(async (nodes) => {
    await Promise.all(
      nodes
        .filter((node) => (node as HTMLImageElement).complete)
        .map((node) => (node as HTMLImageElement).decode()),
    );
  });
  if (capture) {
    await expect
      .poll(() =>
        page.locator(selector).evaluateAll((nodes) =>
          nodes.every((node) => {
            const image = node as HTMLImageElement;
            return image.complete && image.naturalWidth > 0;
          }),
        ),
      )
      .toBe(true);
    await page.locator(selector).evaluateAll(async (nodes) => {
      await Promise.all(
        nodes.map((node) => (node as HTMLImageElement).decode()),
      );
    });
  }
}
