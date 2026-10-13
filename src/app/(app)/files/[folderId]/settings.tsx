"use client";

import { useState } from "react";
import { renameFolder, deleteFolder } from "../actions";

export function FolderSettings({
  folderId,
  name,
  description,
  fileCount,
}: {
  folderId: string;
  name: string;
  description: string | null;
  fileCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted hover:text-brand-700 mt-2 text-xs font-medium"
      >
        Folder settings
      </button>
    );
  }

  return (
    <div className="border-border mt-3 rounded-lg border p-4">
      <form action={renameFolder}>
        <input type="hidden" name="folder_id" value={folderId} />
        <label className="text-muted text-xs font-semibold tracking-widest uppercase">
          Name
        </label>
        <input
          name="name"
          defaultValue={name}
          required
          maxLength={80}
          className="border-border bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm font-medium"
        />
        <input
          name="description"
          defaultValue={description ?? ""}
          maxLength={200}
          placeholder="What goes in it (optional)"
          className="border-border bg-surface mt-2 w-full rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="border-border hover:border-brand-500 mt-2 rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          Save
        </button>
      </form>

      <div className="border-border mt-4 border-t pt-3">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-muted text-xs font-medium hover:text-red-700 dark:hover:text-red-300"
          >
            Delete folder
          </button>
        ) : (
          <form action={deleteFolder}>
            <input type="hidden" name="folder_id" value={folderId} />
            <p className="text-sm">
              Delete this folder?{" "}
              {fileCount > 0 ? (
                <>
                  The {fileCount} {fileCount === 1 ? "file" : "files"} inside will
                  not be deleted &mdash; they move back to Unfiled.
                </>
              ) : (
                <>It is empty.</>
              )}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white"
              >
                Delete folder
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-muted text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-muted mt-3 block text-xs font-medium"
      >
        Close
      </button>
    </div>
  );
}
