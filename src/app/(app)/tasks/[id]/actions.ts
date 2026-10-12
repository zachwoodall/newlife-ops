"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
import { deleteFromImageKit } from "@/lib/imagekit";

const touch = (id: string) => {
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
  revalidatePath("/");
};

export async function saveNotes(formData: FormData) {
  const id = String(formData.get("task_id") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const supabase = await createClient();
  await supabase.from("tasks").update({ notes: notes || null }).eq("id", id);
  touch(id);
}

export async function setStatus(formData: FormData) {
  const id = String(formData.get("task_id") ?? "");
  const status = String(formData.get("status") ?? "open");
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({
      status,
      // The database insists completed_at and status agree.
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  touch(id);
}

export async function addChecklistItem(formData: FormData) {
  const id = String(formData.get("task_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("task_checklist")
    .select("sort_order")
    .eq("task_id", id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const next = data?.length ? Number(data[0].sort_order) + 1 : 0;
  await supabase.from("task_checklist").insert({ task_id: id, label, sort_order: next });
  touch(id);
}

export async function toggleChecklistItem(formData: FormData) {
  const id = String(formData.get("task_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const done = String(formData.get("done") ?? "") === "true";
  const supabase = await createClient();
  await supabase.from("task_checklist").update({ done }).eq("id", itemId);
  touch(id);
}

export async function removeChecklistItem(formData: FormData) {
  const id = String(formData.get("task_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const supabase = await createClient();
  await supabase.from("task_checklist").delete().eq("id", itemId);
  touch(id);
}

export type AssigneeResult = { error: string } | { ok: true } | null;

export async function addAssignee(
  _prev: AssigneeResult,
  formData: FormData,
): Promise<AssigneeResult> {
  const id = String(formData.get("task_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  const role = String(formData.get("role_label") ?? "").trim();
  if (!personId) return { error: "Pick someone to tag." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_assignees")
    .insert({ task_id: id, person_id: personId, role_label: role || null });

  if (error) {
    if (error.code === "23505") return { error: "They're already on this task." };
    return {
      error: error.message.includes("policy")
        ? "You can only tag people below you in the org chart."
        : error.message,
    };
  }
  touch(id);
  return { ok: true };
}

export async function removeAssignee(formData: FormData) {
  const id = String(formData.get("task_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  const supabase = await createClient();
  await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", id)
    .eq("person_id", personId);
  touch(id);
}

export type FileRecord = {
  imagekit_file_id: string;
  name: string;
  url: string;
  thumbnail_url: string | null;
  kind: "image" | "video" | "document";
  size_bytes: number | null;
};

/**
 * Records a file that the browser has already pushed to ImageKit.
 * RLS checks the uploader can see the task and is not attributing the
 * upload to someone else.
 */
export async function recordFile(taskId: string, file: FileRecord) {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("task_files").insert({
    task_id: taskId,
    uploaded_by: current.person.id,
    ...file,
  });

  if (error) return { error: error.message };
  touch(taskId);
  return { ok: true as const };
}

export async function removeFile(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "");
  const fileId = String(formData.get("file_id") ?? "");
  const supabase = await createClient();

  // Delete the row first and ask for it back. RLS decides whether this person
  // may remove it, so a returned row is proof the removal was allowed — only
  // then do we touch the stored bytes. Doing it the other way round would let
  // anyone who can guess a file id destroy an upload they cannot even see.
  const { data: removed } = await supabase
    .from("task_files")
    .delete()
    .eq("id", fileId)
    .select("imagekit_file_id")
    .maybeSingle();

  if (removed?.imagekit_file_id) {
    const result = await deleteFromImageKit(removed.imagekit_file_id);
    // The row is already gone, so a storage failure only leaves an orphaned
    // file in ImageKit. Worth knowing about, not worth failing the action.
    if (!result.ok) {
      console.warn(
        `Removed file record ${fileId} but its ImageKit copy remains: ${result.reason}`,
      );
    }
  }

  touch(taskId);
}

export type CommentResult = { error: string } | { ok: true };

export async function addComment(
  _prev: CommentResult | null,
  formData: FormData,
): Promise<CommentResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const taskId = String(formData.get("task_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: current.person.id,
    body,
  });

  if (error) return { error: error.message };
  touch(taskId);
  return { ok: true };
}

export async function removeComment(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "");
  const commentId = String(formData.get("comment_id") ?? "");
  const supabase = await createClient();
  await supabase.from("task_comments").delete().eq("id", commentId);
  touch(taskId);
}
