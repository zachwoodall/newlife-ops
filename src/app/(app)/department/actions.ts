"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CAMPUS_COOKIE } from "@/lib/campus";
import { createClient } from "@/lib/supabase/server";

export async function setCampus(formData: FormData) {
  const campus = String(formData.get("campus") ?? "");
  const store = await cookies();
  store.set(CAMPUS_COOKIE, campus, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/department");
}

export type OrgResult = { error: string } | { ok: true } | null;

const refresh = () => {
  revalidatePath("/department");
  revalidatePath("/tasks");
  revalidatePath("/");
};

const DENIED = "You can only change roles below you in the org chart.";

function explain(message: string): string {
  if (message.includes("Cycle")) {
    return "That would make someone report to their own team member.";
  }
  if (message.includes("policy") || message.includes("denied")) return DENIED;
  if (message.includes("duplicate") || message.includes("unique")) {
    return "A role with that name already exists.";
  }
  return message;
}

/** Turn a title into a stable url-ish key, unique enough within a campus. */
function slugify(campus: string, title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const prefix = campus === "holly-springs" ? "hs" : "uh";
  return `${prefix}-${base || "role"}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function updatePosition(
  _prev: OrgResult,
  formData: FormData,
): Promise<OrgResult> {
  const id = String(formData.get("position_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const reportsTo = String(formData.get("reports_to_id") ?? "");

  if (!title) return { error: "Give the role a title." };
  if (!department) return { error: "Give the role a department." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("positions")
    .update(
      { title, department, reports_to_id: reportsTo || null },
      { count: "exact" },
    )
    .eq("id", id);

  if (error) return { error: explain(error.message) };
  // RLS makes a forbidden update match zero rows rather than raise.
  if (!count) return { error: DENIED };

  refresh();
  return { ok: true };
}

export async function addPosition(
  _prev: OrgResult,
  formData: FormData,
): Promise<OrgResult> {
  const parentId = String(formData.get("parent_id") ?? "");
  const campusKey = String(formData.get("campus") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  if (!title) return { error: "Give the role a title." };

  const supabase = await createClient();
  const { data: parent } = await supabase
    .from("positions")
    .select("campus_id, department")
    .eq("id", parentId)
    .single();

  if (!parent) return { error: "Couldn't find the role to add under." };

  const { error } = await supabase.from("positions").insert({
    key: slugify(campusKey, title),
    title,
    department: department || (parent.department as string),
    campus_id: parent.campus_id,
    reports_to_id: parentId,
  });

  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true };
}

export async function deletePosition(formData: FormData) {
  const id = String(formData.get("position_id") ?? "");
  const supabase = await createClient();
  // Anyone reporting to it is lifted to its supervisor by a database trigger.
  await supabase.from("positions").delete().eq("id", id);
  refresh();
}

export async function assignHolder(
  _prev: OrgResult,
  formData: FormData,
): Promise<OrgResult> {
  const positionId = String(formData.get("position_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  const newName = String(formData.get("new_name") ?? "").trim();
  const newEmail = String(formData.get("new_email") ?? "").trim();

  const supabase = await createClient();
  let targetId = personId;

  if (personId === "__new__") {
    if (!newName) return { error: "Give the new person a name." };
    const key =
      newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 5);

    const { data, error } = await supabase
      .from("people")
      .insert({ key, full_name: newName, email: newEmail || null })
      .select("id")
      .single();

    if (error) return { error: explain(error.message) };
    targetId = data.id as string;
  }

  if (!targetId) return { error: "Pick someone, or add a new person." };

  const { error } = await supabase
    .from("position_holders")
    .insert({ position_id: positionId, person_id: targetId });

  if (error) {
    if (error.code === "23505") return { error: "They already hold this role." };
    return { error: explain(error.message) };
  }
  refresh();
  return { ok: true };
}

export async function removeHolder(formData: FormData) {
  const positionId = String(formData.get("position_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  const supabase = await createClient();
  await supabase
    .from("position_holders")
    .delete()
    .eq("position_id", positionId)
    .eq("person_id", personId);
  refresh();
}
