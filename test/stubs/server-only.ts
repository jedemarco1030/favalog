/**
 * Test stub for the `server-only` package.
 *
 * `server-only` is a build-time guard that throws if a server module is pulled
 * into a Client bundle. Under Vitest (plain Node/jsdom) there is no such bundler
 * boundary, so importing the real package fails to resolve. Aliasing it to this
 * empty module (see `vitest.config.mts`) lets us unit-test the server-only data
 * layer (e.g. the favorite / list / diary write paths) with the Supabase client
 * and auth DAL mocked, exactly as the Server Actions do at runtime.
 */
export {};
