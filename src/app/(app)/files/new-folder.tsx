"use client";

import { useActionState, useRef, useState } from "react";
import { createFolder, type FolderResult } from "./actions";

export function NewFolder({ departments }: { departments: string[] }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<FolderResult | null, FormData>(
    async (prev, formData) => {
      const result = await createFolder(prev, formData);
      if ("ok" in result) {
        formRef.current?.reset();
        setOpen(false);
      }
      return result;
    },
    null,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border hover:border-brand-500 hover:text-brand-700 rounded-md border px-3 py-2 text-sm font-medium"
      >
        New folder
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="border-border rounded-lg border p-4">
      <input
        name="name"
        required
        autoFocus
        maxLength={80}
        placeholder="Folder name, e.g. Worship training"
        className="border-border bg-surface w-full rounded-md border px-3 py-2 text-sm font-medium"
      />
      <input
        name="description"
        maxLength={200}
        placeholder="What goes in it (optional)"
        className="border-border bg-surface mt-2 w-full rounded-md border px-3 py-2 text-sm"
      />
      <div className="mt-3">
        <label className="text-muted text-xs font-semibold tracking-widest uppercase">
          Who can see this folder
        </label>
        <select
          name="department"
          defaultValue=""
          className="border-border bg-surface mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Everyone on staff</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d} only
            </option>
          ))}
        </select>
        <p className="text-muted mt-1 text-xs">
          A folder&rsquo;s audience controls who sees the folder. Each file keeps
          its own audience, so putting a file here never widens or narrows who
          can open it.
        </p>
      </div>

      {state && "error" in state && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
