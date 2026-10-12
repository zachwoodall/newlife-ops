"use client";

import { useActionState, useEffect, useRef } from "react";
import { addComment, type CommentResult } from "./actions";

export function CommentForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState<CommentResult | null, FormData>(
    addComment,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="mt-3">
      <input type="hidden" name="task_id" value={taskId} />
      <textarea
        name="body"
        rows={2}
        maxLength={4000}
        required
        placeholder="Add to the discussion…"
        className="border-border bg-surface focus:border-brand-500 focus:ring-brand-500/30 w-full resize-y rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Posting…" : "Post"}
        </button>
        {state && "error" in state && (
          <span role="alert" className="text-sm text-red-700 dark:text-red-300">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
