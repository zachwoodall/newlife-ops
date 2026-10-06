"use client";

import { useState } from "react";
import { saveNotes } from "./actions";

export function NotesForm({
  taskId,
  notes,
}: {
  taskId: string;
  notes: string | null;
}) {
  const [dirty, setDirty] = useState(false);

  return (
    <form action={saveNotes} onSubmit={() => setDirty(false)}>
      <input type="hidden" name="task_id" value={taskId} />
      <textarea
        name="notes"
        rows={5}
        defaultValue={notes ?? ""}
        onChange={() => setDirty(true)}
        placeholder="What does done look like? Anything the next person needs to know."
        className="border-border focus:border-brand-500 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none"
      />
      <button
        type="submit"
        className={
          dirty
            ? "bg-brand-500 hover:bg-brand-600 mt-2 rounded-md px-3 py-1.5 text-sm font-medium text-white"
            : "border-border text-muted mt-2 rounded-md border px-3 py-1.5 text-sm font-medium"
        }
      >
        {dirty ? "Save notes" : "Saved"}
      </button>
    </form>
  );
}
