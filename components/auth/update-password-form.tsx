"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/app/auth/actions";
import { initialAuthFormState } from "@/app/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { AuthField } from "./auth-field";
import { AuthMessage } from "./auth-message";
import { SubmitButton } from "./submit-button";

/**
 * Set-a-new-password form used after following a recovery link. The
 * `updatePasswordAction` Server Action re-checks that a valid recovery/session
 * context exists, validates the new password server-side, and redirects on
 * success — so this only renders inputs, the pending state, and errors.
 */
export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(
    updatePasswordAction,
    initialAuthFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message && (
        <AuthMessage variant="error">{state.message}</AuthMessage>
      )}

      <AuthField
        id="password"
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
      />
      <AuthField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />

      <SubmitButton pendingLabel="Updating…" className="mt-1 w-full">
        Update password
      </SubmitButton>
    </form>
  );
}
