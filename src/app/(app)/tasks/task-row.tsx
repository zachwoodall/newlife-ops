import { toggleTaskDone } from "./actions";
import { formatDue, isOverdue, type Task } from "@/lib/tasks";

export function TaskRow({ task }: { task: Task }) {
  const done = task.status === "done";
  const overdue = isOverdue(task);

  return (
    <li className="border-border flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <form action={toggleTaskDone} className="flex">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="done" value={String(!done)} />
        <button
          type="submit"
          aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          className={
            done
              ? "bg-brand-500 border-brand-500 grid size-5 place-items-center rounded border text-white"
              : "border-border hover:border-brand-500 size-5 rounded border transition-colors"
          }
        >
          {done && (
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
              <path
                d="M3.5 8.5l3 3 6-7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </form>

      <span className={done ? "text-muted flex-1 text-sm line-through" : "flex-1 text-sm"}>
        {task.title}
      </span>

      <span
        className={
          overdue
            ? "text-xs font-medium text-red-700 dark:text-red-300"
            : "text-muted text-xs"
        }
      >
        {overdue && "Overdue · "}
        {formatDue(task.due_date)}
      </span>
    </li>
  );
}
