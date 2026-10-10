"use client";

import { useActionState, useRef } from "react";
import { sendMessage, type SendResult } from "./actions";

export function Compose({
  recipientId,
  recipientName,
  autoFocus = false,
}: {
  recipientId: string;
  recipientName: string;
  autoFocus?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<SendResult, FormData>(
    async (prev, fd) => {
      const result = await sendMessage(prev, fd);
      if (result && "ok" in result) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="recipient_id" value={recipientId} />
      <label htmlFor={`m-${recipientId}`} className="sr-only">
        Message {recipientName}
      </label>
      <textarea
        id={`m-${recipientId}`}
        name="body"
        rows={3}
        required
        autoFocus={autoFocus}
        placeholder={`Message ${recipientName}…`}
        className="border-border focus:border-brand-500 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none"
      />
      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
