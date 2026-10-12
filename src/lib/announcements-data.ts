import { createClient } from "@/lib/supabase/server";

export type Announcement = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  audience: "all" | "department";
  department: string | null;
  created_at: string;
};

export type Reply = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

async function nameMap() {
  const supabase = await createClient();
  const { data } = await supabase.from("people").select("id, full_name");
  return new Map((data ?? []).map((p) => [p.id as string, p.full_name as string]));
}

export async function listAnnouncements(): Promise<{
  items: (Announcement & { authorName: string; replyCount: number })[];
  ready: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, author_id, title, body, audience, department, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { items: [], ready: false };

  const names = await nameMap();
  const ids = (data ?? []).map((a) => a.id);
  const { data: replies } = await supabase
    .from("announcement_replies")
    .select("announcement_id")
    .in("announcement_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const counts = new Map<string, number>();
  for (const r of replies ?? []) {
    const key = r.announcement_id as string;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    ready: true,
    items: (data ?? []).map((a) => ({
      ...(a as Announcement),
      authorName: names.get(a.author_id as string) ?? "Someone",
      replyCount: counts.get(a.id as string) ?? 0,
    })),
  };
}

export async function getAnnouncement(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, author_id, title, body, audience, department, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const { data: replies } = await supabase
    .from("announcement_replies")
    .select("id, author_id, body, created_at")
    .eq("announcement_id", id)
    .order("created_at", { ascending: true });

  const names = await nameMap();
  return {
    announcement: {
      ...(data as Announcement),
      authorName: names.get(data.author_id as string) ?? "Someone",
    },
    replies: ((replies ?? []) as Reply[]).map((r) => ({
      ...r,
      authorName: names.get(r.author_id) ?? "Someone",
    })),
  };
}

/** Departments the signed-in person can post to. */
export async function myDepartments(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_departments");
  if (Array.isArray(data)) return data.filter(Boolean) as string[];
  return [];
}
