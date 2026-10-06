import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/tasks";

/**
 * Tasks this person owns. RLS already hides everyone else's.
 * Returns null when the tasks table is missing, so the page can say the
 * migration has not been run instead of showing a misleading empty list.
 */
export async function loadMyTasks(personId: string): Promise<Task[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, notes, owner_id, created_by, cadence, kind, status, due_date")
    .eq("owner_id", personId)
    .eq("kind", "project")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (error) return null;
  return (data ?? []) as Task[];
}
