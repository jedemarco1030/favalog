"use client";

import { useActionState } from "react";
import { signUpAction } from "@/app/auth/actions";
import { initialAuthFormState } from "@/app/auth/form-state";
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/validation";
import { AuthField } from "./auth-field";
import { AuthMessage } from "./auth-message";
import { SubmitButton } from "./submit-button";

/**
 * Email/password sign-up form. All validation and normalization happen in the
 * `signUpAction` Server Action; this renders inputs, the pending state, the
 * "check your email" confirmation state, and field-level errors. Submitted
 * (non-secret) values are echoed back so a person never retypes them.
 */
export function SignUpForm() {
  const [state, formAction] = useActionState(
    signUpAction,
    initialAuthFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message && (
        <AuthMessage variant="error">{state.message}</AuthMessage>
      )}
      {state.status === "confirmation-pending" && state.message && (
        <AuthMessage variant="pending">{state.message}</AuthMessage>
      )}

      <AuthField
        id="displayName"
        name="displayName"
        label="Display name"
        autoComplete="name"
        required
        defaultValue={state.values?.displayName}
        error={state.fieldErrors?.displayName}
      />
      <AuthField
        id="username"
        name="username"
        label="Username"
        autoComplete="username"
        required
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username}
        hint={`${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters — letters, numbers, and underscores.`}
      />
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
      <AuthField
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
      />
      <AuthField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />

      <SubmitButton
        pendingLabel="Creating your account…"
        className="mt-1 w-full"
      >
        Create account
      </SubmitButton>
    </form>
  );
}
