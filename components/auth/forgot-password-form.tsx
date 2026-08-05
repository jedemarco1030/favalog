"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/app/auth/actions";
import { initialAuthFormState } from "@/app/auth/form-state";
import { AuthField } from "./auth-field";
import { AuthMessage } from "./auth-message";
import { SubmitButton } from "./submit-button";

/**
 * Password-reset request form. The `requestPasswordResetAction` Server Action
 * always responds neutrally (it never reveals whether an account exists), so on
 * success we show a calm confirmation and hide the form to discourage repeated
 * probing.
 */
export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    initialAuthFormState,
  );

  if (state.status === "success" && state.message) {
    return <AuthMessage variant="success">{state.message}</AuthMessage>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message && (
        <AuthMessage variant="error">{state.message}</AuthMessage>
      )}

      <AuthField
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />

      <SubmitButton pendingLabel="Sending…" className="mt-1 w-full">
        Send reset link
      </SubmitButton>
    </form>
  );
}
