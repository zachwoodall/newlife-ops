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

export type TaskFile = {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string | null;
  kind: "image" | "video" | "document";
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Board = {
  task: Task;
  ownerName: string;
  assignees: Assignee[];
  checklist: ChecklistItem[];
  files: (TaskFile & { uploaderName: string })[];
  /** False when migration 0004 has not been applied to this project yet. */
  checklistReady: boolean;
  /** False when migration 0008 has not been applied yet. */
  filesReady: boolean;
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

  const [peopleRes, assigneeRes, checklistRes, filesRes] = await Promise.all([
    supabase.from("people").select("id, full_name"),
    supabase.from("task_assignees").select("person_id, role_label").eq("task_id", taskId),
    supabase
      .from("task_checklist")
      .select("id, label, done, sort_order")
      .eq("task_id", taskId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("task_files")
      .select("id, name, url, thumbnail_url, kind, size_bytes, uploaded_by, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
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
    files: ((filesRes.data ?? []) as TaskFile[]).map((f) => ({
      ...f,
      uploaderName: nameById.get(f.uploaded_by ?? "") ?? "Someone",
    })),
    checklistReady: !checklistRes.error,
    filesReady: !filesRes.error,
  };
}
