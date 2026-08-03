import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Global test setup.
 *
 * - Registers `@testing-library/jest-dom` matchers (e.g. `toBeInTheDocument`).
 * - Unmounts React trees after every test so component tests stay isolated.
 */
afterEach(() => {
  cleanup();
});
