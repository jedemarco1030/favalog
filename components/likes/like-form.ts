/**
 * Pure form-state contract for the like interaction, shared by the client
 * control (`LikeButton`) and the `"use server"` action (`setLikeAction`).
 *
 * Kept free of any server/Supabase/React imports so it can be imported from a
 * client component and unit-tested in isolation. The displayed state is always
 * SERVER TRUTH: the button renders the server-loaded initial state until an
 * action succeeds, then the ACTUAL count + viewer bit the server returned —
 * never an optimistic guess that could contradict the write.
 */

import type { LikeTargetType } from "@/lib/supabase/like-input";

export type LikeStatus =
  | "idle"
  | "success"
  | "unauthenticated"
  | "onboarding"
  | "error"
  | "unavailable";

export interface LikeFormState {
  status: LikeStatus;
  /** The server-returned resulting viewer bit (present on success). */
  isLiked?: boolean;
  /** The server-returned resulting like count (present on success). */
  likeCount?: number;
  /** A safe, human-readable message for the error/unavailable states. */
  message?: string;
  /** A server-built, validated redirect target for the auth/onboarding states. */
  redirectTo?: string;
}

export const initialLikeFormState: LikeFormState = { status: "idle" };

/** The parsed, still-untrusted fields a like submission carries. */
export interface ParsedLikeForm {
  targetType: LikeTargetType;
  targetId: string;
  isLiked: boolean;
  returnTo: string;
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Read the like fields from a submitted form. Values are returned as-is (only
 * coerced to strings/booleans) — authoritative validation happens server-side
 * in `validateSetLikeInput`. `isLiked` is the DESIRED next state the control
 * submitted (the opposite of what it currently shows).
 */
export function parseLikeFormData(formData: FormData): ParsedLikeForm {
  const rawTarget = asString(formData.get("targetType"));
  const targetType: LikeTargetType = rawTarget === "list" ? "list" : "review";
  return {
    targetType,
    targetId: asString(formData.get("targetId")).trim(),
    isLiked: asString(formData.get("isLiked")) === "true",
    returnTo: asString(formData.get("returnTo")),
  };
}
