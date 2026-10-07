import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/tasks";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  sort_order: number;
};

export type Assignee = {
  person_id: string;
  role_label: string | null;
  full_name: string;
};

export type Board = {
  task: Task;
  ownerName: string;
  assignees: Assignee[];
  checklist: ChecklistItem[];
  /** False when migration 0004 has not been applied to this project yet. */
  checklistReady: boolean;
};

/** Everything behind one task. Returns null when it is missing or not yours. */
export async function loadBoard(taskId: string): Promise<Board | null> {
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, notes, owner_id, created_by, cadence, kind, status, due_date, series_id, occurrence_date")
    .eq("id", taskId)
    .maybeSingle();

  if (error || !task) return null;

  const [peopleRes, assigneeRes, checklistRes] = await Promise.all([
    supabase.from("people").select("id, full_name"),
    supabase.from("task_assignees").select("person_id, role_label").eq("task_id", taskId),
    supabase
      .from("task_checklist")
      .select("id, label, done, sort_order")
      .eq("task_id", taskId)
      .order("sort_order", { ascending: true }),
  ]);

  const nameById = new Map(
    (peopleRes.data ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  return {
    task: task as Task,
    ownerName: nameById.get(task.owner_id as string) ?? "Unassigned",
    assignees: (assigneeRes.data ?? []).map((a) => ({
      person_id: a.person_id as string,
      role_label: (a.role_label as string) ?? null,
      full_name: nameById.get(a.person_id as string) ?? "Unknown",
    })),
    checklist: (checklistRes.data ?? []) as ChecklistItem[],
    checklistReady: !checklistRes.error,
  };
}
