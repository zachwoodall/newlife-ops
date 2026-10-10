import { createClient } from "@/lib/supabase/server";

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type Conversation = {
  personId: string;
  name: string;
  lastBody: string;
  lastAt: string;
  lastFromMe: boolean;
  unread: number;
};

/** Returns null when the messages table is not there yet. */
async function allMine(): Promise<Message[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .order("created_at", { ascending: false });
  // RLS already narrows this to conversations the viewer is part of.
  return error ? null : ((data ?? []) as Message[]);
}

/** One row per person you have exchanged messages with, newest first. */
export async function loadConversations(
  meId: string,
): Promise<Conversation[] | null> {
  const messages = await allMine();
  if (messages === null) return null;

  const supabase = await createClient();
  const { data: people } = await supabase.from("people").select("id, full_name");
  const nameById = new Map(
    (people ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  const byPerson = new Map<string, Conversation>();
  for (const m of messages) {
    const other = m.sender_id === meId ? m.recipient_id : m.sender_id;
    const existing = byPerson.get(other);
    const unreadHere = m.recipient_id === meId && !m.read_at ? 1 : 0;

    if (!existing) {
      byPerson.set(other, {
        personId: other,
        name: nameById.get(other) ?? "Unknown",
        lastBody: m.body,
        lastAt: m.created_at,
        lastFromMe: m.sender_id === meId,
        unread: unreadHere,
      });
    } else {
      // Messages arrive newest first, so the first one seen is the latest.
      existing.unread += unreadHere;
    }
  }

  return [...byPerson.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** The full exchange with one person, oldest first. */
export async function loadThread(
  meId: string,
  otherId: string,
): Promise<Message[] | null> {
  const messages = await allMine();
  if (messages === null) return null;

  return messages
    .filter(
      (m) =>
        (m.sender_id === meId && m.recipient_id === otherId) ||
        (m.sender_id === otherId && m.recipient_id === meId),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function countUnread(meId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", meId)
    .is("read_at", null);
  return error ? 0 : (count ?? 0);
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
