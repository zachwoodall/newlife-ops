import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentPerson } from "@/lib/current-person";
import { loadThread, formatWhen } from "@/lib/messages-data";
import { markThreadRead } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { Compose } from "../compose";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;

  const current = await getCurrentPerson();
  if (!current?.person) return null;
  if (personId === current.person.id) notFound();

  const supabase = await createClient();
  const { data: other } = await supabase
    .from("people")
    .select("id, full_name")
    .eq("id", personId)
    .maybeSingle();

  if (!other) notFound();

  // Opening the thread is what marks it read.
  await markThreadRead(current.person.id, personId);
  const thread = await loadThread(current.person.id, personId);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/messages" className="text-muted hover:text-brand-700 text-sm">
        ← Messages
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {other.full_name as string}
      </h1>

      <div className="mt-6 space-y-3">
        {(thread ?? []).length === 0 && (
          <p className="text-muted border-border rounded-lg border border-dashed p-8 text-center text-sm">
            No messages yet. Say something.
          </p>
        )}
        {(thread ?? []).map((m) => {
          const mine = m.sender_id === current.person!.id;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex"}>
              <div
                className={
                  mine
                    ? "bg-brand-500 max-w-[85%] rounded-lg rounded-br-sm px-3 py-2 text-sm text-white"
                    : "border-border bg-surface max-w-[85%] rounded-lg rounded-bl-sm border px-3 py-2 text-sm"
                }
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={mine ? "mt-1 text-[11px] text-white/70" : "text-muted mt-1 text-[11px]"}>
                  {formatWhen(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <Compose
          recipientId={personId}
          recipientName={(other.full_name as string).split(" ")[0]}
        />
      </div>
    </main>
  );
}
