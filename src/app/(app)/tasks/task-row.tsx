"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import {
  toggleTaskDone,
  updateTask,
  deleteTask,
  type UpdateTaskResult,
  type DeleteTaskResult,
} from "./actions";
import { CADENCES, CADENCE_LABEL, formatDue, isOverdue, type Task } from "@/lib/tasks";

export function TaskRow({
  task,
  people,
  canDelete,
}: {
  task: Task;
  people: { id: string; name: string }[];
  /** Only the creator may delete, matching the database policy. */
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [saveState, saveAction, saving] = useActionState<
    UpdateTaskResult | null,
    FormData
  >(async (prev, fd) => {
    const result = await updateTask(prev, fd);
    if ("ok" in result) setEditing(false);
    return result;
  }, null);

  const [deleteState, deleteAction, deleting] = useActionState<
    DeleteTaskResult | null,
    FormData
  >(deleteTask, null);

  const done = task.status === "done";
  const overdue = isOverdue(task);

  if (editing) {
    return (
      <li className="border-border border-b py-3 last:border-b-0">
        <form ref={formRef} action={saveAction}>
          <input type="hidden" name="id" value={task.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium" htmlFor={`t-${task.id}`}>
                Task
              </label>
              <input
                id={`t-${task.id}`}
                name="title"
                required
                defaultValue={task.title}
                className="border-border focus:border-brand-500 mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium" htmlFor={`c-${task.id}`}>
                How often
              </label>
              <select
                id={`c-${task.id}`}
                name="cadence"
                defaultValue={task.cadence}
                className="border-border mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {CADENCE_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium" htmlFor={`d-${task.id}`}>
                Deadline
              </label>
              <input
                id={`d-${task.id}`}
                name="due_date"
                type="date"
                defaultValue={task.due_date ?? ""}
                className="border-border mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium" htmlFor={`o-${task.id}`}>
                Who is responsible
              </label>
              <select
                id={`o-${task.id}`}
                name="owner_id"
                defaultValue={task.owner_id}
                className="border-border mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {saveState && "error" in saveState && (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
              {saveState.error}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-500 hover:bg-brand-600 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="border-border rounded-md border px-3 py-1.5 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="border-border group flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <form action={toggleTaskDone} className="flex">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="done" value={String(!done)} />
        <button
          type="submit"
          aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          className={
            done
              ? "bg-brand-500 border-brand-500 grid size-5 place-items-center rounded border text-white"
              : "border-border hover:border-brand-500 size-5 shrink-0 rounded border transition-colors"
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

      <Link
        href={`/tasks/${task.id}`}
        className={
          done
            ? "text-muted hover:text-brand-700 flex-1 text-sm line-through"
            : "hover:text-brand-700 flex-1 text-sm"
        }
      >
        {task.title}
      </Link>

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

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted hover:text-brand-700 text-xs font-medium"
      >
        Edit
      </button>

      {canDelete &&
        (confirming ? (
          <form action={deleteAction} className="flex items-center gap-1.5">
            <input type="hidden" name="id" value={task.id} />
            <button
              type="submit"
              disabled={deleting}
              className="text-xs font-medium text-red-700 disabled:opacity-60 dark:text-red-300"
            >
              {deleting ? "Deleting…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-muted text-xs font-medium"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-muted text-xs font-medium hover:text-red-700 dark:hover:text-red-300"
          >
            Delete
          </button>
        ))}

      {deleteState && "error" in deleteState && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-300">
          {deleteState.error}
        </span>
      )}
    </li>
  );
}
