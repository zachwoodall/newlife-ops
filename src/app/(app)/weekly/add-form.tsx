"use client";

import { useActionState, useEffect, useRef } from "react";
import { addItem, type AddResult } from "./actions";

export function AddForm() {
  const [state, action, pending] = useActionState<AddResult | null, FormData>(
    addItem,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="mt-4">
      <div className="flex gap-2">
        <input
          name="title"
          required
          maxLength={200}
          placeholder="Something you should do every week…"
          className="border-border bg-surface focus:border-brand-500 focus:ring-brand-500/30 flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {state && "error" in state && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
