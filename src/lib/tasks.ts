export const CADENCES = ["weekly", "monthly", "quarterly", "yearly", "once"] as const;
export type Cadence = (typeof CADENCES)[number];

export const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  once: "One-off",
};

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  owner_id: string;
  created_by: string | null;
  cadence: Cadence;
  kind: "project" | "todo";
  status: "open" | "in_progress" | "done";
  due_date: string | null;
};

/** Group tasks under each cadence heading, in display order. */
export function byCadence(tasks: Task[]): [Cadence, Task[]][] {
  return CADENCES.map((c) => [c, tasks.filter((t) => t.cadence === c)] as [Cadence, Task[]]);
}

/** Midnight-safe comparison — a task due today is not overdue. */
export function isOverdue(task: Task, today = new Date()): boolean {
  if (!task.due_date || task.status === "done") return false;
  const due = new Date(`${task.due_date}T23:59:59`);
  return due.getTime() < today.getTime();
}

export function formatDue(due: string | null): string {
  if (!due) return "No deadline";
  const d = new Date(`${due}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Church weeks run Sunday to Saturday, so that is the window Home uses.
 * Returns the last millisecond of the week containing `today`.
 */
export function endOfWeek(today: Date, weekStartsOn = 0): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const daysSinceStart = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - daysSinceStart + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** A task counts for "this week" if it is overdue or falls due by Saturday. */
export function isDueThisWeek(task: Task, today = new Date()): boolean {
  if (task.status === "done" || !task.due_date) return false;
  const due = new Date(`${task.due_date}T12:00:00`);
  return due.getTime() <= endOfWeek(today).getTime();
}

/**
 * The reminder list for Home: everything still open that is overdue or due
 * this week, most urgent first. Undated tasks are left out — without a
 * deadline there is nothing to be late for.
 */
export function weekReminders(
  tasks: Task[],
  today = new Date(),
  limit = 5,
): { shown: Task[]; total: number } {
  const due = tasks
    .filter((t) => t.status !== "done" && isDueThisWeek(t, today))
    .sort((a, b) => {
      const byDate = (a.due_date ?? "").localeCompare(b.due_date ?? "");
      return byDate !== 0 ? byDate : a.title.localeCompare(b.title);
    });

  return { shown: due.slice(0, limit), total: due.length };
}
