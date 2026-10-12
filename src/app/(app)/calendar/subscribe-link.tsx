"use client";

import { useState } from "react";

export function SubscribeLink({ token }: { token: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/calendar/${token}`
      : "";

  return (
    <div className="border-border mt-5 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Subscribe from another calendar</h2>
      <p className="text-muted mt-1 text-sm">
        Add this to Google Calendar, Apple Calendar or Outlook and your dated
        tasks appear alongside everything else.
      </p>

      {!shown ? (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="border-border hover:border-brand-500 mt-3 rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          Show my calendar link
        </button>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="border-border bg-surface min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
              className="bg-brand-500 hover:bg-brand-600 shrink-0 rounded-md px-3 py-2 text-sm font-medium text-white"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-muted mt-2 text-xs">
            Treat this like a password. Anyone holding the link can read your
            task titles and dates without signing in.
          </p>
        </>
      )}
    </div>
  );
}
