"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";

export type CreateTaskResult = { error: string } | { ok: true };

export async function createTask(
  _prev: CreateTaskResult | null,
  formData: FormData,
): Promise<CreateTaskResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the task a title." };

  const cadence = String(formData.get("cadence") ?? "once");
  const dueRaw = String(formData.get("due_date") ?? "").trim();
  const ownerId = String(formData.get("owner_id") ?? "") || current.person.id;

  const supabase = await createClient();

  const blocked = (message: string) =>
    message.includes("policy")
      ? "You can't assign tasks to someone above you."
      : message;

  if (cadence === "once") {
    const { error } = await supabase.from("tasks").insert({
      title,
      cadence,
      due_date: dueRaw || null,
      owner_id: ownerId,
      created_by: current.person.id,
    });
    // The downward-only rule is a database policy, so a blocked assignment
    // surfaces here rather than being silently dropped.
    if (error) return { error: blocked(error.message) };
  } else {
    // A repeating job is a schedule that generates dated occurrences, so
    // finishing this week's copy never disturbs next week's.
    const { data: series, error: seriesError } = await supabase
      .from("task_series")
      .insert({
        title,
        cadence,
        owner_id: ownerId,
        created_by: current.person.id,
        starts_on: dueRaw || new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (seriesError) return { error: blocked(seriesError.message) };

    const { error: genError } = await supabase.rpc("generate_occurrences", {
      p_series: series.id,
      p_horizon: 4,
    });
    if (genError) return { error: genError.message };
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleTaskDone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const done = String(formData.get("done") ?? "") === "true";

  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({
      status: done ? "done" : "open",
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);

  revalidatePath("/tasks");
  revalidatePath("/");
}

export type UpdateTaskResult = { error: string } | { ok: true };

export async function updateTask(
  _prev: UpdateTaskResult | null,
  formData: FormData,
): Promise<UpdateTaskResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the task a title." };

  const cadence = String(formData.get("cadence") ?? "once");
  const dueRaw = String(formData.get("due_date") ?? "").trim();
  const ownerId = String(formData.get("owner_id") ?? "") || current.person.id;

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      cadence,
      due_date: dueRaw || null,
      owner_id: ownerId,
    })
    .eq("id", id);

  if (error) {
    return {
      error: error.message.includes("policy")
        ? "You can't hand this task to someone above you."
        : error.message,
    };
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true };
}

export type DeleteTaskResult = { error: string } | { ok: true };

/**
 * Only the creator may delete, enforced by RLS. A task someone else assigned
 * to you is theirs to withdraw, not yours to erase.
 */
export async function deleteTask(
  _prev: DeleteTaskResult | null,
  formData: FormData,
): Promise<DeleteTaskResult> {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("tasks")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return { error: error.message };
  if (!count) {
    return { error: "Only the person who created a task can delete it." };
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true };
}

/** Stop a repeating job and drop any occurrences still ahead of today. */
export async function stopRepeating(formData: FormData) {
  const seriesId = String(formData.get("series_id") ?? "");
  const supabase = await createClient();

  await supabase.from("task_series").update({ active: false }).eq("id", seriesId);
  await supabase
    .from("tasks")
    .delete()
    .eq("series_id", seriesId)
    .eq("status", "open")
    .gt("occurrence_date", new Date().toISOString().slice(0, 10));

  revalidatePath("/tasks");
  revalidatePath("/");
}
