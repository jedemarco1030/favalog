import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { RealListItems } from "@/components/lists/real-list-items";
import type { ListItemFormState } from "@/app/lists/list-form";
import type { ListDetailItemView } from "@/lib/supabase/list-view-model";

const items: ListDetailItemView[] = [
  {
    mediaId: "m1",
    position: 1,
    slug: "afterglow",
    title: "Afterglow",
    year: 2024,
    kind: "movie",
    posterUrl: "",
  },
  {
    mediaId: "m2",
    position: 2,
    slug: "the-long-quiet",
    title: "The Long Quiet",
    year: 2023,
    kind: "book",
    posterUrl: "",
  },
];

function renderItems(
  overrides: Partial<Parameters<typeof RealListItems>[0]> = {},
) {
  const removeAction = vi.fn(async (): Promise<ListItemFormState> => ({
    status: "idle",
  }));
  render(
    <RealListItems
      listId="l1"
      listTitle="Favorite Sci-Fi"
      isRanked={false}
      isOwner={false}
      items={items}
      returnTo="/list/favorite-sci-fi"
      removeAction={removeAction}
      {...overrides}
    />,
  );
  return { removeAction };
}

describe("RealListItems", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("links each item to its title route", () => {
    renderItems();
    const afterglow = screen.getByRole("link", { name: "Afterglow" });
    expect(afterglow).toHaveAttribute("href", "/title/afterglow");
    const longQuiet = screen.getByRole("link", { name: "The Long Quiet" });
    expect(longQuiet).toHaveAttribute("href", "/title/the-long-quiet");
  });

  it("shows 1-based rank numbers for a ranked list", () => {
    renderItems({ isRanked: true });
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows no remove controls for a non-owner", () => {
    renderItems({ isOwner: false });
    expect(
      screen.queryByRole("button", { name: /Remove .* from Favorite Sci-Fi/ }),
    ).not.toBeInTheDocument();
  });

  it("lets the owner open the confirm dialog for an item", async () => {
    const user = userEvent.setup();
    renderItems({ isOwner: true });

    const removeAfterglow = screen.getByRole("button", {
      name: "Remove Afterglow from Favorite Sci-Fi",
    });
    expect(removeAfterglow).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Remove The Long Quiet from Favorite Sci-Fi",
      }),
    ).toBeInTheDocument();

    await user.click(removeAfterglow);

    const dialog = await screen.findByRole("alertdialog", {
      name: /Remove this title/i,
    });
    expect(dialog).toHaveTextContent("Afterglow");
    expect(dialog).toHaveTextContent("Favorite Sci-Fi");
    expect(
      within(dialog).getByRole("button", { name: "Remove title" }),
    ).toBeInTheDocument();
  });
});
