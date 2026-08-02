import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ContainerProps {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/**
 * Centered page-width wrapper. Uses generous horizontal padding
 * on larger screens to match Lorely's editorial feel.
 */
export function Container({ as: Tag = "div", className, children }: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full max-w-6xl px-6 md:px-10", className)}>
      {children}
    </Tag>
  );
}
