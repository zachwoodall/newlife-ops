import { createClient } from "@/lib/supabase/server";

export type CalendarTask = {
  id: string;
  title: string;
  due_date: string;
  status: string;
  owner_id: string;
};

/**
 * Dated tasks you own or are tagged on, for the month grid.
 * Window is inclusive of both ends, as YYYY-MM-DD.
 */
export async function tasksBetween(
  personId: string,
  from: string,
  to: string,
): Promise<{ items: CalendarTask[]; ready: boolean }> {
  const supabase = await createClient();

  const { data: tagged } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("person_id", personId);

  const taggedIds = (tagged ?? []).map((t) => t.task_id as string);

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, due_date, status, owner_id")
    .not("due_date", "is", null)
    .gte("due_date", from)
    .lte("due_date", to)
    .order("due_date", { ascending: true });

  if (error) return { items: [], ready: false };

  // RLS already limits what comes back; narrow to mine-or-tagged for the view.
  const items = (data ?? []).filter(
    (t) => t.owner_id === personId || taggedIds.includes(t.id as string),
  ) as CalendarTask[];

  return { items, ready: true };
}

/** Your feed token, created on first visit to the calendar. */
export async function ensureCalendarToken(personId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: existing, error } = await supabase
    .from("calendar_tokens")
    .select("token")
    .eq("person_id", personId)
    .maybeSingle();

  if (error) return null;
  if (existing?.token) return existing.token as string;

  const { data: created } = await supabase
    .from("calendar_tokens")
    .insert({ person_id: personId })
    .select("token")
    .maybeSingle();

  return (created?.token as string) ?? null;
}
