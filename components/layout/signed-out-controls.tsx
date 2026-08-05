import Link from "next/link";
import { cn } from "@/lib/cn";

interface SignedOutControlsProps {
  className?: string;
}

/**
 * App-shell controls shown when there is no authenticated user: a quiet "Sign
 * in" link and a prominent "Create account" call to action. Pure and
 * server-renderable so it never causes a client-side auth flash.
 */
export function SignedOutControls({ className }: SignedOutControlsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Link
        href="/auth/sign-in"
        className="rounded-full px-3 py-1.5 text-sm text-foreground/70 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        Sign in
      </Link>
      <Link
        href="/auth/sign-up"
        className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground outline-none transition-colors hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="hidden sm:inline">Start your Favalog</span>
        <span className="sm:hidden">Sign up</span>
      </Link>
    </div>
  );
}
