"use client";

import { useActionState, useState } from "react";
import { submitAnswer, type AnswerResult } from "./actions";

export function AnswerForm({
  checkinId,
  cadence,
  existing,
}: {
  checkinId: string;
  cadence: string;
  existing: string | null;
}) {
  const [editing, setEditing] = useState(!existing);
  const [state, action, pending] = useActionState<AnswerResult | null, FormData>(
    async (prev, formData) => {
      const result = await submitAnswer(prev, formData);
      if ("ok" in result) setEditing(false);
      return result;
    },
    null,
  );

  if (existing && !editing) {
    return (
      <div className="border-brand-200 bg-brand-50 mt-2 rounded-lg border px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900">
        <p className="text-muted text-xs font-semibold tracking-widest uppercase">
          Your answer
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{existing}</p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-muted hover:text-brand-700 mt-1.5 text-xs font-medium"
        >
          Revise
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="checkin_id" value={checkinId} />
      <input type="hidden" name="cadence" value={cadence} />
      <textarea
        name="body"
        rows={2}
        required
        maxLength={4000}
        defaultValue={existing ?? ""}
        placeholder="Your answer…"
        className="border-border bg-surface focus:border-brand-500 focus:ring-brand-500/30 w-full resize-y rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : existing ? "Save" : "Answer"}
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-muted text-sm font-medium"
          >
            Cancel
          </button>
        )}
        {state && "error" in state && (
          <span role="alert" className="text-sm text-red-700 dark:text-red-300">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
