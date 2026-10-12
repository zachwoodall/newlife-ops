"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";

export type PostResult = { error: string } | { ok: true; id?: string };

function refresh(id?: string) {
  revalidatePath("/announcements");
  if (id) revalidatePath(`/announcements/${id}`);
  revalidatePath("/", "layout");
}

export async function postAnnouncement(
  _prev: PostResult | null,
  formData: FormData,
): Promise<PostResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) return { error: "Give it a title." };
  if (!body) return { error: "Write something first." };

  const department = String(formData.get("department") ?? "").trim();
  const audience = department ? "department" : "all";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      author_id: current.person.id,
      title,
      body,
      audience,
      department: audience === "department" ? department : null,
    })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  refresh();
  return { ok: true, id: data?.id };
}

export type ReplyResult = { error: string } | { ok: true };

export async function postReply(
  _prev: ReplyResult | null,
  formData: FormData,
): Promise<ReplyResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const id = String(formData.get("announcement_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };

  const supabase = await createClient();
  const { error } = await supabase.from("announcement_replies").insert({
    announcement_id: id,
    author_id: current.person.id,
    body,
  });

  if (error) return { error: error.message };
  refresh(id);
  return { ok: true };
}

export async function withdrawAnnouncement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("announcements").delete().eq("id", id);
  refresh();
}

export async function removeReply(formData: FormData) {
  const id = String(formData.get("announcement_id") ?? "");
  const replyId = String(formData.get("reply_id") ?? "");
  const supabase = await createClient();
  await supabase.from("announcement_replies").delete().eq("id", replyId);
  refresh(id);
}
