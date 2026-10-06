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
