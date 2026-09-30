import { createAndSaveDiscoveredTitleAction } from "@/app/discovery/actions";
import { initialCreateListFormState } from "@/app/lists/list-form";
import { getCurrentUser } from "@/lib/auth/data";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { validateMaterializeInput } from "@/lib/catalog/validation";
import { withSaveIntent } from "@/lib/discovery/save-intent";

const FIELDS = [
  "title",
  "visibility",
  "provider",
  "kind",
  "externalId",
  "returnTo",
] as const;
const MESSAGE = "We couldn't create that list just now.";

function respond(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  // Match Next's Server Action host boundary: the trusted deployment proxy
  // supplies the external host, while Request.url may retain localhost.
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    url.host;
  if (request.headers.get("origin") !== `${url.protocol}//${host}`) {
    return respond({ status: "error", message: MESSAGE }, 403);
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  ) {
    return respond({ status: "error", message: MESSAGE }, 415);
  }

  let body: unknown;
  try {
    body = await readBody(request);
  } catch {
    return respond({ status: "error", message: MESSAGE }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return respond({ status: "error", message: MESSAGE }, 400);
  }
  const values = body as Record<string, unknown>;
  const formData = new FormData();
  for (const field of FIELDS) {
    const value = values[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > 1024) {
      return respond({ status: "error", message: MESSAGE }, 400);
    }
    formData.set(field, value);
  }
  const identity = validateMaterializeInput({
    provider: typeof values.provider === "string" ? values.provider : undefined,
    kind: typeof values.kind === "string" ? values.kind : undefined,
    externalId:
      typeof values.externalId === "string" ? values.externalId : undefined,
  });
  const safePath = getSafeRedirectPath(values.returnTo, "/explore");
  const returnTo = identity.ok
    ? withSaveIntent(safePath, identity.value)
    : safePath;
  formData.set("returnTo", returnTo);

  try {
    if (!(await getCurrentUser())) {
      return respond(
        {
          status: "unauthenticated",
          message: "Please sign in to create a list.",
          redirectTo: `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`,
        },
        401,
      );
    }
    // Keep the mutation result independent of unrelated streamed RSC refreshes.
    // The existing action still re-authenticates each write and relies on RLS.
    return respond(
      await createAndSaveDiscoveredTitleAction(
        initialCreateListFormState,
        formData,
      ),
    );
  } catch {
    return respond({ status: "error", message: MESSAGE }, 500);
  }
}
