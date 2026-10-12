import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/current-person";
import { search } from "@/lib/search-data";
import { isUsableQuery, type SearchKind } from "@/lib/search";

export const dynamic = "force-dynamic";

const LABEL: Record<SearchKind, string> = {
  task: "Task",
  comment: "Comment",
  announcement: "Announcement",
  message: "Message",
  file: "File",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const { q = "" } = await searchParams;
  const term = q.trim();
  const hits = isUsableQuery(term) ? await search(term) : [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>

      <form action="/search" className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={term}
          autoFocus
          placeholder="Tasks, comments, announcements, messages, files…"
          className="border-border bg-surface focus:border-brand-500 focus:ring-brand-500/30 flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
        <button
          type="submit"
          className="bg-brand-500 hover:bg-brand-600 rounded-md px-4 py-2 text-sm font-medium text-white"
        >
          Search
        </button>
      </form>

      <p className="text-muted mt-2 text-xs">
        Only what you already have access to. Search cannot surface anything you
        could not open directly.
      </p>

      {term && !isUsableQuery(term) && (
        <p className="text-muted mt-6 text-sm">Type at least two characters.</p>
      )}

      {isUsableQuery(term) && (
        <>
          <p className="text-muted mt-6 text-xs font-semibold tracking-widest uppercase">
            {hits.length} {hits.length === 1 ? "result" : "results"}
          </p>

          {hits.length === 0 ? (
            <p className="border-border text-muted mt-2 rounded-lg border border-dashed p-8 text-center text-sm">
              Nothing matched &ldquo;{term}&rdquo;.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {hits.map((h) => (
                <li
                  key={`${h.kind}-${h.id}`}
                  className="border-border bg-surface rounded-lg border px-3 py-2.5"
                >
                  <p className="text-muted text-xs font-semibold tracking-widest uppercase">
                    {LABEL[h.kind]}
                  </p>
                  <Link
                    href={h.url}
                    className="hover:text-brand-700 mt-0.5 block text-sm font-medium hover:underline"
                  >
                    {h.title}
                  </Link>
                  {h.excerpt && (
                    <p className="text-muted mt-0.5 text-sm">{h.excerpt}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
