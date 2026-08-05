"use client";

import { signInWithGoogleAction } from "@/app/auth/actions";
import { SubmitButton } from "./submit-button";

interface GoogleButtonProps {
  /** Safe same-origin path to return to after OAuth completes. */
  returnTo?: string;
}

/** Brand "G" mark for the OAuth button (decorative — the button is labelled). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6C12.2 13.2 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16z"
      />
      <path
        fill="#FBBC05"
        d="M10.3 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.5 2.1-8.8 2.1-6.4 0-11.8-3.7-13.7-9.8l-7.8 6C6.4 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

/**
 * "Continue with Google" OAuth button. Rendered only when Google is configured
 * (`isGoogleOAuthEnabled`), so users never hit an opaque provider error. It
 * submits a tiny form that invokes the `signInWithGoogleAction` Server Action,
 * which builds the callback URL from a trusted origin and starts the PKCE flow.
 */
export function GoogleButton({ returnTo }: GoogleButtonProps) {
  return (
    <form action={signInWithGoogleAction}>
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <SubmitButton
        variant="secondary"
        pendingLabel="Connecting to Google…"
        className="w-full"
      >
        <GoogleMark />
        Continue with Google
      </SubmitButton>
    </form>
  );
}
