"use client";

import type {
  DiscoveryCreateListState,
  DiscoverySaveState,
} from "@/app/discovery/save-form";
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

export async function saveDiscoveredTitle(
  _previous: DiscoverySaveState,
  formData: FormData,
): Promise<DiscoverySaveState> {
  const response = await fetch("/api/discovery/create-and-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...Object.fromEntries(formData), intent: "save" }),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status >= 500) throw new Error("Save failed");
  return response.json();
}
