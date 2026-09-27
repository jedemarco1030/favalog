"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Bookmark, Loader2, X } from "lucide-react";
import { createListAction } from "@/app/lists/actions";
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
  type DiscoverySaveState,
} from "@/app/discovery/save-form";
import {
  initialMaterializeFormState,
  type MaterializeFormState,
} from "@/app/explore/materialize-form";
import type { ExternalRef } from "@/lib/catalog/types";

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
) => Promise<CreateListFormState>;

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
  /** Creates a first list inside the save dialog; injectable for tests. */
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
  createAction = createListAction,
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
  const ids = useId();
  const [createdList, setCreatedList] = useState<SaveListOption | null>(null);
  const lists = createdList ? [createdList, ...initialLists] : initialLists;
  const [state, formAction, pending] = useActionState(
    saveAction,
    initialDiscoverySaveState,
  );

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
  }, [state.redirectTo, router]);

  const savedTo =
    state.status === "success"
      ? lists.find((list) => list.id === state.listId)
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

        {state.status === "success" ? (
          <div
            role="status"
            className="flex flex-col gap-3 text-sm leading-relaxed"
          >
            <p className="text-foreground/80">
              {state.alreadyPresent
                ? `${title} is already in ${savedTo?.title ?? "that list"}.`
                : `Saved to ${savedTo?.title ?? "your list"}.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {state.listSlug && (
                <Link
                  href={`/list/${state.listSlug}`}
                  className={secondaryButton}
                >
                  View list
                </Link>
              )}
              {state.mediaSlug && (
                <Link
                  href={`/title/${state.mediaSlug}`}
                  className={secondaryButton}
                >
                  Open title
                </Link>
              )}
            </div>
          </div>
        ) : lists.length === 0 ? (
          <FirstListForm
            returnTo={withSaveIntent(returnTo, identity)}
            createAction={createAction}
            onCreated={setCreatedList}
          />
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <IdentityFields identity={identity} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <fieldset className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              <legend className="mb-2 text-sm text-foreground/60">
                Choose a list
              </legend>
              {lists.map((list, index) => (
                <label
                  key={list.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm has-[:checked]:border-accent/60 has-[:checked]:bg-accent/10"
                >
                  <input
                    type="radio"
                    name="listId"
                    value={list.id}
                    defaultChecked={index === 0}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0 truncate">{list.title}</span>
                </label>
              ))}
            </fieldset>
            {state.message && (
              <p role="alert" className="text-sm text-foreground/70">
                {state.message}
              </p>
            )}
            <div className="flex justify-end">
              <SubmitButton
                pendingLabel="Saving"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 disabled:opacity-60"
              >
                Save to list
              </SubmitButton>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

function FirstListForm({
  returnTo,
  createAction,
  onCreated,
}: {
  returnTo: string;
  createAction: DiscoveryCreateListAction;
  onCreated: (list: SaveListOption) => void;
}) {
  const router = useRouter();
  const inputId = useId();
  const [state, formAction] = useActionState(
    createAction,
    initialCreateListFormState,
  );

  useEffect(() => {
    if (state.status === "success" && state.listId) {
      onCreated({ id: state.listId, title: state.title ?? "your new list" });
    } else if (state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state, onCreated, router]);

  const titleError =
    state.status === "invalid" ? state.fieldErrors?.title : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="visibility" value="public" />
      <p className="text-sm leading-relaxed text-foreground/70">
        You don&apos;t have any lists yet. Name your first one and this title
        will be ready to save.
      </p>
      <label htmlFor={inputId} className="text-sm text-foreground/60">
        List name
      </label>
      <input
        id={inputId}
        name="title"
        required
        maxLength={120}
        autoComplete="off"
        aria-invalid={titleError ? true : undefined}
        className="h-10 rounded-lg border border-border/70 bg-surface-2 px-3 text-sm text-foreground outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40"
      />
      {(titleError || (state.status !== "success" && state.message)) && (
        <p role="alert" className="text-sm text-foreground/70">
          {titleError ?? state.message}
        </p>
      )}
      <div className="flex justify-end">
        <SubmitButton
          pendingLabel="Creating"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 disabled:opacity-60"
        >
          Create list
        </SubmitButton>
      </div>
    </form>
  );
}
