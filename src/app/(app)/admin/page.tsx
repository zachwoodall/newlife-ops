import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
import { PersonRowItem, type PersonRow } from "./person-row";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const supabase = await createClient();
  const { data: meRow, error: adminError } = await supabase
    .from("people")
    .select("is_admin")
    .eq("id", current.person.id)
    .maybeSingle();

  // Before migration 0018 the column does not exist.
  if (adminError) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Staff access</h1>
        <div className="border-brand-200 bg-brand-50 text-brand-900 mt-6 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">This page needs one more migration</p>
          <p className="mt-1">
            Run{" "}
            <code className="font-mono text-xs">supabase/migrations/0018_admin.sql</code>{" "}
            in the Supabase SQL Editor.
          </p>
        </div>
      </main>
    );
  }

  if (!meRow?.is_admin) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Staff access</h1>
        <p className="text-muted mt-2 text-sm">
          Only administrators can manage who signs in.
        </p>
      </main>
    );
  }

  const { data } = await supabase
    .from("people")
    .select("id, full_name, email, auth_user_id, is_admin, is_active")
    .order("full_name", { ascending: true });

  const people: PersonRow[] = (data ?? []).map((p) => ({
    id: p.id as string,
    full_name: p.full_name as string,
    email: (p.email as string | null) ?? null,
    hasAccess: Boolean(p.auth_user_id),
    is_admin: Boolean(p.is_admin),
    is_active: Boolean(p.is_active),
  }));

  const withAccess = people.filter((p) => p.hasAccess).length;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Staff access</h1>
      <p className="text-muted mt-1 text-sm">
        Who can sign in to Church Ops. {withAccess} of {people.length} have an
        account.
      </p>

      <div className="border-border mt-4 rounded-lg border p-4 text-sm">
        <p className="font-semibold">Removing access is not deleting a person</p>
        <p className="text-muted mt-1">
          Removing access deletes someone&rsquo;s login. They stay in the org
          chart, and their tasks, comments, files and messages remain exactly as
          they are. To remove someone from the org chart entirely &mdash; which
          does delete their work &mdash; use{" "}
          <span className="font-medium">My Department</span>.
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {people.map((p) => (
          <PersonRowItem key={p.id} person={p} isMe={p.id === current.person!.id} />
        ))}
      </ul>
    </main>
  );
}
