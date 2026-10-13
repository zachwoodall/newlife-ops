"use client";

import { useActionState, useState } from "react";
import {
  grantAccess,
  revokeAccess,
  resetPassword,
  toggleAdmin,
  type AdminResult,
} from "./actions";

export type PersonRow = {
  id: string;
  full_name: string;
  email: string | null;
  hasAccess: boolean;
  is_admin: boolean;
  is_active: boolean;
};

export function PersonRowItem({ person, isMe }: { person: PersonRow; isMe: boolean }) {
  const [mode, setMode] = useState<"idle" | "granting" | "confirmRevoke">("idle");

  const [state, action, pending] = useActionState<AdminResult | null, FormData>(
    async (prev, formData) => {
      const intent = String(formData.get("intent") ?? "");
      const result =
        intent === "grant"
          ? await grantAccess(prev, formData)
          : intent === "revoke"
            ? await revokeAccess(prev, formData)
            : await resetPassword(prev, formData);
      if ("ok" in result) setMode("idle");
      return result;
    },
    null,
  );

  return (
    <li className="border-border bg-surface rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{person.full_name}</span>

        {person.hasAccess ? (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-semibold text-green-900 dark:bg-green-900/40 dark:text-green-200">
            Can sign in
          </span>
        ) : (
          <span className="text-muted border-border rounded border px-1.5 py-0.5 text-[11px] font-semibold">
            No account
          </span>
        )}

        {person.is_admin && (
          <span className="bg-brand-50 text-brand-700 rounded px-1.5 py-0.5 text-[11px] font-semibold dark:bg-neutral-800 dark:text-neutral-300">
            Administrator
          </span>
        )}

        <span className="text-muted ml-auto text-xs">{person.email ?? "no email"}</span>
      </div>

      {/* Actions */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {!person.hasAccess && mode !== "granting" && (
          <button
            type="button"
            onClick={() => setMode("granting")}
            className="text-brand-700 text-xs font-medium hover:underline dark:text-brand-300"
          >
            Give access
          </button>
        )}

        {person.hasAccess && !isMe && mode !== "confirmRevoke" && (
          <button
            type="button"
            onClick={() => setMode("confirmRevoke")}
            className="text-muted text-xs font-medium hover:text-red-700 dark:hover:text-red-300"
          >
            Remove access
          </button>
        )}

        {person.hasAccess && (
          <form action={action}>
            <input type="hidden" name="intent" value="reset" />
            <input type="hidden" name="person_id" value={person.id} />
            <button
              type="submit"
              disabled={pending}
              className="text-muted hover:text-brand-700 text-xs font-medium disabled:opacity-60"
            >
              New password
            </button>
          </form>
        )}

        {person.hasAccess && (
          <form action={toggleAdmin}>
            <input type="hidden" name="person_id" value={person.id} />
            <input type="hidden" name="make_admin" value={String(!person.is_admin)} />
            <button
              type="submit"
              className="text-muted hover:text-brand-700 text-xs font-medium"
            >
              {person.is_admin ? "Remove administrator" : "Make administrator"}
            </button>
          </form>
        )}
      </div>

      {mode === "granting" && (
        <form action={action} className="mt-2 flex flex-wrap gap-2">
          <input type="hidden" name="intent" value="grant" />
          <input type="hidden" name="person_id" value={person.id} />
          <input
            name="email"
            type="email"
            required
            autoFocus
            defaultValue={person.email ?? ""}
            placeholder="name@newlifecanton.com"
            className="border-border bg-surface min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-brand-500 hover:bg-brand-600 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create login"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="text-muted text-sm font-medium"
          >
            Cancel
          </button>
        </form>
      )}

      {mode === "confirmRevoke" && (
        <form action={action} className="border-border mt-2 rounded-md border p-3">
          <input type="hidden" name="intent" value="revoke" />
          <input type="hidden" name="person_id" value={person.id} />
          <p className="text-sm">
            Remove {person.full_name}&rsquo;s login? They stay in the org chart, and
            their tasks, comments and messages are untouched &mdash; they simply
            cannot sign in.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Removing…" : "Remove access"}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="text-muted text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {state && "error" in state && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}

      {state && "ok" in state && (
        <div className="border-brand-200 bg-brand-50 mt-2 rounded-md border p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
          <p>{state.message}</p>
          {state.password && (
            <>
              <p className="mt-2 text-xs font-semibold tracking-widest uppercase">
                Password &mdash; shown once
              </p>
              <code className="mt-1 block font-mono text-base break-all">
                {state.password}
              </code>
              <p className="text-muted mt-1.5 text-xs">
                Give this to them directly. It is not stored anywhere and cannot be
                shown again &mdash; issue a new one if it is lost.
              </p>
            </>
          )}
        </div>
      )}
    </li>
  );
}
