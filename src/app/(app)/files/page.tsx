import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
import { myDepartments } from "@/lib/announcements-data";
import { LibraryUpload } from "./upload";
import { removeLibraryFile } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string | null;
  kind: "image" | "video" | "document";
  size_bytes: number | null;
  department: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export default async function FilesPage() {
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("library_files")
    .select("id, name, url, thumbnail_url, kind, size_bytes, department, uploaded_by, created_at")
    .order("created_at", { ascending: false });

  const { data: people } = await supabase.from("people").select("id, full_name");
  const names = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]));
  const files = (data ?? []) as Row[];
  const departments = error ? [] : await myDepartments();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
      <p className="text-muted mt-1 text-sm">
        Things that belong to the church rather than to one task &mdash; logos,
        stage plots, policies.
      </p>

      {error ? (
        <div className="border-brand-200 bg-brand-50 text-brand-900 mt-6 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">The files area needs one more migration</p>
          <p className="mt-1">
            Run{" "}
            <code className="font-mono text-xs">supabase/migrations/0015_library.sql</code>{" "}
            in the Supabase SQL Editor.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <LibraryUpload departments={departments} />
          </div>

          {files.length === 0 ? (
            <p className="border-border text-muted mt-5 rounded-lg border border-dashed p-8 text-center text-sm">
              Nothing here yet.
            </p>
          ) : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
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
                        {names.get(f.uploaded_by ?? "") ?? "Someone"}
                        {f.size_bytes
                          ? ` · ${Math.max(1, Math.round(f.size_bytes / 1024))} KB`
                          : ""}
                        {f.department ? ` · ${f.department} only` : ""}
                      </p>
                    </div>
                    <form action={removeLibraryFile}>
                      <input type="hidden" name="id" value={f.id} />
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
        </>
      )}
    </main>
  );
}
