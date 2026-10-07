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
    .select("id, title, notes, owner_id, created_by, cadence, kind, status, due_date, series_id, occurrence_date")
    .eq("owner_id", personId)
    .eq("kind", "project")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (error) return null;
  return (data ?? []) as Task[];
}

/**
 * How many of this person's open tasks are due today or already late.
 * Drives the reminder badge in the header.
 */
export async function countDueSoon(personId: string): Promise<number> {
  const supabase = await createClient();
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", personId)
    .neq("status", "done")
    .not("due_date", "is", null)
    .lte("due_date", localToday);

  return error ? 0 : (count ?? 0);
}
