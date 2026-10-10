"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";

export type SendResult = { error: string } | { ok: true } | null;

export async function sendMessage(
  _prev: SendResult,
  formData: FormData,
): Promise<SendResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const recipientId = String(formData.get("recipient_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!recipientId) return { error: "Pick someone to message." };
  if (!body) return { error: "Write something first." };

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    sender_id: current.person.id,
    recipient_id: recipientId,
    body,
  });

  if (error) {
    if (error.message.includes("messages_not_self")) {
      return { error: "You can't message yourself." };
    }
    return { error: error.message };
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${recipientId}`);
  revalidatePath("/department");
  return { ok: true };
}

/** Called when a thread is opened. Only the recipient's copies are touched. */
export async function markThreadRead(meId: string, otherId: string) {
  const supabase = await createClient();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", meId)
    .eq("sender_id", otherId)
    .is("read_at", null);
}
