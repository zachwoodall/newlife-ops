"use client";

import { useActionState, useRef, useState } from "react";
import { createTask, type CreateTaskResult } from "../tasks/actions";
import { CADENCES, CADENCE_LABEL } from "@/lib/tasks";

/**
 * A person's name in the org chart, clickable to assign them work.
 * Only rendered with `canAssign` for people the org chart permits; the
 * database enforces the same rule regardless.
 */
export function AssignPanel({
  personId,
  name,
  canAssign,
}: {
  personId: string;
  name: string;
  canAssign: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<CreateTaskResult | null, FormData>(
    async (prev, fd) => {
      const result = await createTask(prev, fd);
      if ("ok" in result) {
        formRef.current?.reset();
        setOpen(false);
        setDone(true);
      }
      return result;
    },
    null,
  );

  if (!canAssign) {
    return <span className="text-sm font-medium">{name}</span>;
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className="hover:text-brand-700 text-sm font-medium underline decoration-dotted underline-offset-2"
        >
          {name}
        </button>
        {done && (
          <span className="text-brand-700 dark:text-brand-300 text-[11px] font-medium">
            Task assigned
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="border-border bg-surface mt-1 rounded-md border p-2.5">
      <p className="text-[11px] font-semibold tracking-wider uppercase">
        Assign to {name}
      </p>
      <form ref={formRef} action={action} className="mt-2 space-y-2">
        <input type="hidden" name="owner_id" value={personId} />
        <input
          name="title"
          required
          placeholder="What needs doing?"
          className="border-border w-full rounded-md border px-2 py-1.5 text-sm outline-none"
        />
        <div className="flex gap-2">
          <select
            name="cadence"
            defaultValue="once"
            aria-label="How often"
            className="border-border min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm outline-none"
          >
            {CADENCES.map((c) => (
              <option key={c} value={c}>
                {CADENCE_LABEL[c]}
              </option>
            ))}
          </select>
          <input
            name="due_date"
            type="date"
            aria-label="Deadline"
            className="border-border min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm outline-none"
          />
        </div>

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
            {pending ? "Assigning…" : "Assign"}
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
    </div>
  );
}
