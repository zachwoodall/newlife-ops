"use client";

import { useActionState, useRef, useState } from "react";
import { createCheckin, type AskResult } from "./actions";

export function AskForm({ departments }: { departments: string[] }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<AskResult | null, FormData>(
    async (prev, formData) => {
      const result = await createCheckin(prev, formData);
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
        className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        New check-in
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="border-border bg-surface rounded-lg border p-4">
      <input
        name="question"
        required
        maxLength={300}
        placeholder="e.g. What are you preaching on Sunday?"
        className="border-border bg-surface focus:border-brand-500 w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-muted text-xs font-semibold tracking-widest uppercase">
            How often
          </label>
          <select
            name="cadence"
            defaultValue="weekly"
            className="border-border bg-surface mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
        </div>
        <div>
          <label className="text-muted text-xs font-semibold tracking-widest uppercase">
            Who answers
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
        </div>
      </div>

      {state && "error" in state && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border-border rounded-md border px-4 py-2 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
