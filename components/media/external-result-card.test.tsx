import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ExternalResultCard,
  type MaterializeAction,
} from "@/components/media/external-result-card";
import type { ExternalResultView } from "@/lib/catalog/external-result-view-model";
import type { MaterializeFormState } from "@/app/explore/materialize-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

const importable: ExternalResultView = {
  provider: "tmdb",
  providerLabel: "TMDB",
  kind: "movie",
  externalId: "693134",
  title: "Dune: Part Two",
  year: 2024,
  posterUrl: "https://image.tmdb.org/t/p/w500/x.jpg",
  status: "importable",
};

const existing: ExternalResultView = {
  ...importable,
  status: "existing",
  existingSlug: "dune-part-two",
};

const noArt: ExternalResultView = {
  provider: "openlibrary",
  providerLabel: "Open Library",
  kind: "book",
  externalId: "OL45804W",
  title: "Dune",
  year: 1965,
  status: "importable",
};

const noop: MaterializeAction = async () => ({ status: "idle" });

function renderCard(
  result: ExternalResultView,
  overrides: Partial<Parameters<typeof ExternalResultCard>[0]> = {},
) {
  return render(
    <ExternalResultCard
      result={result}
      isAuthenticated
      signInHref="/auth/sign-in?returnTo=%2Fexplore"
      returnTo="/explore?q=dune"
      action={noop}
      {...overrides}
    />,
  );
}

describe("ExternalResultCard", () => {
  it("offers an accessible import action for an importable, authenticated result", () => {
    renderCard(importable);
    expect(
      screen.getByRole("button", { name: /add dune: part two to favalog/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/via TMDB/i)).toBeInTheDocument();
  });

  it("links straight to the canonical title and offers no import for an existing result", () => {
    renderCard(existing);
    const link = screen.getByRole("link", { name: /in your catalog/i });
    expect(link).toHaveAttribute("href", "/title/dune-part-two");
    expect(
      screen.queryByRole("button", { name: /add .* to favalog/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a neutral sign-in link (never a personalized action) when signed out", () => {
    renderCard(importable, { isAuthenticated: false });
    const link = screen.getByRole("link", { name: /sign in to add/i });
    expect(link).toHaveAttribute("href", "/auth/sign-in?returnTo=%2Fexplore");
    expect(
      screen.queryByRole("button", { name: /add .* to favalog/i }),
    ).not.toBeInTheDocument();
  });

  it("renders a graceful artwork fallback when the provider has no poster", () => {
    renderCard(noArt);
    expect(screen.getByText(/no artwork available/i)).toBeInTheDocument();
  });

  it("never renders a fabricated Favalog rating", () => {
    renderCard(importable);
    // No star/rating role is present for an external candidate.
    expect(screen.queryByText(/★|out of 5/i)).not.toBeInTheDocument();
  });

  it("disables the import button while pending to prevent double submission", async () => {
    const user = userEvent.setup();
    // An action that never resolves keeps the form in the pending state.
    const pending: MaterializeAction = () =>
      new Promise<MaterializeFormState>(() => {});
    renderCard(importable, { action: pending });

    const button = screen.getByRole("button", {
      name: /add dune: part two to favalog/i,
    });
    await user.click(button);
    expect(button).toBeDisabled();
  });
});
