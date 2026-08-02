import { Container } from "@/components/ui/container";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 py-10 text-sm text-foreground/50">
      <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="max-w-sm text-foreground/50">
            Everything you watch and read. One place to remember it.
          </p>
        </div>
        <p className="text-xs text-foreground/40">
          © {new Date().getFullYear()} Lorely. Frontend MVP — mock data.
        </p>
      </Container>
    </footer>
  );
}
