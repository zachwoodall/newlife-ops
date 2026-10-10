import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
import { isCheckedThisWeek, daysUntilReset } from "@/lib/weekly";
import { AddForm } from "./add-form";
import { toggleItem, removeItem, moveItem } from "./actions";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  title: string;
  sort_order: number;
  checked_week: string | null;
};

export default async function WeeklyPage() {
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_items")
    .select("id, title, sort_order, checked_week")
    .eq("person_id", current.person.id)
    .order("sort_order", { ascending: true });

  const items = (data ?? []) as Item[];
  const done = items.filter((i) => isCheckedThisWeek(i.checked_week));
  const days = daysUntilReset();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">This Week</h1>
      <p className="text-muted mt-1 text-sm">
        Small things you should always be doing. They reset{" "}
        {days === 1 ? "tomorrow" : `in ${days} days`}, on Sunday.
      </p>

      {error ? (
        <div className="border-brand-200 bg-brand-50 text-brand-900 mt-6 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">One more migration to run</p>
          <p className="mt-1">
            Run{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0009_weekly_items.sql
            </code>{" "}
            in the Supabase SQL Editor.
          </p>
        </div>
      ) : (
        <>
          {items.length > 0 && (
            <p className="text-muted mt-4 text-xs font-semibold tracking-widest uppercase">
              {done.length} of {items.length} done
            </p>
          )}

          <ul className="mt-2 space-y-1.5">
            {items.map((item, index) => {
              const checked = isCheckedThisWeek(item.checked_week);
              return (
                <li
                  key={item.id}
                  className="border-border bg-surface group flex items-center gap-3 rounded-lg border px-3 py-2.5"
                >
                  <form action={toggleItem} className="flex min-w-0 flex-1 items-center gap-3">
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="done" value={String(checked)} />
                    <button
                      type="submit"
                      aria-pressed={checked}
                      aria-label={checked ? `Uncheck ${item.title}` : `Check off ${item.title}`}
                      className={
                        checked
                          ? "bg-brand-500 border-brand-500 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-white"
                          : "border-border hover:border-brand-500 h-5 w-5 shrink-0 rounded border"
                      }
                    >
                      {checked && (
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                          <path
                            d="M3.5 8.5l3 3 6-6.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                    <span
                      className={
                        checked
                          ? "text-muted min-w-0 flex-1 truncate text-left text-sm line-through"
                          : "min-w-0 flex-1 truncate text-left text-sm"
                      }
                    >
                      {item.title}
                    </span>
                  </form>

                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <form action={moveItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={index === 0}
                        aria-label={`Move ${item.title} up`}
                        className="text-muted hover:text-brand-700 rounded px-1.5 py-1 text-xs disabled:opacity-25"
                      >
                        ↑
                      </button>
                    </form>
                    <form action={moveItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={index === items.length - 1}
                        aria-label={`Move ${item.title} down`}
                        className="text-muted hover:text-brand-700 rounded px-1.5 py-1 text-xs disabled:opacity-25"
                      >
                        ↓
                      </button>
                    </form>
                    <form action={removeItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        aria-label={`Remove ${item.title}`}
                        className="text-muted rounded px-1.5 py-1 text-xs hover:text-red-700 dark:hover:text-red-300"
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>

          {items.length === 0 && (
            <p className="border-border text-muted mt-2 rounded-lg border border-dashed p-8 text-center text-sm">
              Nothing here yet. Add the things you want to stay on top of every week.
            </p>
          )}

          <AddForm />
        </>
      )}
    </main>
  );
}
