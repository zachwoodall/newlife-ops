"use client";

import { useActionState, useRef } from "react";
import { postToChannel, type PostResult } from "../../channel-actions";

export function ChannelCompose({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<PostResult | null, FormData>(
    async (prev, formData) => {
      const result = await postToChannel(prev, formData);
      if ("ok" in result) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={action} className="mt-4">
      <input type="hidden" name="channel_id" value={channelId} />
      <textarea
        name="body"
        rows={2}
        required
        maxLength={4000}
        placeholder={`Message ${channelName}…`}
        className="border-border bg-surface focus:border-brand-500 focus:ring-brand-500/30 w-full resize-y rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send"}
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
