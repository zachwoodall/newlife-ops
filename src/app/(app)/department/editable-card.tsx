"use client";

import { useActionState, useState } from "react";
import {
  updatePosition,
  deletePosition,
  assignHolder,
  removeHolder,
  type OrgResult,
} from "./actions";

export type CardPosition = {
  id: string;
  title: string;
  department: string;
  campusName: string | null;
  holders: { id: string; name: string }[];
};

export function EditableCard({
  position,
  allPeople,
  reportsToOptions,
  reportsToId,
}: {
  position: CardPosition;
  allPeople: { id: string; name: string }[];
  /** Roles this person is allowed to move the card under. */
  reportsToOptions: { id: string; label: string }[];
  reportsToId: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState("");

  const [saveState, save, saving] = useActionState<OrgResult, FormData>(
    async (prev, fd) => {
      const r = await updatePosition(prev, fd);
      if (r && "ok" in r) setEditing(false);
      return r;
    },
    null,
  );

  const [addState, add, adding] = useActionState<OrgResult, FormData>(
    assignHolder,
    null,
  );

  const open = position.holders.length === 0;
  const free = allPeople.filter((p) => !position.holders.some((h) => h.id === p.id));

  if (!editing) {
    return (
      <div className="border-border bg-surface overflow-hidden rounded-lg border">
        <div className="bg-brand-500 flex items-center gap-2 px-3 py-1.5">
          <p className="flex-1 text-xs font-semibold tracking-wider text-white uppercase">
            {position.title}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] font-medium text-white/80 hover:text-white"
          >
            Edit
          </button>
        </div>
        <div className="px-3 py-3">
          {open ? (
            <p className="text-muted text-sm italic">Open position</p>
          ) : (
            <p className="text-sm font-medium">
              {position.holders.map((h) => h.name).join(" & ")}
            </p>
          )}
          <p className="text-muted mt-0.5 text-xs">
            {position.department}
            {position.campusName && (
              <span className="border-border ml-1.5 rounded border px-1 py-0.5 text-[10px] tracking-wide uppercase">
                {position.campusName}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-brand-500 bg-surface ring-brand-500/20 rounded-lg border p-3 ring-2">
      <form action={save} className="space-y-2">
        <input type="hidden" name="position_id" value={position.id} />
        <div>
          <label className="block text-[11px] font-medium" htmlFor={`t-${position.id}`}>
            Role title
          </label>
          <input
            id={`t-${position.id}`}
            name="title"
            defaultValue={position.title}
            required
            className="border-border mt-0.5 w-full rounded-md border px-2 py-1.5 text-sm outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium" htmlFor={`d-${position.id}`}>
            Department
          </label>
          <input
            id={`d-${position.id}`}
            name="department"
            defaultValue={position.department}
            required
            className="border-border mt-0.5 w-full rounded-md border px-2 py-1.5 text-sm outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium" htmlFor={`r-${position.id}`}>
            Reports to
          </label>
          <select
            id={`r-${position.id}`}
            name="reports_to_id"
            defaultValue={reportsToId ?? ""}
            className="border-border mt-0.5 w-full rounded-md border px-2 py-1.5 text-sm outline-none"
          >
            {reportsToOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {saveState && "error" in saveState && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-300">
            {saveState.error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-500 hover:bg-brand-600 rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="border-border rounded-md border px-3 py-1.5 text-xs font-medium"
          >
            Done
          </button>
        </div>
      </form>

      <div className="border-border mt-3 border-t pt-3">
        <p className="text-muted text-[11px] font-semibold tracking-wider uppercase">
          Who holds this role
        </p>
        {position.holders.length === 0 ? (
          <p className="text-muted mt-1 text-xs italic">Nobody yet</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {position.holders.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{h.name}</span>
                <form action={removeHolder}>
                  <input type="hidden" name="position_id" value={position.id} />
                  <input type="hidden" name="person_id" value={h.id} />
                  <button
                    type="submit"
                    className="text-muted text-[11px] hover:text-red-700 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={add} className="mt-2 space-y-2">
          <input type="hidden" name="position_id" value={position.id} />
          <select
            name="person_id"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="border-border w-full rounded-md border px-2 py-1.5 text-sm outline-none"
          >
            <option value="">Add someone…</option>
            {free.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="__new__">+ Someone not listed</option>
          </select>

          {picked === "__new__" && (
            <div className="space-y-2">
              <input
                name="new_name"
                placeholder="Full name"
                className="border-border w-full rounded-md border px-2 py-1.5 text-sm outline-none"
              />
              <input
                name="new_email"
                type="email"
                placeholder="Email (optional, needed to sign in)"
                className="border-border w-full rounded-md border px-2 py-1.5 text-sm outline-none"
              />
            </div>
          )}

          {addState && "error" in addState && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">
              {addState.error}
            </p>
          )}

          {picked && (
            <button
              type="submit"
              disabled={adding}
              className="border-border hover:bg-brand-50 w-full rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-60 dark:hover:bg-neutral-800"
            >
              {adding ? "Adding…" : "Add to role"}
            </button>
          )}
        </form>
      </div>

      <form action={deletePosition} className="border-border mt-3 border-t pt-3">
        <input type="hidden" name="position_id" value={position.id} />
        <button
          type="submit"
          className="text-muted text-[11px] hover:text-red-700 dark:hover:text-red-300"
        >
          Delete this role
        </button>
        <span className="text-muted ml-2 text-[11px]">
          Anyone reporting to it moves up a level.
        </span>
      </form>
    </div>
  );
}
