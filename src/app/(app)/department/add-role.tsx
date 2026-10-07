"use client";

import { useActionState, useRef, useState } from "react";
import { addPosition, type OrgResult } from "./actions";

export function AddRole({
  parentId,
  campusKey,
  department,
}: {
  parentId: string;
  campusKey: string;
  department: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<OrgResult, FormData>(
    async (prev, fd) => {
      const r = await addPosition(prev, fd);
      if (r && "ok" in r) {
        formRef.current?.reset();
        setOpen(false);
      }
      return r;
    },
    null,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border text-muted hover:border-brand-500 hover:text-brand-700 grid min-h-28 w-full place-items-center rounded-lg border border-dashed text-sm font-medium"
      >
        + Add a role
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="border-border bg-surface space-y-2 rounded-lg border p-3"
    >
      <input type="hidden" name="parent_id" value={parentId} />
      <input type="hidden" name="campus" value={campusKey} />
      <input
        name="title"
        required
        placeholder="Role title"
        className="border-border w-full rounded-md border px-2 py-1.5 text-sm outline-none"
      />
      <input
        name="department"
        defaultValue={department}
        placeholder="Department"
        className="border-border w-full rounded-md border px-2 py-1.5 text-sm outline-none"
      />
      {state && "error" in state && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add role"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border-border rounded-md border px-3 py-1.5 text-xs font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
