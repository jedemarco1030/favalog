import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/auth/actions", () => ({
  completeOnboardingAction: vi.fn(async () => ({ status: "idle" })),
}));

import { OnboardingForm } from "@/components/auth/onboarding-form";

describe("OnboardingForm", () => {
  it("renders required identity fields and optional bio/location", () => {
    render(<OnboardingForm />);

    expect(screen.getByLabelText("Display name")).toBeRequired();
    expect(screen.getByLabelText("Username")).toBeRequired();
    expect(screen.getByLabelText("Bio (optional)")).not.toBeRequired();
    expect(screen.getByLabelText("Location (optional)")).not.toBeRequired();
    expect(
      screen.getByRole("button", { name: "Finish setup" }),
    ).toBeInTheDocument();
  });

  it("prefills known values from auth metadata", () => {
    render(
      <OnboardingForm
        defaultUsername="jamie"
        defaultDisplayName="Jamie DeMarco"
      />,
    );

    expect(screen.getByLabelText("Username")).toHaveValue("jamie");
    expect(screen.getByLabelText("Display name")).toHaveValue("Jamie DeMarco");
  });
});
