"use client";

import { useActionState } from "react";
import { completeOnboardingAction } from "@/app/auth/actions";
import { initialAuthFormState } from "@/app/auth/form-state";
import {
  BIO_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/validation";
import { AuthField } from "./auth-field";
import { AuthMessage } from "./auth-message";
import { SubmitButton } from "./submit-button";

interface OnboardingFormProps {
  /** Prefilled username from the auth metadata / initial profile. */
  defaultUsername?: string;
  /** Prefilled display name from the auth metadata / initial profile. */
  defaultDisplayName?: string;
}

/**
 * First-time profile onboarding form. Username and display name are required;
 * bio and location are optional. The `completeOnboardingAction` Server Action
 * re-authenticates, validates and normalizes server-side, updates ONLY the
 * current user's profile (RLS-scoped), handles username collisions, and
 * redirects to the new profile — so this component just renders inputs, the
 * pending state, and errors, prefilled where we already know a value.
 */
export function OnboardingForm({
  defaultUsername,
  defaultDisplayName,
}: OnboardingFormProps) {
  const [state, formAction] = useActionState(
    completeOnboardingAction,
    initialAuthFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message && (
        <AuthMessage variant="error">{state.message}</AuthMessage>
      )}

      <AuthField
        id="displayName"
        name="displayName"
        label="Display name"
        autoComplete="name"
        required
        defaultValue={state.values?.displayName ?? defaultDisplayName}
        error={state.fieldErrors?.displayName}
      />
      <AuthField
        id="username"
        name="username"
        label="Username"
        autoComplete="username"
        required
        defaultValue={state.values?.username ?? defaultUsername}
        error={state.fieldErrors?.username}
        hint={`${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters — this is your @handle.`}
      />
      <AuthField
        id="bio"
        name="bio"
        label="Bio (optional)"
        multiline
        defaultValue={state.values?.bio}
        error={state.fieldErrors?.bio}
        hint={`A short line about what you watch and read. Up to ${BIO_MAX_LENGTH} characters.`}
      />
      <AuthField
        id="location"
        name="location"
        label="Location (optional)"
        autoComplete="off"
        defaultValue={state.values?.location}
        error={state.fieldErrors?.location}
        hint={`Up to ${LOCATION_MAX_LENGTH} characters.`}
      />

      <SubmitButton pendingLabel="Saving…" className="mt-1 w-full">
        Finish setup
      </SubmitButton>
    </form>
  );
}
