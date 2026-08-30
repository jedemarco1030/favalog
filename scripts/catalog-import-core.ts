// Favalog Catalog Platform v1A — operator CLI core (testable, DI-driven).
//
// Safe, fail-closed tooling for developers/operators to exercise the external
// catalog foundation WITHOUT a UI:
//
//   search  <provider> <query>   — read-only provider search (no writes)
//   inspect <provider> <kind> <external-id> — read-only trusted detail (no writes)
//   import  <provider> <kind> <external-id> — trusted materialization (writes)
//
// SAFETY POSTURE (mirrors scripts/embed-catalog-core.ts and ADR 0003/0004):
//   - Only `import` (and not with --dry-run) writes anything.
//   - Remote (hosted) targets are guarded: a live remote write needs BOTH
//     --allow-remote AND --confirm-project-ref=<ref> matching the resolved URL.
//   - A remote --fake write is ALWAYS rejected (fake data must never reach a
//     hosted catalog), even with other flags.
//   - Unknown/misspelled/duplicated/conflicting flags exit nonzero.
//   - No secret, token, raw provider payload, or vector is ever printed.
//
// All collaborators (env, Supabase client, provider registry) are injected so
// the whole flow is unit-testable offline. The `.mjs` entrypoint is a thin
// wrapper that wires the real implementations.

import {
  authorizeEmbeddingWrite,
  classifyTarget,
} from "./embed-catalog-core.ts";
import { createCatalogMaterializer } from "../lib/catalog/materialize.ts";
import type { CatalogRpcResult } from "../lib/catalog/materialize.ts";
import type { ProviderRegistry } from "../lib/catalog/provider-registry.ts";
import type { CatalogProviderError } from "../lib/catalog/errors.ts";
import { validateMaterializeInput } from "../lib/catalog/validation.ts";
import type {
  CatalogKindFilter,
  ExternalProvider,
} from "../lib/catalog/types.ts";
import type { MediaKind } from "../lib/types.ts";

/** Minimal Supabase surface used for the import RPC. */
export interface CliSupabaseLike {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

/** Minimal logger surface (injected so tests stay quiet + assertable). */
export interface Logger {
  log: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

/** Dependencies for {@link runCatalogCli}. */
export interface CatalogCliDeps {
  env: Record<string, string | undefined>;
  /** Build a provider registry; `fake` selects the deterministic providers. */
  buildRegistry: (opts: { fake: boolean }) => ProviderRegistry;
  /** Build a Supabase client for writes (import only). */
  createSupabaseClient: (url: string, key: string) => CliSupabaseLike;
  logger: Logger;
}

export type CliCommand = "search" | "inspect" | "import";

/** Parsed CLI arguments. */
export interface CatalogCliArgs {
  command: CliCommand;
  provider?: string;
  kind?: string;
  query?: string;
  externalId?: string;
  page?: number;
  limit?: number;
  fake: boolean;
  dryRun: boolean;
  allowRemote: boolean;
  confirmProjectRef?: string;
  json: boolean;
}

export type ParseResult =
  { ok: true; args: CatalogCliArgs } | { ok: false; error: string };

export const USAGE = [
  "Usage: node scripts/catalog-import.mjs <command> [options]",
  "",
  "Commands:",
  "  search   Read-only provider search (no writes).",
  "  inspect  Read-only trusted detail fetch for one external id (no writes).",
  "  import   Trusted materialization of one external id into the catalog.",
  "",
  "Options:",
  "  --provider <tmdb|openlibrary>",
  "  --kind <movie|tv|book>",
  "  --query <text>                 (search)",
  "  --external-id <id>             (inspect|import)",
  "  --page <n>                     (search)",
  "  --limit <n>                    (search display cap)",
  "  --fake                         Use deterministic FAKE providers (dev only).",
  "  --dry-run                      (import) Normalize + preview, no write.",
  "  --allow-remote                 (import) Permit a guarded remote live write.",
  "  --confirm-project-ref <ref>    (import) Confirm the hosted project ref.",
  "  --confirm-project-ref=<ref>    (same, `=` form)",
  "  --json                         Emit machine-readable JSON.",
].join("\n");

function parsePositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number.parseInt(trimmed, 10);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

/**
 * Parse argv into {@link CatalogCliArgs}. Fail-closed: an unknown/misspelled
 * flag, a missing option value, an invalid number, an empty confirmation, a
 * duplicated flag, or a missing/invalid command all return `ok: false`.
 */
export function parseArgs(argv: readonly string[]): ParseResult {
  if (argv.length === 0) return { ok: false, error: "Missing command." };
  const command = argv[0];
  if (command !== "search" && command !== "inspect" && command !== "import") {
    return { ok: false, error: `Unknown command '${command}'.` };
  }

  const args: CatalogCliArgs = {
    command,
    fake: false,
    dryRun: false,
    allowRemote: false,
    json: false,
  };
  const seen = new Set<string>();
  const markSeen = (name: string): string | undefined =>
    seen.has(name)
      ? `Duplicate or conflicting option '${name}'.`
      : (seen.add(name), undefined);

  const needValue = (
    name: string,
    value: string | undefined,
  ): string | undefined =>
    value === undefined || value.startsWith("--")
      ? `Missing value for '${name}'.`
      : undefined;

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fake") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      args.fake = true;
    } else if (arg === "--dry-run") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      args.dryRun = true;
    } else if (arg === "--allow-remote") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      args.allowRemote = true;
    } else if (arg === "--json") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      args.json = true;
    } else if (arg === "--provider") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      const err = needValue(arg, argv[i + 1]);
      if (err) return { ok: false, error: err };
      args.provider = argv[++i];
    } else if (arg === "--kind") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      const err = needValue(arg, argv[i + 1]);
      if (err) return { ok: false, error: err };
      args.kind = argv[++i];
    } else if (arg === "--query") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      const err = needValue(arg, argv[i + 1]);
      if (err) return { ok: false, error: err };
      args.query = argv[++i];
    } else if (arg === "--external-id") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      const err = needValue(arg, argv[i + 1]);
      if (err) return { ok: false, error: err };
      args.externalId = argv[++i];
    } else if (arg === "--page") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      const err = needValue(arg, argv[i + 1]);
      if (err) return { ok: false, error: err };
      const value = parsePositiveInt(argv[++i]);
      if (value === null) return { ok: false, error: "Invalid --page value." };
      args.page = value;
    } else if (arg === "--limit") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      const err = needValue(arg, argv[i + 1]);
      if (err) return { ok: false, error: err };
      const value = parsePositiveInt(argv[++i]);
      if (value === null) return { ok: false, error: "Invalid --limit value." };
      args.limit = value;
    } else if (arg === "--confirm-project-ref") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      const err = needValue(arg, argv[i + 1]);
      if (err) return { ok: false, error: err };
      const value = argv[++i];
      if (value.trim() === "") {
        return { ok: false, error: "Empty value for '--confirm-project-ref'." };
      }
      args.confirmProjectRef = value;
    } else if (arg.startsWith("--confirm-project-ref=")) {
      const dup = markSeen("--confirm-project-ref");
      if (dup) return { ok: false, error: dup };
      const value = arg.slice("--confirm-project-ref=".length);
      if (value.trim() === "") {
        return { ok: false, error: "Empty value for '--confirm-project-ref'." };
      }
      args.confirmProjectRef = value;
    } else {
      return { ok: false, error: `Unknown option '${arg}'.` };
    }
  }

  return { ok: true, args };
}

/** Safe error-category extraction from a possible CatalogProviderError. */
function categoryOf(error: unknown): string {
  const candidate = error as Partial<CatalogProviderError> | undefined;
  return candidate && typeof candidate.category === "string"
    ? candidate.category
    : "unknown";
}

/** Run the `search` command (read-only). */
async function runSearch(
  args: CatalogCliArgs,
  deps: CatalogCliDeps,
): Promise<number> {
  const provider = args.provider as ExternalProvider | undefined;
  if (provider !== "tmdb" && provider !== "openlibrary") {
    deps.logger.error("[catalog] search requires --provider tmdb|openlibrary");
    return 1;
  }
  if (!args.query) {
    deps.logger.error("[catalog] search requires --query <text>");
    return 1;
  }
  const registry = deps.buildRegistry({ fake: args.fake });
  const kind = (args.kind ?? "all") as CatalogKindFilter;

  try {
    const page = await registry.get(provider).search({
      query: args.query,
      kind,
      page: args.page,
    });
    const items = args.limit ? page.items.slice(0, args.limit) : page.items;
    if (args.json) {
      deps.logger.log(
        JSON.stringify({
          provider,
          count: items.length,
          hasMore: page.hasMore,
          items: items.map((c) => ({
            provider: c.ref.provider,
            kind: c.kind,
            externalId: c.ref.externalId,
            title: c.title,
            year: c.year ?? null,
          })),
        }),
      );
    } else {
      deps.logger.log(`[catalog] ${items.length} result(s):`);
      for (const c of items) {
        deps.logger.log(
          `  ${c.kind}\t${c.ref.externalId}\t${c.title}${c.year ? ` (${c.year})` : ""}`,
        );
      }
    }
    return 0;
  } catch (error) {
    deps.logger.error(`[catalog] search failed (${categoryOf(error)}).`);
    return 1;
  }
}

/** Run the `inspect` command (read-only trusted detail). */
async function runInspect(
  args: CatalogCliArgs,
  deps: CatalogCliDeps,
): Promise<number> {
  const validated = validateMaterializeInput({
    provider: args.provider,
    kind: args.kind,
    externalId: args.externalId,
  });
  if (!validated.ok) {
    deps.logger.error(`[catalog] inspect: ${validated.error}`);
    return 1;
  }
  const { provider, kind, externalId } = validated.value;
  const registry = deps.buildRegistry({ fake: args.fake });

  try {
    const item = await registry
      .get(provider)
      .getByExternalId({ provider, kind: kind as MediaKind, externalId });
    // Print only safe, normalized product fields — never a raw payload.
    const safe = {
      provider: item.ref.provider,
      kind: item.kind,
      externalId: item.ref.externalId,
      title: item.title,
      year: item.year,
      genres: item.genres,
      hasPoster: Boolean(item.posterUrl),
    };
    deps.logger.log(
      args.json ? JSON.stringify(safe) : JSON.stringify(safe, null, 2),
    );
    return 0;
  } catch (error) {
    deps.logger.error(`[catalog] inspect failed (${categoryOf(error)}).`);
    return 1;
  }
}

/** Run the `import` command (guarded materialization). */
async function runImport(
  args: CatalogCliArgs,
  deps: CatalogCliDeps,
): Promise<number> {
  const validated = validateMaterializeInput({
    provider: args.provider,
    kind: args.kind,
    externalId: args.externalId,
  });
  if (!validated.ok) {
    deps.logger.error(`[catalog] import: ${validated.error}`);
    return 1;
  }
  const input = validated.value;
  const registry = deps.buildRegistry({ fake: args.fake });

  // Dry run: fetch + normalize + preview, but never touch the database or even
  // require Supabase config.
  if (args.dryRun) {
    try {
      const item = await registry.get(input.provider).getByExternalId(input);
      deps.logger.log(
        `[catalog] DRY RUN — would materialize ${input.provider}/${input.kind}/${input.externalId}: ` +
          `"${item.title}" (${item.year})`,
      );
      return 0;
    } catch (error) {
      deps.logger.error(`[catalog] dry-run failed (${categoryOf(error)}).`);
      return 1;
    }
  }

  // Live write: resolve + classify the target and authorize BEFORE any I/O.
  const url = deps.env.SUPABASE_URL || deps.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey =
    deps.env.SUPABASE_SECRET_KEY || deps.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) {
    deps.logger.error(
      "[catalog] Missing Supabase config. Set SUPABASE_URL and " +
        "SUPABASE_SECRET_KEY (service-role) to import.",
    );
    return 1;
  }

  const classification = classifyTarget(url);
  deps.logger.log(
    `[catalog] Target: ${classification.kind} — host ${classification.host || "unknown"}` +
      (classification.projectRef
        ? ` (project ref ${classification.projectRef})`
        : ""),
  );

  const decision = authorizeEmbeddingWrite({
    classification,
    fake: args.fake,
    force: false,
    dryRun: false,
    allowRemote: args.allowRemote,
    confirmProjectRef: args.confirmProjectRef,
  });
  if (!decision.allowed) {
    deps.logger.error(
      `[catalog] ${decision.message} (reason: ${decision.reason})`,
    );
    return 1;
  }
  deps.logger.log(`[catalog] ${decision.message}`);

  const supabase = deps.createSupabaseClient(url, serviceKey);
  const materializer = createCatalogMaterializer({
    registry,
    rpcClient: {
      async rpc(fn, rpcArgs): Promise<CatalogRpcResult> {
        const { data, error } = await supabase.rpc(fn, rpcArgs);
        return { data, error: error ? { message: error.message } : null };
      },
    },
  });

  try {
    const result = await materializer.materialize(input);
    if (args.json) {
      deps.logger.log(
        JSON.stringify({
          mediaId: result.mediaId,
          slug: result.slug,
          source: result.source,
          externalId: result.externalId,
          kind: result.kind,
          inserted: result.inserted,
          resolution: result.resolution ?? null,
        }),
      );
    } else {
      deps.logger.log(
        `[catalog] ${result.resolution ?? (result.inserted ? "created" : "refreshed")} ${result.kind} ` +
          `"${result.slug}" (media ${result.mediaId}).`,
      );
    }
    return 0;
  } catch (error) {
    deps.logger.error(`[catalog] import failed (${categoryOf(error)}).`);
    return 1;
  }
}

/**
 * Parse argv and dispatch a command. Returns a process exit code; never calls
 * `process.exit`. 0 success, 1 any config/guard/validation/provider error.
 */
export async function runCatalogCli(
  argv: readonly string[],
  deps: CatalogCliDeps,
): Promise<number> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    deps.logger.error(`[catalog] ${parsed.error}`);
    deps.logger.error(USAGE);
    return 1;
  }
  const args = parsed.args;
  switch (args.command) {
    case "search":
      return runSearch(args, deps);
    case "inspect":
      return runInspect(args, deps);
    case "import":
      return runImport(args, deps);
  }
}
