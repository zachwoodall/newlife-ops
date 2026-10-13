"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
import { generatePassword } from "@/lib/passwords";

export type AdminResult =
  | { error: string }
  | { ok: true; message: string; password?: string };

/**
 * Every action re-checks admin status against the database using the caller's
 * own session. The page knowing you are an admin is not evidence: a form can
 * be submitted from anywhere.
 */
async function requireAdmin(): Promise<
  { ok: true; personId: string } | { ok: false; error: string }
> {
  const current = await getCurrentPerson();
  if (!current?.person) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("people")
    .select("is_admin")
    .eq("id", current.person.id)
    .maybeSingle();

  if (!data?.is_admin) return { ok: false, error: "You are not an administrator." };
  return { ok: true, personId: current.person.id };
}

/** The elevated client. Only ever constructed after requireAdmin passes. */
function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function configured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

/**
 * Creates a login for someone already in the org chart and links it to their
 * row. Returns the first password once, for the administrator to pass on; it
 * is never stored anywhere readable.
 */
export async function grantAccess(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  if (!configured()) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set." };

  const personId = String(formData.get("person_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Give them an email address." };

  const admin = adminClient();

  const { data: person } = await admin
    .from("people")
    .select("id, full_name, auth_user_id")
    .eq("id", personId)
    .maybeSingle();

  if (!person) return { error: "No such person." };
  if (person.auth_user_id) return { error: `${person.full_name} already has access.` };

  const password = generatePassword();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !created?.user) {
    return { error: authError?.message ?? "Could not create the login." };
  }

  const { error: linkError } = await admin
    .from("people")
    .update({ email, auth_user_id: created.user.id, is_active: true })
    .eq("id", personId);

  if (linkError) {
    // Don't leave an orphaned login that belongs to nobody.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `Could not link the account: ${linkError.message}` };
  }

  refresh();
  return {
    ok: true,
    message: `${person.full_name} can now sign in as ${email}.`,
    password,
  };
}

/**
 * Removes someone's login. Their row, tasks, comments and messages all stay --
 * this is for someone who has left, not someone added by mistake.
 */
export async function revokeAccess(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  if (!configured()) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set." };

  const personId = String(formData.get("person_id") ?? "");
  if (personId === gate.personId) {
    return { error: "You cannot revoke your own access." };
  }

  const admin = adminClient();
  const { data: person } = await admin
    .from("people")
    .select("id, full_name, auth_user_id, is_admin")
    .eq("id", personId)
    .maybeSingle();

  if (!person) return { error: "No such person." };
  if (!person.auth_user_id) return { error: `${person.full_name} has no login to remove.` };

  if (person.auth_user_id) {
    const { error } = await admin.auth.admin.deleteUser(person.auth_user_id as string);
    if (error) return { error: error.message };
  }

  await admin
    .from("people")
    .update({ auth_user_id: null, is_active: false })
    .eq("id", personId);

  refresh();
  return {
    ok: true,
    message: `${person.full_name} can no longer sign in. Their work and messages are untouched.`,
  };
}

/** Issues a new password, for someone who has lost theirs. */
export async function resetPassword(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  if (!configured()) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set." };

  const personId = String(formData.get("person_id") ?? "");
  const admin = adminClient();

  const { data: person } = await admin
    .from("people")
    .select("full_name, auth_user_id")
    .eq("id", personId)
    .maybeSingle();

  if (!person?.auth_user_id) return { error: "That person has no login." };

  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(
    person.auth_user_id as string,
    { password },
  );
  if (error) return { error: error.message };

  refresh();
  return { ok: true, message: `New password for ${person.full_name}.`, password };
}

/** Promotes or demotes an administrator. The database refuses the last one. */
export async function toggleAdmin(formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return;

  const personId = String(formData.get("person_id") ?? "");
  const makeAdmin = String(formData.get("make_admin") ?? "") === "true";

  const supabase = await createClient();
  await supabase.from("people").update({ is_admin: makeAdmin }).eq("id", personId);
  refresh();
}
