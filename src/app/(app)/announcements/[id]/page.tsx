import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/current-person";
import { getAnnouncement } from "@/lib/announcements-data";
import { withdrawAnnouncement, removeReply } from "../actions";
import { ReplyForm } from "./reply-form";

export const dynamic = "force-dynamic";

export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const data = await getAnnouncement(id);
  if (!data) notFound();

  const { announcement: a, replies } = data;
  const mine = a.author_id === current.person.id;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/announcements" className="text-muted hover:text-brand-700 text-sm">
        &larr; Announcements
      </Link>

      <div className="mt-3 flex items-start gap-3">
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">{a.title}</h1>
        {mine && (
          <form action={withdrawAnnouncement}>
            <input type="hidden" name="id" value={a.id} />
            <button
              type="submit"
              className="text-muted shrink-0 text-xs font-medium hover:text-red-700 dark:hover:text-red-300"
            >
              Withdraw
            </button>
          </form>
        )}
      </div>

      <p className="text-muted mt-1 text-sm">
        {a.authorName} ·{" "}
        {new Date(a.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
        {a.audience === "department" ? ` · ${a.department} only` : " · Everyone"}
      </p>

      <div className="border-border bg-surface mt-4 rounded-lg border px-4 py-3">
        <p className="text-sm whitespace-pre-wrap">{a.body}</p>
      </div>

      <h2 className="text-muted mt-8 text-sm font-semibold tracking-widest uppercase">
        Replies
        {replies.length > 0 && <span className="ml-2 font-normal">{replies.length}</span>}
      </h2>

      {replies.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {replies.map((r) => (
            <li
              key={r.id}
              className="border-border bg-surface group rounded-lg border px-3 py-2.5"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{r.authorName}</span>
                <span className="text-muted text-xs">
                  {new Date(r.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <form action={removeReply} className="ml-auto">
                  <input type="hidden" name="announcement_id" value={a.id} />
                  <input type="hidden" name="reply_id" value={r.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${r.authorName}'s reply`}
                    className="text-muted text-xs opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-red-700 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </form>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{r.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted mt-2 text-sm">No replies yet.</p>
      )}

      <ReplyForm announcementId={a.id} />
    </main>
  );
}
