"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";
import { isAuthAvailable, isGoogleOAuthEnabled } from "@/lib/auth/capability";
import { mapAuthError } from "@/lib/auth/errors";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { absoluteUrl } from "@/lib/auth/urls";
import {
  normalizeEmail,
  normalizeUsername,
  validateDisplayName,
  validateEmail,
  validateBio,
  validateLocation,
  validatePassword,
  validatePasswordConfirmation,
  validateUsername,
} from "@/lib/auth/validation";
import type { AuthFormState } from "./form-state";

/**
 * Auth Server Actions.
 *
 * SECURITY MODEL (see AGENTS.md): every action is treated as a public
 * endpoint. Each one re-validates its input on the server, establishes the
 * current authenticated user via the DAL where required, and relies on RLS as
 * a second layer. Client-provided ownership ids are never trusted (onboarding
 * writes are scoped to `auth.uid()` in both app code and RLS). Raw Supabase
 * errors are mapped to safe messages; passwords and tokens are never logged.
 */

const AUTH_UNAVAILABLE_MESSAGE =
  "Accounts aren't available in this environment yet. You can keep browsing Favalog.";

/** A neutral, enumeration-safe response for the missing-config case. */
function unavailable(): AuthFormState {
  return { status: "error", message: AUTH_UNAVAILABLE_MESSAGE };
}

/**
 * Decide where a freshly-authenticated user should land: onboarding when their
 * profile is incomplete, otherwise a validated `returnTo` or their own profile.
 * Always returns a same-origin relative path.
 */
async function resolvePostAuthDestination(returnTo: string): Promise<string> {
  const profile = await getCurrentProfile();
  if (!profile || !isProfileComplete(profile)) {
    return "/onboarding";
  }
  const safe = getSafeRedirectPath(returnTo, "");
  return safe !== "" && safe !== "/" ? safe : `/profile/${profile.username}`;
}

/** Email/password sign-in. */
export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isAuthAvailable()) return unavailable();

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");

  const fieldErrors: Record<string, string> = {};
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  if (password === "") fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors, values: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  if (error) {
    return {
      status: "error",
      message: mapAuthError(error, "sign-in"),
      values: { email },
    };
  }

  redirect(await resolvePostAuthDestination(returnTo));
}

/** Email/password sign-up with profile metadata for the DB trigger. */
export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isAuthAvailable()) return unavailable();

  const displayName = String(formData.get("displayName") ?? "");
  const username = String(formData.get("username") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const values = { displayName, username, email };
  const fieldErrors: Record<string, string> = {};

  const displayNameError = validateDisplayName(displayName);
  if (displayNameError) fieldErrors.displayName = displayNameError;
  const usernameError = validateUsername(username);
  if (usernameError) fieldErrors.username = usernameError;
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  const passwordError = validatePassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  const confirmError = validatePasswordConfirmation(password, confirmPassword);
  if (confirmError) fieldErrors.confirmPassword = confirmError;

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      // Keys MUST match the `handle_new_user` trigger's expectations
      // (raw_user_meta_data ->> 'username' / 'display_name').
      data: {
        username: normalizeUsername(username),
        display_name: displayName.trim(),
      },
      emailRedirectTo: await absoluteUrl("/auth/confirm?next=/onboarding"),
    },
  });

  if (error) {
    return { status: "error", message: mapAuthError(error, "sign-up"), values };
  }

  // With email confirmation enabled, Supabase returns no session (and an
  // obfuscated user if the address already exists — we stay neutral either
  // way). With confirmation disabled in local dev, a session is present.
  if (data.session) {
    redirect("/onboarding");
  }

  return {
    status: "confirmation-pending",
    message:
      "Almost there — check your inbox for a link to confirm your email and finish creating your account.",
    values: { email },
  };
}

/** Request a password-reset email. Always responds neutrally. */
export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isAuthAvailable()) return unavailable();

  const email = String(formData.get("email") ?? "");
  const emailError = validateEmail(email);
  if (emailError) {
    return {
      status: "error",
      fieldErrors: { email: emailError },
      values: { email },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmail(email),
    {
      redirectTo: await absoluteUrl("/auth/confirm?next=/auth/update-password"),
    },
  );

  // Surface only rate limiting; otherwise stay neutral so the response never
  // reveals whether an account exists for the address.
  if (
    error &&
    (error.status === 429 || error.code === "over_email_send_rate_limit")
  ) {
    return {
      status: "error",
      message: mapAuthError(error, "reset"),
      values: { email },
    };
  }

  return {
    status: "success",
    message:
      "If an account exists for that email, we've sent a link to reset your password.",
  };
}

/** Set a new password within a valid recovery/session context. */
export async function updatePasswordAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isAuthAvailable()) return unavailable();

  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "error",
      message:
        "This password reset link is invalid or has expired. Please request a new one.",
    };
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: Record<string, string> = {};
  const passwordError = validatePassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  const confirmError = validatePasswordConfirmation(password, confirmPassword);
  if (confirmError) fieldErrors.confirmPassword = confirmError;
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { status: "error", message: mapAuthError(error, "update") };
  }

  redirect(await resolvePostAuthDestination(""));
}

/** Sign out and return to a public route. */
export async function signOutAction(): Promise<void> {
  if (isAuthAvailable()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

/** Complete first-time onboarding: finalize the current user's own profile. */
export async function completeOnboardingAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isAuthAvailable()) return unavailable();

  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in?returnTo=%2Fonboarding");
  }

  const displayName = String(formData.get("displayName") ?? "");
  const username = String(formData.get("username") ?? "");
  const bio = String(formData.get("bio") ?? "");
  const location = String(formData.get("location") ?? "");

  const values = { displayName, username, bio, location };
  const fieldErrors: Record<string, string> = {};

  const displayNameError = validateDisplayName(displayName);
  if (displayNameError) fieldErrors.displayName = displayNameError;
  const usernameError = validateUsername(username);
  if (usernameError) fieldErrors.username = usernameError;
  const bioError = validateBio(bio);
  if (bioError) fieldErrors.bio = bioError;
  const locationError = validateLocation(location);
  if (locationError) fieldErrors.location = locationError;

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors, values };
  }

  const normalizedUsername = normalizeUsername(username);
  const supabase = await createClient();
  // Update ONLY the current user's row. RLS additionally restricts this to
  // `auth.uid() = id`; we never trust a client-provided id.
  const { error } = await supabase
    .from("profiles")
    .update({
      username: normalizedUsername,
      display_name: displayName.trim(),
      bio: bio.trim() === "" ? null : bio.trim(),
      location: location.trim() === "" ? null : location.trim(),
    })
    .eq("id", user.id);

  if (error) {
    // 23505 = unique_violation on the case-insensitive username index.
    if (error.code === "23505") {
      return {
        status: "error",
        fieldErrors: { username: "That username is taken. Try another one." },
        values,
      };
    }
    return { status: "error", message: mapAuthError(error, "update"), values };
  }

  redirect(`/profile/${normalizedUsername}`);
}

/** Begin the Google OAuth (PKCE) flow. */
export async function signInWithGoogleAction(
  formData: FormData,
): Promise<void> {
  if (!isGoogleOAuthEnabled()) {
    redirect("/auth/sign-in?error=oauth_unavailable");
  }

  const returnTo = String(formData.get("returnTo") ?? "");
  const safeNext = getSafeRedirectPath(returnTo, "/");
  const callback = await absoluteUrl(
    `/auth/callback?next=${encodeURIComponent(safeNext)}`,
  );

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback },
  });

  if (error || !data?.url) {
    redirect("/auth/sign-in?error=oauth_failed");
  }

  redirect(data.url);
}
