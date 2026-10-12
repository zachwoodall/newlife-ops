"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
import { periodKey, type Cadence } from "@/lib/weekly";

export type AskResult = { error: string } | { ok: true };

export async function createCheckin(
  _prev: AskResult | null,
  formData: FormData,
): Promise<AskResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const question = String(formData.get("question") ?? "").trim();
  if (!question) return { error: "Write the question first." };

  const cadence = String(formData.get("cadence") ?? "weekly");
  const department = String(formData.get("department") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("checkins").insert({
    question,
    cadence,
    department,
    created_by: current.person.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/checkins");
  return { ok: true };
}

export type AnswerResult = { error: string } | { ok: true };

/**
 * Records this period's answer, or revises it if one already exists.
 * The period is computed server-side so a stale page cannot file an answer
 * against last week.
 */
export async function submitAnswer(
  _prev: AnswerResult | null,
  formData: FormData,
): Promise<AnswerResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const checkinId = String(formData.get("checkin_id") ?? "");
  const cadence = (String(formData.get("cadence") ?? "weekly") as Cadence);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };

  const period = periodKey(cadence);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("checkin_answers")
    .select("id")
    .eq("checkin_id", checkinId)
    .eq("person_id", current.person.id)
    .eq("period", period)
    .maybeSingle();

  const { error } = existing?.id
    ? await supabase
        .from("checkin_answers")
        .update({ body, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    : await supabase.from("checkin_answers").insert({
        checkin_id: checkinId,
        person_id: current.person.id,
        period,
        body,
      });

  if (error) return { error: error.message };
  revalidatePath("/checkins");
  return { ok: true };
}

export async function removeCheckin(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("checkins").delete().eq("id", id);
  revalidatePath("/checkins");
}
