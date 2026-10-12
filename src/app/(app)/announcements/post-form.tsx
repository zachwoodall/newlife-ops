"use client";

import { useActionState, useRef, useState } from "react";
import { postAnnouncement, type PostResult } from "./actions";

export function PostForm({ departments }: { departments: string[] }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Collapsing on success happens here rather than in an effect, so there is
  // no render-then-correct flash. Matches NewTaskForm.
  const [state, action, pending] = useActionState<PostResult | null, FormData>(
    async (prev, formData) => {
      const result = await postAnnouncement(prev, formData);
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
        New announcement
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="border-border bg-surface rounded-lg border p-4"
    >
      <input
        name="title"
        required
        maxLength={200}
        placeholder="What's happening?"
        className="border-border bg-surface focus:border-brand-500 focus:ring-brand-500/30 w-full rounded-md border px-3 py-2 text-sm font-medium focus:ring-2 focus:outline-none"
      />
      <textarea
        name="body"
        required
        rows={4}
        maxLength={8000}
        placeholder="The details…"
        className="border-border bg-surface focus:border-brand-500 focus:ring-brand-500/30 mt-2 w-full resize-y rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
      />

      <div className="mt-3">
        <label className="text-muted text-xs font-semibold tracking-widest uppercase">
          Who sees this
        </label>
        <select
          name="department"
          defaultValue=""
          className="border-border bg-surface focus:border-brand-500 focus:ring-brand-500/30 mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="">Everyone on staff</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d} only
            </option>
          ))}
        </select>
        {departments.length === 0 && (
          <p className="text-muted mt-1 text-xs">
            You hold no department position, so you can only post to everyone.
          </p>
        )}
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
          {pending ? "Posting…" : "Post"}
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
