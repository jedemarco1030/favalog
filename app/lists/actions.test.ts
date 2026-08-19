import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server Action contract for deleting a whole list.
 *
 * The regression this guards: a successful deletion must navigate the person
 * away from the now-deleted `/list/[slug]` authoritatively FROM THE SERVER, not
 * from a client effect that revalidation could unmount first. We prove that on
 * a validated success `deleteListAction` calls `redirect("/lists")` — and only
 * after the underlying `deleteList` write path (which awaits every required
 * revalidation, including the deleted route) has returned success — while the
 * safe auth / onboarding and error / unavailable states are preserved and never
 * trigger a server redirect.
 */

// `redirect` throws in Next.js to abort rendering; model that faithfully so the
// action's success path is provably terminal.
const redirect = vi.fn((path: string): never => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

const deleteList = vi.fn();
vi.mock("@/lib/supabase/lists", () => ({
  addListItem: vi.fn(),
  createList: vi.fn(),
  removeListItem: vi.fn(),
  updateList: vi.fn(),
  deleteList: (...args: unknown[]) => deleteList(...args),
}));

import { deleteListAction } from "@/app/lists/actions";
import { initialDeleteListFormState } from "@/app/lists/list-form";

function deleteFormData(extra: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("listId", "11111111-1111-1111-1111-111111111111");
  for (const [key, value] of Object.entries(extra)) formData.set(key, value);
  return formData;
}

describe("deleteListAction", () => {
  beforeEach(() => {
    redirect.mockClear();
    deleteList.mockReset();
  });

  it("redirects to /lists after a validated successful deletion", async () => {
    deleteList.mockResolvedValue({
      status: "success",
      listId: "11111111-1111-1111-1111-111111111111",
      slug: "favorite-sci-fi",
    });

    await expect(
      deleteListAction(initialDeleteListFormState, deleteFormData()),
    ).rejects.toThrow("NEXT_REDIRECT:/lists");

    // The write path (which performs all revalidation) ran exactly once, and
    // navigation is server-authoritative.
    expect(deleteList).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/lists");
  });

  it("returns a safe error state and never redirects on failure", async () => {
    deleteList.mockResolvedValue({
      status: "error",
      message: "We couldn't delete that list.",
    });

    const result = await deleteListAction(
      initialDeleteListFormState,
      deleteFormData(),
    );

    expect(result).toEqual({
      status: "error",
      message: "We couldn't delete that list.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("hands an unauthenticated result back to the client for the safe sign-in redirect", async () => {
    deleteList.mockResolvedValue({ status: "unauthenticated" });

    const result = await deleteListAction(
      initialDeleteListFormState,
      deleteFormData({ returnTo: "/list/favorite-sci-fi" }),
    );

    expect(result.status).toBe("unauthenticated");
    expect(result.redirectTo).toBe(
      "/auth/sign-in?returnTo=%2Flist%2Ffavorite-sci-fi",
    );
    // The auth / onboarding cases stay client-driven; the server never redirects.
    expect(redirect).not.toHaveBeenCalled();
  });

  it("surfaces an unavailable environment without redirecting", async () => {
    deleteList.mockResolvedValue({ status: "unavailable" });

    const result = await deleteListAction(
      initialDeleteListFormState,
      deleteFormData(),
    );

    expect(result.status).toBe("unavailable");
    expect(redirect).not.toHaveBeenCalled();
  });
});
