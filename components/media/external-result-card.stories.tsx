import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ExternalResultCard } from "@/components/media/external-result-card";
import type { ExternalResultView } from "@/lib/catalog/external-result-view-model";
import type { MaterializeFormState } from "@/app/explore/materialize-form";

const importable: ExternalResultView = {
  provider: "tmdb",
  providerLabel: "TMDB",
  kind: "movie",
  externalId: "693134",
  title: "Dune: Part Two",
  year: 2024,
  posterUrl: "https://image.tmdb.org/t/p/w500/czembW0Rk1Ke7lCJGahbOhdCuhV.jpg",
  status: "importable",
};

const existing: ExternalResultView = {
  ...importable,
  status: "existing",
  existingSlug: "dune-part-two",
};

const noArtwork: ExternalResultView = {
  provider: "openlibrary",
  providerLabel: "Open Library",
  kind: "book",
  externalId: "OL45804W",
  title: "Dune",
  year: 1965,
  status: "importable",
};

/** A no-op action that returns to idle (used by the static states). */
const idleAction = async (): Promise<MaterializeFormState> => ({
  status: "idle",
});

const meta = {
  title: "Media/ExternalResultCard",
  component: ExternalResultCard,
  parameters: { layout: "centered" },
  args: {
    isAuthenticated: true,
    signInHref: "/auth/sign-in?returnTo=%2Fexplore",
    returnTo: "/explore?q=dune",
    action: idleAction,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 220 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ExternalResultCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A title not yet in Favalog: an authenticated viewer can import it. */
export const Importable: Story = { args: { result: importable } };

/** A title already in Favalog: links straight to its canonical page, no import. */
export const AlreadyInFavalog: Story = { args: { result: existing } };

/** A provider result with no artwork falls back gracefully. */
export const MissingArtwork: Story = { args: { result: noArtwork } };

/** A signed-out visitor sees a neutral sign-in link (never a personalized action). */
export const SignedOut: Story = {
  args: { result: importable, isAuthenticated: false },
};

// The pending (disabled + spinner) and unavailable/error (safe message) states
// are interaction-driven via `useActionState`; they are covered by the
// component's React Testing Library tests (external-result-card.test.tsx) rather
// than a static story, so the Storybook build stays interaction-free.
