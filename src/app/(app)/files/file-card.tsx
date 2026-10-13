import { displayImage, type LibraryFile } from "@/lib/library-display";
import { removeLibraryFile, moveFile, removeCover } from "./actions";
import { CoverUpload } from "./cover-upload";

export function FileCard({
  file,
  uploaderName,
  folders,
}: {
  file: LibraryFile;
  uploaderName: string;
  folders: { id: string; name: string }[];
}) {
  const image = displayImage(file);

  return (
    <li className="border-border bg-surface overflow-hidden rounded-lg border">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="aspect-video w-full bg-neutral-100 object-cover dark:bg-neutral-800"
        />
      ) : (
        <div className="text-muted grid aspect-video w-full place-items-center bg-neutral-50 text-xs dark:bg-neutral-900">
          No cover
        </div>
      )}

      <div className="px-3 py-2.5">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand-700 block truncate text-sm font-medium"
        >
          {file.name}
        </a>
        <p className="text-muted mt-0.5 text-xs">
          {uploaderName}
          {file.size_bytes
            ? ` · ${Math.max(1, Math.round(file.size_bytes / 1024))} KB`
            : ""}
          {file.department ? ` · ${file.department} only` : ""}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <CoverUpload fileId={file.id} hasCover={Boolean(file.cover_url)} />

          {file.cover_url && (
            <form action={removeCover}>
              <input type="hidden" name="file_id" value={file.id} />
              <button
                type="submit"
                className="text-muted text-xs font-medium hover:text-red-700 dark:hover:text-red-300"
              >
                Remove cover
              </button>
            </form>
          )}

          {folders.length > 0 && (
            <form action={moveFile} className="flex items-center gap-1">
              <input type="hidden" name="file_id" value={file.id} />
              <label className="sr-only" htmlFor={`move-${file.id}`}>
                Move {file.name} to a folder
              </label>
              <select
                id={`move-${file.id}`}
                name="folder_id"
                defaultValue={file.folder_id ?? ""}
                className="border-border bg-surface rounded border px-1.5 py-0.5 text-xs"
              >
                <option value="">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="text-muted hover:text-brand-700 text-xs font-medium">
                Move
              </button>
            </form>
          )}

          <form action={removeLibraryFile} className="ml-auto">
            <input type="hidden" name="id" value={file.id} />
            <button
              type="submit"
              aria-label={`Remove ${file.name}`}
              className="text-muted text-xs font-medium hover:text-red-700 dark:hover:text-red-300"
            >
              Remove
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}
