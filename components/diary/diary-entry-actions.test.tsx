import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The owner controls open dialogs backed by server-only Server Actions; mock
// them so this UI test never imports a `"use server"` module.
vi.mock("@/app/diary/actions", () => ({
  editDiaryEntryAction: vi.fn(),
  deleteDiaryEntryAction: vi.fn(),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { DiaryEntryActions } from "@/components/diary/diary-entry-actions";
import type { DiaryEntryView } from "@/components/diary/diary-view";

const baseEntry: DiaryEntryView = {
  id: "11111111-1111-1111-1111-111111111111",
  loggedAt: "2026-08-02T21:30:00.000Z",
  kind: "movie",
  action: "watched",
  rating: 4,
  slug: "afterglow",
  title: "Afterglow",
  year: 2023,
  posterUrl: "",
  edit: {
    isRevisit: false,
    reviewTitle: null,
    reviewBody: null,
    containsSpoilers: false,
  },
};

describe("DiaryEntryActions", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("renders nothing when the row has no owner edit payload", () => {
    const { container } = render(
      <DiaryEntryActions entry={{ ...baseEntry, edit: undefined }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes owner-only Edit and Delete controls", () => {
    render(<DiaryEntryActions entry={baseEntry} />);
    expect(
      screen.getByRole("button", { name: /Edit your log of Afterglow/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete your log of Afterglow/ }),
    ).toBeInTheDocument();
  });

  it("opens the pre-filled edit dialog", async () => {
    const user = userEvent.setup();
    render(<DiaryEntryActions entry={baseEntry} />);

    // A closed <dialog> is not in the accessibility tree.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Edit your log of Afterglow/ }),
    );
    expect(
      await screen.findByRole("dialog", { name: /Edit log/ }),
    ).toBeInTheDocument();
  });

  it("opens the delete confirmation dialog", async () => {
    const user = userEvent.setup();
    render(<DiaryEntryActions entry={baseEntry} />);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Delete your log of Afterglow/ }),
    );
    expect(
      await screen.findByRole("alertdialog", {
        name: /Delete this diary entry/i,
      }),
    ).toBeInTheDocument();
  });
});
