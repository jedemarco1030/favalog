import "server-only";
import { cache } from "react";
import { getMyLists } from "@/lib/supabase/lists";
import type { SaveListOption } from "./discovery-card-actions";

/**
 * The viewer's lists as save targets: `null` when signed out (or auth is not
 * configured), so cards show a sign-in link instead of the list picker.
 */
export const getSaveListOptions = cache(
  async (): Promise<SaveListOption[] | null> => {
    const result = await getMyLists();
    if (result.status !== "ok") {
      return result.status === "error" ? [] : null;
    }
    return result.lists.map((list) => ({ id: list.id, title: list.title }));
  },
);
