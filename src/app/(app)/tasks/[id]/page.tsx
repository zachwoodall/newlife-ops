import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentPerson } from "@/lib/current-person";
import { loadOrg } from "@/lib/org-data";
import { assignableBy } from "@/lib/org";
import { loadBoard } from "@/lib/board-data";
import { CADENCE_LABEL, formatDue, isOverdue } from "@/lib/tasks";
import { createClient } from "@/lib/supabase/server";
import {
  setStatus,
  addChecklistItem,
  toggleChecklistItem,
  removeChecklistItem,
  removeAssignee,
  removeFile,
  removeComment,
} from "./actions";
import { stopRepeating } from "../actions";
import { NotesForm } from "./notes-form";
import { FileUpload } from "./file-upload";
import { CommentForm } from "./comment-form";
import { Reactions } from "./reactions";
import { TagForm } from "./tag-form";

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const current = await getCurrentPerson();
  if (!current?.person) return null;

  const board = await loadBoard(id);
  if (!board) notFound();

  const {
    task,
    ownerName,
    assignees,
    checklist,
    checklistReady,
    files,
    filesReady,
    comments,
    commentsReady,
  } = board;
  const canManage =
    task.owner_id === current.person.id || task.created_by === current.person.id;

  const org = await loadOrg();
  const supabase = await createClient();
  const { data: peopleRows } = await supabase.from("people").select("id, key, full_name");
  const idByKey = new Map((peopleRows ?? []).map((p) => [p.key as string, p.id as string]));

  const taggable = org
    ? assignableBy(org, current.person.key)
        .map((p) => ({ id: idByKey.get(p.key) ?? "", name: p.full_name }))
        .filter((p) => p.id && !assignees.some((a) => a.person_id === p.id))
    : [];

  const ticked = checklist.filter((c) => c.done).length;
  const overdue = isOverdue(task);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link href="/tasks" className="text-muted hover:text-brand-700 text-sm">
        ← Task Directory
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{task.title}</h1>

      <div className="text-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span>{CADENCE_LABEL[task.cadence]}</span>
        <span aria-hidden>·</span>
        <span className={overdue ? "font-medium text-red-700 dark:text-red-300" : ""}>
          {overdue && "Overdue · "}
          {formatDue(task.due_date)}
        </span>
        <span aria-hidden>·</span>
        <span>Owned by {ownerName}</span>
        {task.series_id && (
          <>
            <span aria-hidden>·</span>
            <span className="text-brand-700 dark:text-brand-300 font-medium">
              Repeats {CADENCE_LABEL[task.cadence].toLowerCase()}
            </span>
          </>
        )}
      </div>

      {task.series_id && task.created_by === current.person.id && (
        <form action={stopRepeating} className="mt-3">
          <input type="hidden" name="series_id" value={task.series_id} />
          <button
            type="submit"
            className="border-border text-muted rounded-md border px-3 py-1.5 text-xs font-medium hover:text-red-700 dark:hover:text-red-300"
          >
            Stop repeating
          </button>
          <span className="text-muted ml-2 text-xs">
            Keeps this one and anything already done; removes future copies.
          </span>
        </form>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">Status</h2>
        <div className="mt-2 flex gap-2">
          {STATUSES.map((s) => (
            <form action={setStatus} key={s.value}>
              <input type="hidden" name="task_id" value={task.id} />
              <input type="hidden" name="status" value={s.value} />
              <button
                type="submit"
                aria-pressed={task.status === s.value}
                className={
                  task.status === s.value
                    ? "bg-brand-500 rounded-md px-3 py-1.5 text-sm font-medium text-white"
                    : "border-border text-muted hover:text-brand-700 rounded-md border px-3 py-1.5 text-sm font-medium"
                }
              >
                {s.label}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">Notes</h2>
        <div className="mt-2">
          <NotesForm taskId={task.id} notes={task.notes} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">
          Checklist
          {checklist.length > 0 && (
            <span className="text-muted ml-2 font-normal">
              {ticked} of {checklist.length}
            </span>
          )}
        </h2>

        {checklist.length > 0 && (
          <ul className="border-border bg-surface mt-2 rounded-lg border px-4">
            {checklist.map((item) => (
              <li
                key={item.id}
                className="border-border flex items-center gap-3 border-b py-2.5 last:border-b-0"
              >
                <form action={toggleChecklistItem} className="flex">
                  <input type="hidden" name="task_id" value={task.id} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <input type="hidden" name="done" value={String(!item.done)} />
                  <button
                    type="submit"
                    aria-label={`Mark "${item.label}" ${item.done ? "not done" : "done"}`}
                    className={
                      item.done
                        ? "bg-brand-500 border-brand-500 grid size-5 place-items-center rounded border text-white"
                        : "border-border hover:border-brand-500 size-5 shrink-0 rounded border"
                    }
                  >
                    {item.done && (
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
                <span
                  className={item.done ? "text-muted flex-1 text-sm line-through" : "flex-1 text-sm"}
                >
                  {item.label}
                </span>
                {canManage && (
                  <form action={removeChecklistItem}>
                    <input type="hidden" name="task_id" value={task.id} />
                    <input type="hidden" name="item_id" value={item.id} />
                    <button
                      type="submit"
                      className="text-muted text-xs hover:text-red-700 dark:hover:text-red-300"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {!checklistReady && (
          <div className="border-brand-200 bg-brand-50 text-brand-900 mt-2 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
            <p className="font-semibold">Checklist needs one more migration</p>
            <p className="mt-1">
              Run{" "}
              <code className="font-mono text-xs">
                supabase/migrations/0004_task_board.sql
              </code>{" "}
              in the Supabase SQL Editor. Everything else on this board works.
            </p>
          </div>
        )}

        {canManage && checklistReady && (
          <form action={addChecklistItem} className="mt-3 flex gap-2">
            <input type="hidden" name="task_id" value={task.id} />
            <input
              name="label"
              required
              placeholder="Add a step"
              className="border-border focus:border-brand-500 flex-1 rounded-md border px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="border-border hover:bg-brand-50 rounded-md border px-3 py-2 text-sm font-medium dark:hover:bg-neutral-800"
            >
              Add
            </button>
          </form>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">
          Assigned roles
        </h2>

        <ul className="mt-2 space-y-2">
          <li className="border-border bg-surface flex items-center gap-3 rounded-lg border px-4 py-2.5">
            <span className="flex-1 text-sm font-medium">{ownerName}</span>
            <span className="text-muted text-xs tracking-wide uppercase">Responsible</span>
          </li>
          {assignees.map((a) => (
            <li
              key={a.person_id}
              className="border-border bg-surface flex items-center gap-3 rounded-lg border px-4 py-2.5"
            >
              <span className="flex-1 text-sm">{a.full_name}</span>
              <span className="text-muted text-xs tracking-wide uppercase">
                {a.role_label ?? "Helping"}
              </span>
              {canManage && (
                <form action={removeAssignee}>
                  <input type="hidden" name="task_id" value={task.id} />
                  <input type="hidden" name="person_id" value={a.person_id} />
                  <button
                    type="submit"
                    className="text-muted text-xs hover:text-red-700 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {canManage && (
          <div className="mt-4">
            <TagForm taskId={task.id} people={taggable} />
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">
          Discussion
          {comments.length > 0 && (
            <span className="text-muted ml-2 font-normal">{comments.length}</span>
          )}
        </h2>

        {!commentsReady ? (
          <div className="border-brand-200 bg-brand-50 text-brand-900 mt-2 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
            <p className="font-semibold">Discussion needs one more migration</p>
            <p className="mt-1">
              Run{" "}
              <code className="font-mono text-xs">
                supabase/migrations/0010_task_comments.sql
              </code>{" "}
              in the Supabase SQL Editor.
            </p>
          </div>
        ) : (
          <>
            {comments.length > 0 ? (
              <ul className="mt-2 space-y-2.5">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className="border-border bg-surface group rounded-lg border px-3 py-2.5"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{c.authorName}</span>
                      <span className="text-muted text-xs">
                        {new Date(c.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {c.edited_at && " · edited"}
                      </span>
                      <form action={removeComment} className="ml-auto">
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="comment_id" value={c.id} />
                        <button
                          type="submit"
                          aria-label={`Delete ${c.authorName}'s comment`}
                          className="text-muted text-xs opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-red-700 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                    <Reactions
                      commentId={c.id}
                      taskId={task.id}
                      summary={c.reactions}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-2 text-sm">
                No discussion yet. Questions and decisions about this task belong
                here, so they stay with the work.
              </p>
            )}

            <CommentForm taskId={task.id} />
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">
          Files
          {files.length > 0 && (
            <span className="text-muted ml-2 font-normal">{files.length}</span>
          )}
        </h2>

        {!filesReady ? (
          <div className="border-brand-200 bg-brand-50 text-brand-900 mt-2 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
            <p className="font-semibold">Files need one more migration</p>
            <p className="mt-1">
              Run{" "}
              <code className="font-mono text-xs">
                supabase/migrations/0008_task_files.sql
              </code>{" "}
              in the Supabase SQL Editor.
            </p>
          </div>
        ) : (
          <>
            {files.length > 0 && (
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="border-border bg-surface overflow-hidden rounded-lg border"
                  >
                    {f.kind === "video" ? (
                      <video
                        src={f.url}
                        controls
                        preload="metadata"
                        poster={f.thumbnail_url ?? undefined}
                        className="aspect-video w-full bg-black"
                      />
                    ) : f.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.thumbnail_url ?? f.url}
                        alt={f.name}
                        className="aspect-video w-full bg-neutral-100 object-cover dark:bg-neutral-800"
                      />
                    ) : null}

                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-brand-700 block truncate text-sm font-medium"
                        >
                          {f.name}
                        </a>
                        <p className="text-muted mt-0.5 text-xs">
                          {f.uploaderName}
                          {f.size_bytes
                            ? ` · ${Math.max(1, Math.round(f.size_bytes / 1024))} KB`
                            : ""}
                        </p>
                      </div>
                      <form action={removeFile}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="file_id" value={f.id} />
                        <button
                          type="submit"
                          aria-label={`Remove ${f.name}`}
                          className="text-muted text-xs hover:text-red-700 dark:hover:text-red-300"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3">
              <FileUpload taskId={task.id} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
