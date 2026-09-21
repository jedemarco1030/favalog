/**
 * Pure input logic for the persistent like interaction (like / unlike an
 * accessible real review or list).
 *
 * Like `favorite-input.ts` and `follow-input.ts`, this module is intentionally
 * free of any server/Supabase/React imports so it can be reused by both the
 * client control (immediate feedback) and the server layer (authoritative
 * validation), and unit-tested in isolation. It mirrors the constraints the
 * database enforces (the `review_likes` / `list_likes` tables and their
 * `set_review_like` / `set_list_like` RPCs): a like references a single target
 * by its stable UUID, and the only other input is the DESIRED boolean state.
 * The browser never supplies a liker id, username, or ownership field — the
 * liker identity is re-derived from `auth.uid()` in the database, and RLS plus
 * an accessibility check decide whether the target may be interacted with.
 */

/** The two likeable target kinds. */
export type LikeTargetType = "review" | "list";

/** Raw, untrusted input as it arrives from the like control. */
export interface SetLikeInput {
  /** Which kind of target is being liked. */
  targetType: LikeTargetType;
  /** The target's stable UUID (a review id or a list id), resolved server-side. */
  targetId: string;
  /** The desired end-state: true to like, false to remove the like. */
  isLiked: boolean;
}

/** A normalized, server-ready set-like payload derived from valid input. */
export interface NormalizedSetLikeInput {
  targetType: LikeTargetType;
  targetId: string;
  isLiked: boolean;
}

export interface SetLikeValidationResult {
  ok: boolean;
  /** A single safe form-level message when invalid. */
  message?: string;
  /** Present only when `ok` is true. */
  value?: NormalizedSetLikeInput;
}

/**
 * Canonical UUID shape (any version). The database column is `uuid`, so a
 * malformed id is rejected before a doomed RPC call rather than surfacing a
 * raw Postgres cast error to the browser.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLikeTargetType(value: unknown): value is LikeTargetType {
  return value === "review" || value === "list";
}

/**
 * Validate and normalize set-like input. Rules mirror the database:
 *  - the target type must be one of the two known kinds;
 *  - a target UUID is required and must be well-formed (WHICH target to act on;
 *    ownership/accessibility is re-derived server-side, never trusted here);
 *  - the desired state must be an explicit boolean.
 */
export function validateSetLikeInput(
  input: SetLikeInput,
): SetLikeValidationResult {
  if (!isLikeTargetType(input.targetType)) {
    return {
      ok: false,
      message:
        "We couldn't tell what you were trying to like. Please try again.",
    };
  }

  const targetId =
    typeof input.targetId === "string" ? input.targetId.trim() : "";
  if (!UUID_RE.test(targetId)) {
    return {
      ok: false,
      message: "We couldn't tell which item to update. Please try again.",
    };
  }

  if (typeof input.isLiked !== "boolean") {
    return {
      ok: false,
      message: "We couldn't tell whether to add or remove that like.",
    };
  }

  return {
    ok: true,
    value: { targetType: input.targetType, targetId, isLiked: input.isLiked },
  };
}
