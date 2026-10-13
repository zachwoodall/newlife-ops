import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/current-person";
import { myDepartments } from "@/lib/announcements-data";
import { loadLibrary } from "@/lib/library-data";
import { LibraryUpload } from "../upload";
import { FileCard } from "../file-card";
import { FolderSettings } from "./settings";

export const dynamic = "force-dynamic";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const current = await getCurrentPerson();
  if (!current?.person) redirect("/login");

  const library = await loadLibrary(folderId);
  if (!library) notFound();

  const folder = library.folders.find((f) => f.id === folderId);
  if (!folder) notFound();

  const departments = await myDepartments();
  const { files, names, folders, adminIds } = library;
  const canManage =
    folder.created_by === current.person.id || adminIds.has(current.person.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/files" className="text-muted hover:text-brand-700 text-sm">
        &larr; Files
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{folder.name}</h1>
        {folder.department && (
          <span className="bg-brand-50 text-brand-700 rounded px-1.5 py-0.5 text-[11px] font-semibold dark:bg-neutral-800 dark:text-neutral-300">
            {folder.department} only
          </span>
        )}
      </div>
      {folder.description && (
        <p className="text-muted mt-1 text-sm">{folder.description}</p>
      )}

      {canManage && (
        <FolderSettings
          folderId={folder.id}
          name={folder.name}
          description={folder.description}
          fileCount={folder.fileCount}
        />
      )}

      <div className="mt-5">
        <LibraryUpload departments={departments} folderId={folder.id} />
      </div>

      {files.length === 0 ? (
        <p className="border-border text-muted mt-5 rounded-lg border border-dashed p-8 text-center text-sm">
          Nothing in this folder yet.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
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
    </main>
  );
}
