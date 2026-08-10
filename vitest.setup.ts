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

/**
 * jsdom does not implement the native `<dialog>` methods. Provide minimal shims
 * so components built on `<dialog>` (e.g. the title logging dialog) can be
 * exercised in component tests. `showModal`/`close` toggle the `open` state and
 * `close` fires the `close` event the components listen for.
 */
if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
}
