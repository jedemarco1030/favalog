"use client";

import type { DiscoveryCreateListState } from "@/app/discovery/save-form";
import type { CreateListFormState } from "@/app/lists/list-form";

export async function createAndSaveDiscoveredTitle(
  _previous: CreateListFormState,
  formData: FormData,
): Promise<DiscoveryCreateListState> {
  const response = await fetch("/api/discovery/create-and-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.fromEntries(formData)),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status >= 500) throw new Error("Create and save failed");
  return response.json();
}
