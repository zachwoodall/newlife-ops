"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";

export type ChannelResult = { error: string } | { ok: true; id?: string };

function refresh(id?: string) {
  revalidatePath("/messages");
  if (id) revalidatePath(`/messages/channel/${id}`);
  revalidatePath("/", "layout");
}

export async function createChannel(
  _prev: ChannelResult | null,
  formData: FormData,
): Promise<ChannelResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the channel a name." };

  const description = String(formData.get("description") ?? "").trim() || null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("channels")
    .insert({ name, description, created_by: current.person.id })
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: error?.message ?? "Could not create it." };

  // The creator is always a member; a channel you cannot post in is useless.
  await supabase
    .from("channel_members")
    .insert({ channel_id: data.id, person_id: current.person.id });

  refresh();
  return { ok: true, id: data.id as string };
}

export async function renameChannel(formData: FormData) {
  const id = String(formData.get("channel_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("channels").update({ name, description }).eq("id", id);
  refresh(id);
}

export async function addMember(formData: FormData) {
  const id = String(formData.get("channel_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  if (!personId) return;

  const supabase = await createClient();
  await supabase.from("channel_members").insert({ channel_id: id, person_id: personId });
  refresh(id);
}

export async function removeMember(formData: FormData) {
  const id = String(formData.get("channel_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");

  const supabase = await createClient();
  await supabase
    .from("channel_members")
    .delete()
    .eq("channel_id", id)
    .eq("person_id", personId);
  refresh(id);
}

export type PostResult = { error: string } | { ok: true };

export async function postToChannel(
  _prev: PostResult | null,
  formData: FormData,
): Promise<PostResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const id = String(formData.get("channel_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("channel_messages")
    .insert({ channel_id: id, sender_id: current.person.id, body });

  if (error) return { error: error.message };
  refresh(id);
  return { ok: true };
}

/** Records that you have seen everything up to now, for the unread count. */
export async function markChannelRead(channelId: string) {
  const current = await getCurrentPerson();
  if (!current?.person) return;

  const supabase = await createClient();
  await supabase.from("channel_reads").upsert(
    {
      channel_id: channelId,
      person_id: current.person.id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "channel_id,person_id" },
  );
}
