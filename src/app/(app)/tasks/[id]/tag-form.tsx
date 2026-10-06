"use client";

import { useActionState, useRef } from "react";
import { addAssignee, type AssigneeResult } from "./actions";

export function TagForm({
  taskId,
  people,
}: {
  taskId: string;
  people: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<AssigneeResult, FormData>(
    async (prev, fd) => {
      const result = await addAssignee(prev, fd);
      if (result && "ok" in result) formRef.current?.reset();
      return result;
    },
    null,
  );

  if (people.length === 0) {
    return (
      <p className="text-muted text-sm italic">
        Nobody reports to you, so there&apos;s nobody to tag.
      </p>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="task_id" value={taskId} />
      <div className="min-w-40 flex-1">
        <label htmlFor="person_id" className="block text-xs font-medium">
          Tag a helper
        </label>
        <select
          id="person_id"
          name="person_id"
          className="border-border mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-40 flex-1">
        <label htmlFor="role_label" className="block text-xs font-medium">
          Their role (optional)
        </label>
        <input
          id="role_label"
          name="role_label"
          placeholder="Setup crew"
          className="border-border mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-500 hover:bg-brand-600 rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {state && "error" in state && (
        <p role="alert" className="w-full text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
