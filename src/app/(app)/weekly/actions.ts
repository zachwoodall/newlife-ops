"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
import { weekStart } from "@/lib/weekly";

export type AddResult = { error: string } | { ok: true };

/** Items sit at the end of the list unless moved. */
async function nextSortOrder(personId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_items")
    .select("sort_order")
    .eq("person_id", personId)
    .order("sort_order", { ascending: false })
    .limit(1);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

export async function addItem(
  _prev: AddResult | null,
  formData: FormData,
): Promise<AddResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the reminder a name." };

  const supabase = await createClient();
  const { error } = await supabase.from("weekly_items").insert({
    person_id: current.person.id,
    title,
    sort_order: await nextSortOrder(current.person.id),
  });

  if (error) return { error: error.message };
  revalidatePath("/weekly");
  return { ok: true };
}

/**
 * Checking stores the current week; unchecking clears it. Nothing needs to
 * run at the turn of the week — last week's value simply stops matching.
 */
export async function toggleItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const done = String(formData.get("done") ?? "") === "true";

  const supabase = await createClient();
  await supabase
    .from("weekly_items")
    .update({ checked_week: done ? null : weekStart() })
    .eq("id", id);

  revalidatePath("/weekly");
}

export async function removeItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("weekly_items").delete().eq("id", id);
  revalidatePath("/weekly");
}

/** Swaps an item's position with its neighbour in the given direction. */
export async function moveItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");

  const current = await getCurrentPerson();
  if (!current?.person) return;

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("weekly_items")
    .select("id, sort_order")
    .eq("person_id", current.person.id)
    .order("sort_order", { ascending: true });

  if (!items) return;

  const index = items.findIndex((i) => i.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= items.length) return;

  const a = items[index];
  const b = items[swapWith];
  // Positions may be equal or duplicated; rewrite both from their list index
  // so a swap is still a swap.
  await supabase.from("weekly_items").update({ sort_order: swapWith }).eq("id", a.id);
  await supabase.from("weekly_items").update({ sort_order: index }).eq("id", b.id);

  revalidatePath("/weekly");
}
