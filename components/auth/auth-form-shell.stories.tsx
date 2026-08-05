import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AuthFormShell } from "@/components/auth/auth-form-shell";

const meta = {
  title: "Auth/AuthFormShell",
  component: AuthFormShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthFormShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Welcome back",
    subtitle: "Sign in to your Favalog account to continue.",
    children: (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium text-foreground/80"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="pass"
            className="text-sm font-medium text-foreground/80"
          >
            Password
          </label>
          <input
            id="pass"
            type="password"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button
          type="button"
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-strong"
        >
          Sign in
        </button>
      </div>
    ),
    footer: (
      <>
        <div className="flex gap-1">
          <span>Don&apos;t have an account?</span>
          <a href="#" className="text-accent hover:underline">
            Sign up
          </a>
        </div>
        <a href="#" className="text-accent hover:underline">
          Forgot your password?
        </a>
      </>
    ),
  },
};

export const WithoutSubtitle: Story = {
  args: {
    title: "Reset password",
    children: (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email-reset"
            className="text-sm font-medium text-foreground/80"
          >
            Email address
          </label>
          <input
            id="email-reset"
            type="email"
            placeholder="you@example.com"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button
          type="button"
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-strong"
        >
          Send reset link
        </button>
      </div>
    ),
    footer: (
      <a href="#" className="text-accent hover:underline">
        Return to sign in
      </a>
    ),
  },
};
