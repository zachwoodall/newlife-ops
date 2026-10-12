import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
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

export type TaskComment = {
  id: string;
  body: string;
  author_id: string | null;
  created_at: string;
  edited_at: string | null;
};

export type Board = {
  task: Task;
  ownerName: string;
  assignees: Assignee[];
  checklist: ChecklistItem[];
  files: (TaskFile & { uploaderName: string })[];
  comments: (TaskComment & {
    authorName: string;
    reactions: { emoji: string; count: number; mine: boolean; who: string }[];
  })[];
  /** False when migration 0004 has not been applied to this project yet. */
  checklistReady: boolean;
  /** False when migration 0008 has not been applied yet. */
  filesReady: boolean;
  /** False when migration 0010 has not been applied yet. */
  commentsReady: boolean;
};

/** Everything behind one task. Returns null when it is missing or not yours. */
export async function loadBoard(taskId: string): Promise<Board | null> {
  const supabase = await createClient();
  // Needed to mark which reactions are the viewer's own.
  const currentPersonId = (await getCurrentPerson())?.person?.id ?? "";

  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, notes, owner_id, created_by, cadence, kind, status, due_date, series_id, occurrence_date")
    .eq("id", taskId)
    .maybeSingle();

  if (error || !task) return null;

  const [peopleRes, assigneeRes, checklistRes, filesRes, commentsRes] = await Promise.all([
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
    supabase
      .from("task_comments")
      .select("id, body, author_id, created_at, edited_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
  ]);

  // Reactions hang off comments, so they need the comment ids first.
  const commentIds = ((commentsRes.data ?? []) as TaskComment[]).map((c) => c.id);
  const reactionsRes = commentIds.length
    ? await supabase
        .from("reactions")
        .select("emoji, person_id, comment_id")
        .in("comment_id", commentIds)
    : { data: [], error: null };

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
    comments: ((commentsRes.data ?? []) as TaskComment[]).map((c) => {
      const mineAndTheirs = ((reactionsRes.data ?? []) as {
        emoji: string;
        person_id: string;
        comment_id: string;
      }[]).filter((r) => r.comment_id === c.id);

      const byEmoji = new Map<string, string[]>();
      for (const r of mineAndTheirs) {
        const list = byEmoji.get(r.emoji) ?? [];
        list.push(nameById.get(r.person_id) ?? "Someone");
        byEmoji.set(r.emoji, list);
      }

      return {
        ...c,
        authorName: nameById.get(c.author_id ?? "") ?? "Someone",
        reactions: [...byEmoji.entries()].map(([emoji, names]) => ({
          emoji,
          count: names.length,
          mine: mineAndTheirs.some(
            (r) => r.emoji === emoji && r.person_id === currentPersonId,
          ),
          who: names.join(", "),
        })),
      };
    }),
    checklistReady: !checklistRes.error,
    filesReady: !filesRes.error,
    commentsReady: !commentsRes.error,
  };
}
