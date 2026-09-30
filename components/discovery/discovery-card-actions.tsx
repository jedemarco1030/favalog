"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Bookmark, Loader2, Plus, X } from "lucide-react";
import { createAndSaveDiscoveredTitleAction } from "@/app/discovery/actions";
import {
  initialCreateListFormState,
  type CreateListFormState,
} from "@/app/lists/list-form";
import {
  SAVE_INTENT_PARAM,
  saveIntentKey,
  withSaveIntent,
  withoutSaveIntent,
} from "@/lib/discovery/save-intent";
import {
  initialDiscoverySaveState,
  type DiscoveryCreateListState,
  type DiscoverySaveState,
} from "@/app/discovery/save-form";
import {
  initialMaterializeFormState,
  type MaterializeFormState,
} from "@/app/explore/materialize-form";
import type { ExternalRef } from "@/lib/catalog/types";
import type { ListCreateVisibility } from "@/lib/types";

export type DiscoverySaveAction = (
  state: DiscoverySaveState,
  formData: FormData,
) => Promise<DiscoverySaveState>;

export type DiscoveryOpenAction = (
  state: MaterializeFormState,
  formData: FormData,
) => Promise<MaterializeFormState>;

export type DiscoveryCreateListAction = (
  state: CreateListFormState,
  formData: FormData,
) => Promise<DiscoveryCreateListState>;

export interface SaveListOption {
  id: string;
  title: string;
}

interface DiscoveryCardActionsProps {
  identity: ExternalRef;
  title: string;
  /** The viewer's lists, or `null` when signed out. */
  lists: SaveListOption[] | null;
  returnTo: string;
  openAction: DiscoveryOpenAction;
  saveAction: DiscoverySaveAction;
  /** Creates a list inside the save dialog; injectable for tests. */
  createAction?: DiscoveryCreateListAction;
}

function IdentityFields({ identity }: { identity: ExternalRef }) {
  return (
    <>
      <input type="hidden" name="provider" value={identity.provider} />
      <input type="hidden" name="kind" value={identity.kind} />
      <input type="hidden" name="externalId" value={identity.externalId} />
    </>
  );
}

function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <PendingButton
      pending={pending}
      pendingLabel={pendingLabel}
      className={className}
      disabled={disabled}
    >
      {children}
    </PendingButton>
  );
}

function PendingButton({
  children,
  pending,
  pendingLabel,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pending: boolean;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <>
          <Loader2
            className="size-4 motion-safe:animate-spin"
            aria-hidden="true"
          />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

const secondaryButton =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-surface-1 px-2.5 text-xs font-medium text-foreground/80 outline-none transition-colors hover:border-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60";

const primaryButton =
  "inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 disabled:opacity-60";

const ghostButton =
  "inline-flex h-9 items-center rounded-lg px-3 text-sm text-foreground/70 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";

/**
 * "Open" materializes the title and lands on its Favalog page; "Save" puts it
 * straight into one of the viewer's lists. Both send only the provider
 * identity; the server re-fetches everything else.
 */
export function DiscoveryCardActions({
  identity,
  title,
  lists,
  returnTo,
  openAction,
  saveAction,
  createAction = createAndSaveDiscoveredTitleAction,
}: DiscoveryCardActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const intentKey = saveIntentKey(identity);
  const hasIntent = searchParams.get(SAVE_INTENT_PARAM) === intentKey;
  const [openState, openFormAction] = useActionState(
    openAction,
    initialMaterializeFormState,
  );
  // A visitor returning from sign-in lands with this title's picker open.
  const [dialogOpen, setDialogOpen] = useState(
    () => lists !== null && hasIntent,
  );

  useEffect(() => {
    if (openState.redirectTo) router.push(openState.redirectTo);
  }, [openState.redirectTo, router]);

  const signInHref = `/auth/sign-in?returnTo=${encodeURIComponent(
    withSaveIntent(returnTo, identity),
  )}`;

  function closeDialog() {
    setDialogOpen(false);
    if (hasIntent) {
      router.replace(
        `${pathname}${withoutSaveIntent(searchParams.toString())}`,
        { scroll: false },
      );
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <form action={openFormAction}>
          <IdentityFields identity={identity} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton pendingLabel="Opening" className={secondaryButton}>
            Open<span className="sr-only"> {title}</span>
          </SubmitButton>
        </form>
        {lists === null ? (
          <Link href={signInHref} className={secondaryButton}>
            <Bookmark className="size-3.5" aria-hidden="true" />
            Save<span className="sr-only"> {title}, sign in required</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className={secondaryButton}
            aria-haspopup="dialog"
          >
            <Bookmark className="size-3.5" aria-hidden="true" />
            Save<span className="sr-only"> {title} to a list</span>
          </button>
        )}
      </div>
      {openState.status !== "idle" && openState.message && (
        <p role="alert" className="text-xs leading-relaxed text-foreground/60">
          {openState.message}
        </p>
      )}
      {lists !== null && dialogOpen && (
        <SaveDialog
          identity={identity}
          title={title}
          lists={lists}
          returnTo={returnTo}
          saveAction={saveAction}
          createAction={createAction}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}

interface SaveDialogState {
  save: DiscoverySaveState;
  create: CreateListFormState;
  /** The list created in this dialog whose save has not succeeded yet. */
  unsavedCreatedList?: SaveListOption;
  /** Whether the current success came from "Create and save". */
  createdAndSaved?: boolean;
}

const initialSaveDialogState: SaveDialogState = {
  save: initialDiscoverySaveState,
  create: initialCreateListFormState,
};

const SAVE_FAILED_MESSAGE = "We couldn't save that just now. Try again.";
const CREATE_FAILED_MESSAGE = "We couldn't create that list just now.";

const VISIBILITY_OPTIONS: {
  value: ListCreateVisibility;
  label: string;
  hint: string;
}[] = [
  { value: "public", label: "Public", hint: "Anyone can view it." },
  {
    value: "followers",
    label: "Followers",
    hint: "Visible to people who follow you.",
  },
  { value: "private", label: "Private", hint: "Only you can view it." },
];

type FocusTarget = "name" | "create-trigger" | "save-button" | "status";

function SaveDialog({
  identity,
  title,
  lists: initialLists,
  returnTo,
  saveAction,
  createAction,
  onClose,
}: {
  identity: ExternalRef;
  title: string;
  lists: SaveListOption[];
  returnTo: string;
  saveAction: DiscoverySaveAction;
  createAction: DiscoveryCreateListAction;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const focusTargetRef = useRef<FocusTarget | null>(null);
  const ids = useId();

  const [createdLists, setCreatedLists] = useState<SaveListOption[]>([]);
  const lists = [...createdLists, ...initialLists];
  const [mode, setMode] = useState<"pick" | "create">(() =>
    initialLists.length === 0 ? "create" : "pick",
  );
  const [selectedListId, setSelectedListId] = useState<string | undefined>(
    initialLists[0]?.id,
  );
  const [draftName, setDraftName] = useState("");
  const [draftVisibility, setDraftVisibility] =
    useState<ListCreateVisibility>("public");

  function saveFormData(listId: string): FormData {
    const formData = new FormData();
    formData.set("provider", identity.provider);
    formData.set("kind", identity.kind);
    formData.set("externalId", identity.externalId);
    formData.set("listId", listId);
    formData.set("returnTo", returnTo);
    return formData;
  }

  async function runSave(
    previous: DiscoverySaveState,
    formData: FormData,
  ): Promise<DiscoverySaveState> {
    try {
      return await saveAction(previous, formData);
    } catch {
      return { status: "error", message: SAVE_FAILED_MESSAGE };
    }
  }

  async function dialogAction(
    previous: SaveDialogState,
    formData: FormData,
  ): Promise<SaveDialogState> {
    if (formData.get("intent") !== "create") {
      const save = await runSave(previous.save, formData);
      const retriedCreated =
        previous.unsavedCreatedList?.id === formData.get("listId");
      focusTargetRef.current =
        save.status === "success" ? "status" : "save-button";
      return {
        save,
        create: initialCreateListFormState,
        unsavedCreatedList:
          save.status === "success" ? undefined : previous.unsavedCreatedList,
        createdAndSaved: save.status === "success" && retriedCreated,
      };
    }

    let create: DiscoveryCreateListState;
    try {
      create = await createAction(initialCreateListFormState, formData);
    } catch {
      create = { status: "error", message: CREATE_FAILED_MESSAGE };
    }
    if (create.status !== "success" || !create.listId) {
      focusTargetRef.current = "name";
      return { ...previous, save: initialDiscoverySaveState, create };
    }

    // The list now exists: keep it in the picker regardless of the save
    // outcome, so a retry only re-sends the save and never creates again.
    const created: SaveListOption = {
      id: create.listId,
      title: create.title ?? draftName.trim(),
    };
    setCreatedLists((current) => [
      created,
      ...current.filter((list) => list.id !== created.id),
    ]);
    setSelectedListId(created.id);
    setMode("pick");
    setDraftName("");
    setDraftVisibility("public");

    // Production creates and saves in one request, avoiding overlapping RSC
    // revalidation streams. Create-only injected actions retain the retry seam.
    const save =
      create.save ??
      (await runSave(initialDiscoverySaveState, saveFormData(created.id)));
    focusTargetRef.current =
      save.status === "success" ? "status" : "save-button";
    return {
      save,
      create,
      unsavedCreatedList: save.status === "success" ? undefined : created,
      createdAndSaved: save.status === "success",
    };
  }

  const [state, formAction, pending] = useActionState(
    dialogAction,
    initialSaveDialogState,
  );

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    const redirectTo = state.save.redirectTo ?? state.create.redirectTo;
    if (redirectTo) router.push(redirectTo);
  }, [state.save.redirectTo, state.create.redirectTo, router]);

  useEffect(() => {
    const target = focusTargetRef.current;
    if (!target || pending) return;
    focusTargetRef.current = null;
    const element = {
      name: nameInputRef,
      "create-trigger": createTriggerRef,
      "save-button": saveButtonRef,
      status: statusRef,
    }[target].current;
    element?.focus();
  });

  function startCreating() {
    focusTargetRef.current = "name";
    setMode("create");
  }

  function cancelCreating() {
    focusTargetRef.current = "create-trigger";
    setMode("pick");
  }

  const savedTo =
    state.save.status === "success"
      ? lists.find((list) => list.id === state.save.listId)
      : undefined;

  const retryingCreated =
    state.unsavedCreatedList !== undefined &&
    selectedListId === state.unsavedCreatedList.id;

  const createErrors =
    state.create.status === "invalid" ? state.create.fieldErrors : undefined;
  const createMessage =
    state.create.status !== "success" && state.create.status !== "idle"
      ? (createErrors?.title ?? state.create.message)
      : undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${ids}-title`}
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-surface-1 p-0 text-foreground backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 p-5">
        <header className="flex items-start justify-between gap-4">
          <h2
            id={`${ids}-title`}
            className="font-display text-lg leading-tight"
          >
            Save &ldquo;{title}&rdquo;
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={pending}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 text-foreground/60 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {state.save.status === "success" ? (
          <div
            ref={statusRef}
            role="status"
            tabIndex={-1}
            className="flex flex-col gap-3 text-sm leading-relaxed outline-none"
          >
            <p className="text-foreground/80">
              {state.save.alreadyPresent
                ? `${title} is already in ${savedTo?.title ?? "that list"}.`
                : state.createdAndSaved
                  ? `Created ${savedTo?.title ?? "your list"} and saved ${title}.`
                  : `Saved to ${savedTo?.title ?? "your list"}.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {state.save.listSlug && (
                <Link
                  href={`/list/${state.save.listSlug}`}
                  className={secondaryButton}
                >
                  View list
                </Link>
              )}
              {state.save.mediaSlug && (
                <Link
                  href={`/title/${state.save.mediaSlug}`}
                  className={secondaryButton}
                >
                  Open title
                </Link>
              )}
            </div>
          </div>
        ) : mode === "create" ? (
          <form
            action={formAction}
            className="flex flex-col gap-4"
            aria-labelledby={`${ids}-create-title`}
          >
            <input type="hidden" name="intent" value="create" />
            <IdentityFields identity={identity} />
            <input
              type="hidden"
              name="returnTo"
              value={withSaveIntent(returnTo, identity)}
            />
            <h3
              id={`${ids}-create-title`}
              className="text-sm font-medium text-foreground/80"
            >
              New list
            </h3>
            {lists.length === 0 && (
              <p className="text-sm leading-relaxed text-foreground/70">
                You don&apos;t have any lists yet. Name your first one and
                we&apos;ll save this title to it.
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${ids}-name`}
                className="text-sm text-foreground/60"
              >
                List name
              </label>
              <input
                ref={nameInputRef}
                id={`${ids}-name`}
                name="title"
                required
                maxLength={120}
                autoComplete="off"
                autoFocus
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                disabled={pending}
                aria-invalid={createErrors?.title ? true : undefined}
                aria-describedby={
                  createMessage ? `${ids}-create-error` : undefined
                }
                className="h-10 rounded-lg border border-border/70 bg-surface-2 px-3 text-sm text-foreground outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm text-foreground/60">
                Visibility
              </legend>
              {VISIBILITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-start gap-2 text-sm text-foreground/80"
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={option.value}
                    checked={draftVisibility === option.value}
                    onChange={() => setDraftVisibility(option.value)}
                    disabled={pending}
                    className="mt-0.5 size-4 accent-[var(--color-accent)]"
                  />
                  <span>
                    {option.label}
                    <span className="block text-xs text-foreground/50">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
              {createErrors?.visibility && (
                <p className="text-xs text-foreground/70">
                  {createErrors.visibility}
                </p>
              )}
            </fieldset>
            {createMessage && (
              <p
                id={`${ids}-create-error`}
                role="alert"
                className="text-sm text-foreground/70"
              >
                {createMessage}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              {lists.length > 0 && (
                <button
                  type="button"
                  onClick={cancelCreating}
                  disabled={pending}
                  className={ghostButton}
                >
                  Cancel
                </button>
              )}
              <PendingButton
                pending={pending}
                pendingLabel="Creating"
                className={primaryButton}
              >
                Create and save
              </PendingButton>
            </div>
          </form>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <IdentityFields identity={identity} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <fieldset className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              <legend className="mb-2 text-sm text-foreground/60">
                Choose a list
              </legend>
              {lists.map((list) => (
                <label
                  key={list.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm has-[:checked]:border-accent/60 has-[:checked]:bg-accent/10"
                >
                  <input
                    type="radio"
                    name="listId"
                    value={list.id}
                    checked={selectedListId === list.id}
                    onChange={() => setSelectedListId(list.id)}
                    disabled={pending}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0 truncate">{list.title}</span>
                </label>
              ))}
            </fieldset>
            <button
              ref={createTriggerRef}
              type="button"
              onClick={startCreating}
              disabled={pending}
              className="inline-flex items-center gap-1.5 self-start rounded-lg px-1 py-1 text-sm font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden="true" />
              Create new list
            </button>
            {state.save.status !== "idle" && state.save.message && (
              <p role="alert" className="text-sm text-foreground/70">
                {retryingCreated
                  ? `Created ${state.unsavedCreatedList?.title}, but ${title} wasn't saved yet. ${state.save.message}`
                  : state.save.message}
              </p>
            )}
            <div className="flex justify-end">
              <button
                ref={saveButtonRef}
                type="submit"
                disabled={pending || !selectedListId}
                aria-busy={pending}
                className={primaryButton}
              >
                {pending ? (
                  <>
                    <Loader2
                      className="size-4 motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                    <span>Saving</span>
                  </>
                ) : retryingCreated ? (
                  "Retry save"
                ) : (
                  "Save to list"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
