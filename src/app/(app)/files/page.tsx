import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/current-person";
import { myDepartments } from "@/lib/announcements-data";
import { loadLibrary } from "@/lib/library-data";
import { LibraryUpload } from "./upload";
import { NewFolder } from "./new-folder";
import { FileCard } from "./file-card";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const library = await loadLibrary(null);

  if (!library) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
        <div className="border-brand-200 bg-brand-50 text-brand-900 mt-6 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <p className="font-semibold">Files need another migration</p>
          <p className="mt-1">
            Run{" "}
            <code className="font-mono text-xs">
              supabase/migrations/0020_library_folders.sql
            </code>{" "}
            in the Supabase SQL Editor.
          </p>
        </div>
      </main>
    );
  }

  const departments = await myDepartments();
  const { folders, files, names } = library;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
      <p className="text-muted mt-1 text-sm">
        Training material, policies and anything else that belongs to the church
        rather than to one task.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <NewFolder departments={departments} />
      </div>

      {folders.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {folders.map((f) => (
            <li key={f.id}>
              <Link
                href={`/files/${f.id}`}
                className="border-border bg-surface hover:border-brand-500 block rounded-lg border px-4 py-3"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-medium">{f.name}</span>
                  {f.department && (
                    <span className="bg-brand-50 text-brand-700 rounded px-1.5 py-0.5 text-[11px] font-semibold dark:bg-neutral-800 dark:text-neutral-300">
                      {f.department}
                    </span>
                  )}
                  <span className="text-muted ml-auto text-xs">
                    {f.fileCount} {f.fileCount === 1 ? "file" : "files"}
                  </span>
                </span>
                {f.description && (
                  <span className="text-muted mt-0.5 block truncate text-sm">
                    {f.description}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">
          Unfiled
          {files.length > 0 && (
            <span className="text-muted ml-2 font-normal">{files.length}</span>
          )}
        </h2>

        <div className="mt-3">
          <LibraryUpload departments={departments} />
        </div>

        {files.length === 0 ? (
          <p className="border-border text-muted mt-4 rounded-lg border border-dashed p-6 text-center text-sm">
            Nothing unfiled.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {files.map((f) => (
              <FileCard
                key={f.id}
                file={f}
                uploaderName={names.get(f.uploaded_by ?? "") ?? "Someone"}
                folders={folders.map((x) => ({ id: x.id, name: x.name }))}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
