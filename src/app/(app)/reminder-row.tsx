import Link from "next/link";
import { toggleTaskDone } from "./tasks/actions";
import { CADENCE_LABEL, formatDue, isOverdue, type Task } from "@/lib/tasks";

export function ReminderRow({ task }: { task: Task }) {
  const overdue = isOverdue(task);

  return (
    <li className="border-border flex items-center gap-3 border-b py-3 last:border-b-0">
      <form action={toggleTaskDone} className="flex">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="done" value="true" />
        <button
          type="submit"
          aria-label={`Mark "${task.title}" done`}
          className="border-border hover:border-brand-500 hover:bg-brand-50 size-5 shrink-0 rounded border transition-colors dark:hover:bg-neutral-800"
        />
      </form>

      <Link href={`/tasks/${task.id}`} className="hover:text-brand-700 flex-1 text-sm">
        {task.title}
      </Link>

      <span className="text-muted hidden text-xs sm:inline">
        {CADENCE_LABEL[task.cadence]}
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
