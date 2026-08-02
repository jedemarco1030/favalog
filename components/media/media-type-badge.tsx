import type { MediaKind } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface MediaTypeBadgeProps {
  kind: MediaKind;
  className?: string;
}

const KIND_LABEL: Record<MediaKind, string> = {
  movie: "Film",
  tv: "Series",
  book: "Book",
};

/**
 * Small pill describing what kind of thing a `MediaItem` is. Centralised
 * so the label vocabulary stays consistent across the app.
 */
export function MediaTypeBadge({ kind, className }: MediaTypeBadgeProps) {
  return <Badge className={className}>{KIND_LABEL[kind]}</Badge>;
}

export function mediaKindLabel(kind: MediaKind): string {
  return KIND_LABEL[kind];
}
