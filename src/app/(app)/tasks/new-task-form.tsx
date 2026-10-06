"use client";

import { useActionState, useRef, useState } from "react";
import { createTask, type CreateTaskResult } from "./actions";
import { CADENCES, CADENCE_LABEL } from "@/lib/tasks";

export function NewTaskForm({
  people,
  meId,
}: {
  people: { id: string; name: string }[];
  meId: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Clearing the form after a successful add happens here rather than in an
  // effect, so there is no render-then-correct flash.
  const [state, action, pending] = useActionState<CreateTaskResult | null, FormData>(
    async (prev, formData) => {
      const result = await createTask(prev, formData);
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
        New task
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="border-border bg-surface w-full rounded-lg border p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className="block text-sm font-medium">
            Task
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="Plan Sunday setlist"
            className="border-border focus:border-brand-500 focus:ring-brand-500/30 mt-1.5 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
          />
        </div>

        <div>
          <label htmlFor="cadence" className="block text-sm font-medium">
            How often
          </label>
          <select
            id="cadence"
            name="cadence"
            defaultValue="weekly"
            className="border-border focus:border-brand-500 mt-1.5 w-full rounded-md border px-3 py-2 text-sm outline-none"
          >
            {CADENCES.map((c) => (
              <option key={c} value={c}>
                {CADENCE_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="due_date" className="block text-sm font-medium">
            Deadline
          </label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            className="border-border focus:border-brand-500 mt-1.5 w-full rounded-md border px-3 py-2 text-sm outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="owner_id" className="block text-sm font-medium">
            Who is responsible
          </label>
          <select
            id="owner_id"
            name="owner_id"
            defaultValue={meId}
            className="border-border focus:border-brand-500 mt-1.5 w-full rounded-md border px-3 py-2 text-sm outline-none"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-muted mt-1 text-xs">
            Only you and people below you in the org chart appear here.
          </p>
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
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add task"}
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
