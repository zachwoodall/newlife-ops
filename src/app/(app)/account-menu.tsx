"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ACCOUNT_LINKS } from "@/lib/navigation";

/**
 * Search, alerts and the account menu. These are tools rather than
 * destinations, so they sit apart from the four sections.
 *
 * The menu is a <details>, which opens and closes without JavaScript; the
 * only script here closes it on navigation and on Escape.
 */
export function AccountMenu({
  email,
  alerts,
  unread,
  signOut,
}: {
  email: string;
  alerts: number;
  unread: number;
  signOut: () => Promise<void>;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && ref.current) ref.current.open = false;
    }
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        ref.current.open = false;
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClickAway);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClickAway);
    };
  }, []);

  const total = alerts + unread;

  return (
    <div className="ml-auto flex items-center gap-1">
      <Link
        href="/search"
        aria-label="Search"
        title="Search"
        className="text-muted hover:bg-brand-50 hover:text-brand-700 rounded-md p-2 transition-colors dark:hover:bg-neutral-800"
      >
        <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </Link>

      <Link
        href="/notifications"
        aria-label={total > 0 ? `Alerts, ${total} unread` : "Alerts"}
        title={total > 0 ? `${total} unread` : "Alerts"}
        className="text-muted hover:bg-brand-50 hover:text-brand-700 relative rounded-md p-2 transition-colors dark:hover:bg-neutral-800"
      >
        <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
          <path
            d="M10 3a4.5 4.5 0 0 0-4.5 4.5c0 3-1.2 4.2-1.2 4.2h11.4s-1.2-1.2-1.2-4.2A4.5 4.5 0 0 0 10 3Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M8.3 14.5a1.8 1.8 0 0 0 3.4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {total > 0 && (
          <span className="absolute top-0.5 right-0.5 rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {total}
          </span>
        )}
      </Link>

      <details ref={ref} className="relative">
        <summary className="text-muted hover:bg-brand-50 hover:text-brand-700 flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors dark:hover:bg-neutral-800">
          <span className="hidden sm:inline">{email.split("@")[0]}</span>
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>

        <div className="border-border bg-surface absolute right-0 z-10 mt-1 w-56 rounded-lg border p-1 shadow-lg">
          <p className="text-muted truncate px-3 py-2 text-xs">{email}</p>
          {ACCOUNT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:bg-brand-50 block rounded-md px-3 py-2 text-sm font-medium dark:hover:bg-neutral-800"
            >
              {link.label}
            </Link>
          ))}
          <form action={signOut}>
            <button
              type="submit"
              className="hover:bg-brand-50 block w-full rounded-md px-3 py-2 text-left text-sm font-medium dark:hover:bg-neutral-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
