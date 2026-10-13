import { createClient } from "@/lib/supabase/server";

export type ChannelSummary = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
};

export type ChannelMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

/** Channels you are in, most recently active first. */
export async function loadChannels(meId: string): Promise<ChannelSummary[] | null> {
  const supabase = await createClient();

  const { data: channels, error } = await supabase
    .from("channels")
    .select("id, name, description")
    .order("name");

  if (error) return null;
  if (!channels?.length) return [];

  const ids = channels.map((c) => c.id as string);

  const [{ data: members }, { data: messages }, { data: reads }] = await Promise.all([
    supabase.from("channel_members").select("channel_id, person_id").in("channel_id", ids),
    supabase
      .from("channel_messages")
      .select("channel_id, body, created_at")
      .in("channel_id", ids)
      .order("created_at", { ascending: false }),
    supabase.from("channel_reads").select("channel_id, last_read_at").eq("person_id", meId),
  ]);

  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    const k = m.channel_id as string;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const readAt = new Map(
    (reads ?? []).map((r) => [r.channel_id as string, r.last_read_at as string]),
  );

  const latest = new Map<string, { body: string; at: string }>();
  const unread = new Map<string, number>();
  for (const m of messages ?? []) {
    const k = m.channel_id as string;
    if (!latest.has(k)) {
      latest.set(k, { body: m.body as string, at: m.created_at as string });
    }
    const since = readAt.get(k);
    if (!since || (m.created_at as string) > since) {
      unread.set(k, (unread.get(k) ?? 0) + 1);
    }
  }

  return channels
    .map((c) => {
      const id = c.id as string;
      const last = latest.get(id);
      return {
        id,
        name: c.name as string,
        description: (c.description as string | null) ?? null,
        memberCount: counts.get(id) ?? 0,
        lastBody: last?.body ?? null,
        lastAt: last?.at ?? null,
        unread: unread.get(id) ?? 0,
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export async function loadChannel(channelId: string, meId: string) {
  const supabase = await createClient();

  const { data: channel, error } = await supabase
    .from("channels")
    .select("id, name, description, created_by")
    .eq("id", channelId)
    .maybeSingle();

  if (error || !channel) return null;

  const [{ data: messages }, { data: members }, { data: people }, { data: meRow }] =
    await Promise.all([
      supabase
        .from("channel_messages")
        .select("id, sender_id, body, created_at")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true }),
      supabase.from("channel_members").select("person_id").eq("channel_id", channelId),
      supabase.from("people").select("id, full_name").order("full_name"),
      supabase.from("people").select("is_admin").eq("id", meId).maybeSingle(),
    ]);

  const names = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]));
  const memberIds = new Set((members ?? []).map((m) => m.person_id as string));

  return {
    channel,
    canManage: channel.created_by === meId || Boolean(meRow?.is_admin),
    messages: ((messages ?? []) as ChannelMessage[]).map((m) => ({
      ...m,
      senderName: names.get(m.sender_id) ?? "Someone",
    })),
    members: [...memberIds].map((id) => ({ id, name: names.get(id) ?? "Someone" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    notMembers: (people ?? [])
      .filter((p) => !memberIds.has(p.id as string))
      .map((p) => ({ id: p.id as string, name: p.full_name as string })),
  };
}

/** Everyone else, grouped by the department they hold a position in. */
export async function peopleByDepartment(meId: string) {
  const supabase = await createClient();

  const [{ data: people }, { data: holders }] = await Promise.all([
    supabase.from("people").select("id, full_name").neq("id", meId).order("full_name"),
    supabase.from("position_holders").select("person_id, positions(department)"),
  ]);

  const deptOf = new Map<string, string>();
  for (const h of holders ?? []) {
    const positions = h.positions as unknown as { department: string | null } | null;
    const dept = positions?.department;
    if (dept && !deptOf.has(h.person_id as string)) {
      deptOf.set(h.person_id as string, dept);
    }
  }

  const groups = new Map<string, { id: string; name: string }[]>();
  for (const p of people ?? []) {
    const dept = deptOf.get(p.id as string) ?? "Everyone else";
    const list = groups.get(dept) ?? [];
    list.push({ id: p.id as string, name: p.full_name as string });
    groups.set(dept, list);
  }

  // Named departments first, alphabetically; the catch-all last.
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === "Everyone else") return 1;
      if (b === "Everyone else") return -1;
      return a.localeCompare(b);
    })
    .map(([department, members]) => ({ department, members }));
}
