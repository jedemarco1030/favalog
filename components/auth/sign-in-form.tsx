"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/auth/actions";
import { initialAuthFormState } from "@/app/auth/form-state";
import { AuthField } from "./auth-field";
import { AuthMessage } from "./auth-message";
import { SubmitButton } from "./submit-button";

interface SignInFormProps {
  /** Safe same-origin path to return to after signing in. */
  returnTo?: string;
}

/**
 * Email/password sign-in form. Submits to the `signInAction` Server Action via
 * `useActionState`; the action performs all validation and redirects on
 * success, so this component only renders inputs, the pending state, and any
 * accessible error returned by the server.
 */
export function SignInForm({ returnTo }: SignInFormProps) {
  const [state, formAction] = useActionState(
    signInAction,
    initialAuthFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

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
      <AuthField
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />

      <SubmitButton pendingLabel="Signing in…" className="mt-1 w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
