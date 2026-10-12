import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/current-person";
import { tasksBetween, ensureCalendarToken } from "@/lib/calendar-data";
import { monthGrid, monthWindow, shiftMonth, MONTH_NAMES } from "@/lib/month";
import { SubscribeLink } from "./subscribe-link";

export const dynamic = "force-dynamic";

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const sp = await searchParams;
  const today = new Date();
  const year = Number(sp.y) || today.getFullYear();
  const month = sp.m !== undefined ? Number(sp.m) : today.getMonth();

  const { from, to } = monthWindow(year, month);
  const { items, ready } = await tasksBetween(current.person.id, from, to);
  const token = ready ? await ensureCalendarToken(current.person.id) : null;

  const byDate = new Map<string, typeof items>();
  for (const t of items) {
    const list = byDate.get(t.due_date) ?? [];
    list.push(t);
    byDate.set(t.due_date, list);
  }

  const cells = monthGrid(year, month);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {MONTH_NAMES[month]} {year}
        </h1>
        <div className="flex gap-1">
          <Link
            href={`/calendar?y=${prev.year}&m=${prev.month}`}
            aria-label="Previous month"
            className="border-border hover:border-brand-500 rounded-md border px-2.5 py-1 text-sm"
          >
            &larr;
          </Link>
          <Link
            href="/calendar"
            className="border-border hover:border-brand-500 rounded-md border px-2.5 py-1 text-sm"
          >
            Today
          </Link>
          <Link
            href={`/calendar?y=${next.year}&m=${next.month}`}
            aria-label="Next month"
            className="border-border hover:border-brand-500 rounded-md border px-2.5 py-1 text-sm"
          >
            &rarr;
          </Link>
        </div>
      </div>

      {!ready ? (
        <div className="border-brand-200 bg-brand-50 text-brand-900 mt-6 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">The calendar needs one more migration</p>
          <p className="mt-1">
            Run{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0013_calendar.sql
            </code>{" "}
            in the Supabase SQL Editor.
          </p>
        </div>
      ) : (
        <>
          <div className="border-border mt-5 overflow-hidden rounded-lg border">
            <div className="grid grid-cols-7">
              {DAY_INITIALS.map((d, i) => (
                <div
                  key={i}
                  className="text-muted border-border border-b px-2 py-1.5 text-center text-xs font-semibold"
                >
                  {d}
                </div>
              ))}
              {cells.map((cell) => {
                const dayTasks = byDate.get(cell.date) ?? [];
                const isToday = cell.date === todayIso;
                return (
                  <div
                    key={cell.date}
                    className={
                      "border-border min-h-20 border-r border-b p-1.5 last:border-r-0 " +
                      (cell.inMonth ? "" : "bg-neutral-50 dark:bg-neutral-900/50")
                    }
                  >
                    <div
                      className={
                        isToday
                          ? "bg-brand-500 grid size-5 place-items-center rounded-full text-[11px] font-semibold text-white"
                          : cell.inMonth
                            ? "text-[11px] font-medium"
                            : "text-muted text-[11px]"
                      }
                    >
                      {Number(cell.date.slice(8))}
                    </div>
                    <ul className="mt-0.5 space-y-0.5">
                      {dayTasks.map((t) => (
                        <li key={t.id}>
                          <Link
                            href={`/tasks/${t.id}`}
                            title={t.title}
                            className={
                              t.status === "done"
                                ? "text-muted block truncate rounded px-1 py-0.5 text-[11px] line-through hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                : "bg-brand-50 text-brand-900 hover:bg-brand-100 block truncate rounded px-1 py-0.5 text-[11px] dark:bg-neutral-800 dark:text-neutral-200"
                            }
                          >
                            {t.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {token && <SubscribeLink token={token} />}
        </>
      )}
    </main>
  );
}
