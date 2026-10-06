import Link from "next/link";
import { getCurrentPerson, displayName } from "@/lib/current-person";
import { loadMyTasks } from "@/lib/tasks-data";
import { weekReminders } from "@/lib/tasks";
import { SetupNotice } from "./setup-notice";
import { ReminderRow } from "./reminder-row";

export default async function HomePage() {
  const current = await getCurrentPerson();
  if (!current) return null; // middleware redirects before this can happen

  const tasks = current.person ? await loadMyTasks(current.person.id) : null;
  const { shown, total } = weekReminders(tasks ?? []);
  const moreCount = total - shown.length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome, {displayName(current)}
      </h1>
      <p className="text-muted mt-1">
        Here&apos;s what needs your attention this week.
      </p>

      {!current.dbReady && (
        <div className="mt-6">
          <SetupNotice />
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">
          Top 5 incomplete this week
        </h2>

        {shown.length === 0 ? (
          <div className="border-border text-muted mt-3 rounded-lg border border-dashed p-8 text-center text-sm">
            {tasks === null || tasks.length === 0 ? (
              <>
                Nothing on your plate yet.{" "}
                <Link href="/tasks" className="text-brand-700 underline">
                  Add a task
                </Link>
                .
              </>
            ) : (
              "Nothing due this week. You're caught up."
            )}
          </div>
        ) : (
          <>
            <ul className="border-border bg-surface mt-3 rounded-lg border px-4">
              {shown.map((t) => (
                <ReminderRow key={t.id} task={t} />
              ))}
            </ul>
            <p className="text-muted mt-2 text-xs">
              {moreCount > 0
                ? `${moreCount} more due this week · `
                : ""}
              <Link href="/tasks" className="hover:text-brand-700 underline">
                See the full task directory
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
