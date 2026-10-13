import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/current-person";
import { loadChannel } from "@/lib/channels-data";
import { formatWhen } from "@/lib/messages-data";
import { markChannelRead } from "../../channel-actions";
import { ChannelCompose } from "./compose";
import { ManageChannel } from "./manage";

export const dynamic = "force-dynamic";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const data = await loadChannel(id, current.person.id);
  if (!data) notFound();

  // Opening it is reading it.
  await markChannelRead(id);

  const { channel, messages, members, notMembers, canManage } = data;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link href="/messages" className="text-muted hover:text-brand-700 text-sm">
        &larr; Messages
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{channel.name}</h1>
      {channel.description && (
        <p className="text-muted mt-1 text-sm">{channel.description}</p>
      )}

      <ManageChannel
        channelId={id}
        name={channel.name as string}
        description={(channel.description as string | null) ?? null}
        members={members}
        notMembers={notMembers}
        canManage={canManage}
        meId={current.person.id}
      />

      {messages.length === 0 ? (
        <p className="border-border text-muted mt-5 rounded-lg border border-dashed p-8 text-center text-sm">
          Nothing said here yet.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {messages.map((m) => {
            const mine = m.sender_id === current.person!.id;
            return (
              <li key={m.id}>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">
                    {mine ? "You" : m.senderName}
                  </span>
                  <span className="text-muted text-xs">{formatWhen(m.created_at)}</span>
                </div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{m.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <ChannelCompose channelId={id} channelName={channel.name as string} />
    </main>
  );
}
