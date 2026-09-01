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
 * jsdom (in this configuration) exposes `window.localStorage` as a bare object
 * with no Storage methods. The theme system persists the visitor's preference
 * there, so provide a minimal, working in-memory implementation when the real
 * one is missing. Guarded so a functional Storage is never overwritten.
 */
if (
  typeof window !== "undefined" &&
  typeof window.localStorage?.getItem !== "function"
) {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memoryStorage,
  });
}

/**
 * jsdom does not implement `window.matchMedia`. The theme system reads the
 * `(prefers-color-scheme: dark)` signal through it, so provide a minimal,
 * standards-shaped stub (defaulting to "no match" = light system) with working
 * `addEventListener`/`removeEventListener`. Individual tests can override
 * `window.matchMedia` to simulate a dark system or live changes.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => {
    const list: MediaQueryList = {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
    return list;
  };
}

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
