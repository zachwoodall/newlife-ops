import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/current-person";
import { listAnnouncements, myDepartments } from "@/lib/announcements-data";
import { PostForm } from "./post-form";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const { items, ready } = await listAnnouncements();
  const departments = ready ? await myDepartments() : [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
      <p className="text-muted mt-1 text-sm">
        Said once, to everyone or to one department, where it stays findable.
      </p>

      {!ready ? (
        <div className="border-brand-200 bg-brand-50 text-brand-900 mt-6 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">Announcements need one more migration</p>
          <p className="mt-1">
            Run{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0012_announcements.sql
            </code>{" "}
            in the Supabase SQL Editor.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <PostForm departments={departments} />
          </div>

          {items.length === 0 ? (
            <p className="border-border text-muted mt-5 rounded-lg border border-dashed p-8 text-center text-sm">
              Nothing posted yet.
            </p>
          ) : (
            <ul className="mt-5 space-y-2">
              {items.map((a) => (
                <li
                  key={a.id}
                  className="border-border bg-surface rounded-lg border px-4 py-3"
                >
                  <div className="flex items-baseline gap-2">
                    <Link
                      href={`/announcements/${a.id}`}
                      className="hover:text-brand-700 font-medium hover:underline"
                    >
                      {a.title}
                    </Link>
                    {a.audience === "department" && (
                      <span className="bg-brand-50 text-brand-700 rounded px-1.5 py-0.5 text-[11px] font-semibold dark:bg-neutral-800 dark:text-neutral-300">
                        {a.department}
                      </span>
                    )}
                  </div>
                  <p className="text-muted mt-0.5 text-xs">
                    {a.authorName} ·{" "}
                    {new Date(a.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    {a.replyCount > 0 &&
                      ` · ${a.replyCount} ${a.replyCount === 1 ? "reply" : "replies"}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
