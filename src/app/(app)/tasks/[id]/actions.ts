"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
