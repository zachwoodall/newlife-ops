"use client";

import { useState } from "react";
import { renameChannel, addMember, removeMember } from "../../channel-actions";

type Person = { id: string; name: string };

export function ManageChannel({
  channelId,
  name,
  description,
  members,
  notMembers,
  canManage,
  meId,
}: {
  channelId: string;
  name: string;
  description: string | null;
  members: Person[];
  notMembers: Person[];
  canManage: boolean;
  meId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-border mt-4 rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="hover:bg-brand-50 flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm dark:hover:bg-neutral-800"
      >
        <span className="font-medium">
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
        <span className="text-muted truncate">
          {members.map((m) => m.name).join(", ")}
        </span>
        <span className="text-muted ml-auto shrink-0 text-xs">
          {open ? "Hide" : "Manage"}
        </span>
      </button>

      {open && (
        <div className="border-border border-t p-4">
          {canManage && (
            <form action={renameChannel} className="mb-4">
              <input type="hidden" name="channel_id" value={channelId} />
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
                placeholder="What it is for (optional)"
                className="border-border bg-surface mt-2 w-full rounded-md border px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="border-border hover:border-brand-500 mt-2 rounded-md border px-3 py-1.5 text-sm font-medium"
              >
                Save
              </button>
            </form>
          )}

          <p className="text-muted text-xs font-semibold tracking-widest uppercase">
            Members
          </p>
          <ul className="mt-1.5 space-y-1">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span>{m.name}</span>
                {(canManage || m.id === meId) && (
                  <form action={removeMember} className="ml-auto">
                    <input type="hidden" name="channel_id" value={channelId} />
                    <input type="hidden" name="person_id" value={m.id} />
                    <button
                      type="submit"
                      aria-label={m.id === meId ? "Leave this channel" : `Remove ${m.name}`}
                      className="text-muted text-xs font-medium hover:text-red-700 dark:hover:text-red-300"
                    >
                      {m.id === meId ? "Leave" : "Remove"}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>

          {notMembers.length > 0 && (
            <>
              <p className="text-muted mt-4 text-xs font-semibold tracking-widest uppercase">
                Add someone
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {notMembers.map((p) => (
                  <form key={p.id} action={addMember}>
                    <input type="hidden" name="channel_id" value={channelId} />
                    <input type="hidden" name="person_id" value={p.id} />
                    <button
                      type="submit"
                      className="border-border hover:border-brand-500 hover:text-brand-700 rounded-full border px-3 py-1 text-sm"
                    >
                      + {p.name}
                    </button>
                  </form>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
