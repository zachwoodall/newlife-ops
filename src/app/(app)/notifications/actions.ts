"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function refresh() {
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllRead() {
  const supabase = await createClient();
  // RLS limits this to your own rows, so no person filter is needed here.
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  refresh();
}

export async function clearAll() {
  const supabase = await createClient();
  await supabase.from("notifications").delete().not("id", "is", null);
  refresh();
}

/** Marks one read, used when following it through to the thing it is about. */
export async function markRead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  refresh();
}
