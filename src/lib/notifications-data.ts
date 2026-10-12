import { createClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  kind: "assigned" | "comment" | "message";
  summary: string;
  url: string;
  read_at: string | null;
  created_at: string;
};

/**
 * How many unread notifications there are, for the nav badge.
 * Returns 0 rather than throwing when migration 0011 has not been applied.
 */
export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function listNotifications(): Promise<{
  items: Notification[];
  ready: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, summary, url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return { items: (data ?? []) as Notification[], ready: !error };
}
