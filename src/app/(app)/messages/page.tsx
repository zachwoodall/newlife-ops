import Link from "next/link";
import { getCurrentPerson } from "@/lib/current-person";
import { loadConversations, formatWhen } from "@/lib/messages-data";
import { loadChannels, peopleByDepartment } from "@/lib/channels-data";
import { NewChannel } from "./new-channel";

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

  const [channels, groups] = await Promise.all([
    loadChannels(current.person.id),
    peopleByDepartment(current.person.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
      <p className="text-muted mt-1">
        Channels for groups, direct messages for one person. Either direction,
        regardless of the org chart.
      </p>

      <section className="mt-7">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold tracking-widest uppercase">Channels</h2>
          <span className="ml-auto">
            <NewChannel />
          </span>
        </div>

        {channels === null ? (
          <div className="border-brand-200 bg-brand-50 text-brand-900 mt-2 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
            <p className="font-semibold">Channels need one more migration</p>
            <p className="mt-1">
              Run{" "}
              <code className="font-mono text-xs">
                supabase/migrations/0019_channels.sql
              </code>{" "}
              in the Supabase SQL Editor.
            </p>
          </div>
        ) : channels.length === 0 ? (
          <p className="border-border text-muted mt-2 rounded-lg border border-dashed p-6 text-center text-sm">
            You are not in any channel yet.
          </p>
        ) : (
          <ul className="border-border bg-surface mt-2 rounded-lg border">
            {channels.map((c) => (
              <li key={c.id} className="border-border border-b last:border-b-0">
                <Link
                  href={`/messages/channel/${c.id}`}
                  className="hover:bg-brand-50 flex items-center gap-3 px-4 py-3 dark:hover:bg-neutral-800"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="text-muted text-xs">
                        {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
                      </span>
                      {c.unread > 0 && (
                        <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          {c.unread}
                        </span>
                      )}
                    </span>
                    <span className="text-muted mt-0.5 block truncate text-sm">
                      {c.lastBody ?? c.description ?? "No messages yet"}
                    </span>
                  </span>
                  {c.lastAt && (
                    <span className="text-muted shrink-0 text-xs">
                      {formatWhen(c.lastAt)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {conversations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-widest uppercase">
            Direct messages
          </h2>
          <ul className="border-border bg-surface mt-2 rounded-lg border">
            {conversations.map((c) => (
              <li key={c.personId} className="border-border border-b last:border-b-0">
                <Link
                  href={`/messages/${c.personId}`}
                  className="hover:bg-brand-50 flex items-center gap-3 px-4 py-3 dark:hover:bg-neutral-800"
                >
                  <span className="min-w-0 flex-1">
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
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">
          Start a conversation
        </h2>
        {groups.map((group) => (
          <div key={group.department} className="mt-3">
            <p className="text-muted text-xs font-medium">{group.department}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.members.map((p) => (
                <Link
                  key={p.id}
                  href={`/messages/${p.id}`}
                  className="border-border hover:border-brand-500 hover:text-brand-700 rounded-full border px-3 py-1 text-sm"
                >
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
