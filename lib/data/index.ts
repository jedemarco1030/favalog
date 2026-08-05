/**
 * Public entry point for the mock data layer.
 *
 * UI code should import from `@/lib/data` (this module), never from the
 * individual data files. This lets us swap the mock data out for real
 * fetchers later without touching consumers.
 */
export * from "./users";
export * from "./media";
export * from "./activity";
export * from "./diary";
export * from "./lists";
export * from "./profile";
