import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/current-person";
import { listNotifications } from "@/lib/notifications-data";
import { markAllRead, clearAll, markRead } from "./actions";

export const dynamic = "force-dynamic";

const WORD: Record<string, string> = {
  assigned: "Tagged in",
  comment: "Discussion",
  message: "Message",
};

export default async function NotificationsPage() {
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const { items, ready } = await listNotifications();
  const unread = items.filter((n) => !n.read_at);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        {unread.length > 0 && (
          <span className="bg-brand-500 rounded-full px-2 py-0.5 text-xs font-semibold text-white">
            {unread.length} new
          </span>
        )}
        {ready && items.length > 0 && (
          <div className="ml-auto flex gap-3">
            {unread.length > 0 && (
              <form action={markAllRead}>
                <button
                  type="submit"
                  className="text-muted hover:text-brand-700 text-sm font-medium"
                >
                  Mark all read
                </button>
              </form>
            )}
            <form action={clearAll}>
              <button
                type="submit"
                className="text-muted text-sm font-medium hover:text-red-700 dark:hover:text-red-300"
              >
                Clear all
              </button>
            </form>
          </div>
        )}
      </div>

      {!ready ? (
        <div className="border-brand-200 bg-brand-50 text-brand-900 mt-6 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">Notifications need one more migration</p>
          <p className="mt-1">
            Run{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0011_notifications.sql
            </code>{" "}
            in the Supabase SQL Editor.
          </p>
        </div>
      ) : items.length === 0 ? (
        <p className="border-border text-muted mt-6 rounded-lg border border-dashed p-8 text-center text-sm">
          Nothing yet. You&rsquo;ll hear here when someone tags you on a task,
          comments on your work, or sends you a message.
        </p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {items.map((n) => (
            <li
              key={n.id}
              className={
                n.read_at
                  ? "border-border bg-surface rounded-lg border px-3 py-2.5"
                  : "border-brand-200 bg-brand-50 rounded-lg border px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
              }
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-muted text-xs font-semibold tracking-widest uppercase">
                    {WORD[n.kind] ?? n.kind}
                  </p>
                  <Link
                    href={n.url}
                    className="hover:text-brand-700 mt-0.5 block text-sm font-medium hover:underline"
                  >
                    {n.summary}
                  </Link>
                  <p className="text-muted mt-0.5 text-xs">
                    {new Date(n.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {!n.read_at && (
                  <form action={markRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      aria-label="Mark this notification read"
                      className="text-muted hover:text-brand-700 shrink-0 text-xs font-medium"
                    >
                      Mark read
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
