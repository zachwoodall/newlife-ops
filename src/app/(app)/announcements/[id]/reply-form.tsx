"use client";

import { useActionState, useRef } from "react";
import { postReply, type ReplyResult } from "../actions";

export function ReplyForm({ announcementId }: { announcementId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  // Reset inside the action rather than an effect: no render-then-correct flash.
  const [state, action, pending] = useActionState<ReplyResult | null, FormData>(
    async (prev, formData) => {
      const result = await postReply(prev, formData);
      if ("ok" in result) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={action} className="mt-4">
      <input type="hidden" name="announcement_id" value={announcementId} />
      <textarea
        name="body"
        required
        rows={2}
        maxLength={4000}
        placeholder="Reply…"
        className="border-border bg-surface focus:border-brand-500 focus:ring-brand-500/30 w-full resize-y rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Posting…" : "Reply"}
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
