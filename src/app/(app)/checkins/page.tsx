import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
import { myDepartments } from "@/lib/announcements-data";
import { periodKey, periodLabel, type Cadence } from "@/lib/weekly";
import { AskForm } from "./ask-form";
import { AnswerForm } from "./answer-form";
import { removeCheckin } from "./actions";

export const dynamic = "force-dynamic";

type Checkin = {
  id: string;
  question: string;
  cadence: Cadence;
  department: string | null;
  created_by: string | null;
};

type Answer = {
  id: string;
  checkin_id: string;
  person_id: string;
  period: string;
  body: string;
};

export default async function CheckinsPage() {
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");
  const me = current.person.id;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("id, question, cadence, department, created_by")
    .eq("active", true)
    .order("created_at", { ascending: true });

  const checkins = (data ?? []) as Checkin[];

  const { data: answerRows } = checkins.length
    ? await supabase
        .from("checkin_answers")
        .select("id, checkin_id, person_id, period, body")
        .in("checkin_id", checkins.map((c) => c.id))
    : { data: [] };

  const { data: people } = await supabase.from("people").select("id, full_name");
  const names = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]));
  const answers = (answerRows ?? []) as Answer[];
  const departments = error ? [] : await myDepartments();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Check-ins</h1>
      <p className="text-muted mt-1 text-sm">
        Recurring questions, answered in one place instead of a meeting.
      </p>

      {error ? (
        <div className="border-brand-200 bg-brand-50 text-brand-900 mt-6 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">Check-ins need one more migration</p>
          <p className="mt-1">
            Run{" "}
            <code className="font-mono text-xs">supabase/migrations/0016_checkins.sql</code>{" "}
            in the Supabase SQL Editor.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <AskForm departments={departments} />
          </div>

          {checkins.length === 0 ? (
            <p className="border-border text-muted mt-5 rounded-lg border border-dashed p-8 text-center text-sm">
              No check-ins yet.
            </p>
          ) : (
            <ul className="mt-5 space-y-5">
              {checkins.map((c) => {
                const period = periodKey(c.cadence);
                const thisPeriod = answers.filter(
                  (a) => a.checkin_id === c.id && a.period === period,
                );
                const mine = thisPeriod.find((a) => a.person_id === me);
                const others = thisPeriod.filter((a) => a.person_id !== me);

                return (
                  <li key={c.id} className="border-border rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h2 className="font-medium">{c.question}</h2>
                        <p className="text-muted mt-0.5 text-xs">
                          {c.cadence === "monthly" ? "Monthly" : "Weekly"} ·{" "}
                          {periodLabel(c.cadence, period)}
                          {c.department ? ` · ${c.department}` : ""}
                        </p>
                      </div>
                      {c.created_by === me && (
                        <form action={removeCheckin}>
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            aria-label={`Remove check-in: ${c.question}`}
                            className="text-muted shrink-0 text-xs font-medium hover:text-red-700 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </form>
                      )}
                    </div>

                    <AnswerForm
                      checkinId={c.id}
                      cadence={c.cadence}
                      existing={mine?.body ?? null}
                    />

                    {others.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {others.map((a) => (
                          <li
                            key={a.id}
                            className="border-border bg-surface rounded-lg border px-3 py-2.5"
                          >
                            <p className="text-sm font-medium">
                              {names.get(a.person_id) ?? "Someone"}
                            </p>
                            <p className="mt-0.5 text-sm whitespace-pre-wrap">{a.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}

                    {others.length === 0 && mine && (
                      <p className="text-muted mt-3 text-xs">
                        Nobody else has answered this period yet.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
