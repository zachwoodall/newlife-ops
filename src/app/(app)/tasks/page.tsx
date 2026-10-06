import { getCurrentPerson } from "@/lib/current-person";
import { loadOrg } from "@/lib/org-data";
import { assignableBy } from "@/lib/org";
import { byCadence, CADENCE_LABEL } from "@/lib/tasks";
import { loadMyTasks } from "@/lib/tasks-data";
import { createClient } from "@/lib/supabase/server";
import { SetupNotice } from "../setup-notice";
import { NewTaskForm } from "./new-task-form";
import { TaskRow } from "./task-row";

export default async function TasksPage() {
  const current = await getCurrentPerson();
  if (!current) return null;

  const org = await loadOrg();
  if (!org || !current.person) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Task Directory</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </main>
    );
  }

  const me = current.person;
  const tasks = await loadMyTasks(me.id);

  if (tasks === null) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Task Directory</h1>
        <div className="border-brand-200 bg-brand-50 text-brand-900 mt-6 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">One more migration to run</p>
          <p className="mt-1">
            Tasks need{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0003_tasks.sql
            </code>{" "}
            applied in the Supabase SQL Editor. Everything else is ready.
          </p>
        </div>
      </main>
    );
  }

  const groups = byCadence(tasks);

  // Everyone this person may assign to, resolved to database ids for the form.
  const supabase = await createClient();
  const { data: peopleRows } = await supabase.from("people").select("id, key, full_name");
  const idByKey = new Map((peopleRows ?? []).map((p) => [p.key as string, p.id as string]));

  const options = [
    { id: me.id, name: `${me.full_name} (you)` },
    ...assignableBy(org, me.key)
      .map((p) => ({ id: idByKey.get(p.key) ?? "", name: p.full_name }))
      .filter((p) => p.id),
  ];

  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Task Directory</h1>
          <p className="text-muted mt-1">
            {openCount === 0
              ? "Nothing outstanding."
              : `${openCount} open ${openCount === 1 ? "task" : "tasks"} you're responsible for.`}
          </p>
        </div>
        <NewTaskForm people={options} meId={me.id} />
      </div>

      <div className="mt-8 space-y-8">
        {groups.map(([cadence, list]) => (
          <section key={cadence}>
            <h2 className="text-sm font-semibold tracking-widest uppercase">
              {CADENCE_LABEL[cadence]}
              <span className="text-muted ml-2 font-normal">{list.length}</span>
            </h2>

            {list.length === 0 ? (
              <p className="text-muted border-border mt-2 rounded-lg border border-dashed px-4 py-5 text-center text-sm">
                Nothing {CADENCE_LABEL[cadence].toLowerCase()} yet.
              </p>
            ) : (
              <ul className="border-border bg-surface mt-2 rounded-lg border px-4">
                {list.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
