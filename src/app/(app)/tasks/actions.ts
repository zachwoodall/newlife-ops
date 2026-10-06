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
  const { error } = await supabase.from("tasks").insert({
    title,
    cadence,
    due_date: dueRaw || null,
    owner_id: ownerId,
    created_by: current.person.id,
  });

  if (error) {
    // The downward-only rule is a database policy, so a blocked assignment
    // surfaces here rather than being silently dropped.
    return {
      error: error.message.includes("policy")
        ? "You can't assign tasks to someone above you."
        : error.message,
    };
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
