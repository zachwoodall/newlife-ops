"use client";

import { useActionState, useRef, useState } from "react";
import { createChannel, type ChannelResult } from "./channel-actions";

export function NewChannel() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<ChannelResult | null, FormData>(
    async (prev, formData) => {
      const result = await createChannel(prev, formData);
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
        className="text-brand-700 dark:text-brand-300 text-sm font-medium hover:underline"
      >
        New channel
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="border-border mt-2 rounded-lg border p-3">
      <input
        name="name"
        required
        autoFocus
        maxLength={80}
        placeholder="Channel name, e.g. Worship team"
        className="border-border bg-surface w-full rounded-md border px-3 py-2 text-sm font-medium"
      />
      <input
        name="description"
        maxLength={200}
        placeholder="What it is for (optional)"
        className="border-border bg-surface mt-2 w-full rounded-md border px-3 py-2 text-sm"
      />
      <p className="text-muted mt-2 text-xs">
        You start as the only member. Add people once it exists.
      </p>
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
