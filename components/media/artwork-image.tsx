"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

interface ArtworkImageProps {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** Rendered instead of the image if it fails to load. */
  fallback: ReactNode;
}

/**
 * A filled `next/image` that swaps to `fallback` when the image fails to load,
 * so a broken provider URL never shows a broken-image icon. The parent reserves
 * the frame's aspect ratio, so the swap causes no layout shift.
 */
export function ArtworkImage({
  src,
  alt,
  sizes,
  className,
  priority,
  fallback,
}: ArtworkImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={priority}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
