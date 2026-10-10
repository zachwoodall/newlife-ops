import Link from "next/link";
import { getCurrentPerson } from "@/lib/current-person";
import { loadConversations, formatWhen } from "@/lib/messages-data";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const current = await getCurrentPerson();
  if (!current?.person) return null;

  const conversations = await loadConversations(current.person.id);

  if (conversations === null) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
        <div className="border-brand-200 bg-brand-50 text-brand-900 mt-6 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">Messages need one more migration</p>
          <p className="mt-1">
            Run{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0007_messages.sql
            </code>{" "}
            in the Supabase SQL Editor.
          </p>
        </div>
      </main>
    );
  }

  // Everyone on staff — messages ignore the org chart.
  const supabase = await createClient();
  const { data: people } = await supabase
    .from("people")
    .select("id, full_name")
    .neq("id", current.person.id)
    .order("full_name");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
      <p className="text-muted mt-1">Anyone on staff, either direction.</p>

      {conversations.length > 0 && (
        <ul className="border-border bg-surface mt-6 rounded-lg border">
          {conversations.map((c) => (
            <li key={c.personId} className="border-border border-b last:border-b-0">
              <Link
                href={`/messages/${c.personId}`}
                className="hover:bg-brand-50 flex items-center gap-3 px-4 py-3 dark:hover:bg-neutral-800"
              >
                <span className="flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    {c.unread > 0 && (
                      <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {c.unread}
                      </span>
                    )}
                  </span>
                  <span className="text-muted mt-0.5 block truncate text-sm">
                    {c.lastFromMe && "You: "}
                    {c.lastBody}
                  </span>
                </span>
                <span className="text-muted shrink-0 text-xs">
                  {formatWhen(c.lastAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">
          Start a conversation
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(people ?? []).map((p) => (
            <li key={p.id as string}>
              <Link
                href={`/messages/${p.id}`}
                className="border-border hover:border-brand-500 hover:text-brand-700 rounded-full border px-3 py-1.5 text-sm"
              >
                {p.full_name as string}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
