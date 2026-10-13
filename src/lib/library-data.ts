import { createClient } from "@/lib/supabase/server";
import type { LibraryFile } from "@/lib/library-display";

export { displayImage } from "@/lib/library-display";
export type { LibraryFile } from "@/lib/library-display";

export type Folder = {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  created_by: string | null;
  fileCount: number;
};

export async function loadLibrary(folderId: string | null) {
  const supabase = await createClient();

  const [foldersRes, filesRes, peopleRes, meRes] = await Promise.all([
    supabase
      .from("library_folders")
      .select("id, name, description, department, created_by")
      .order("name"),
    supabase
      .from("library_files")
      .select(
        "id, name, url, thumbnail_url, cover_url, cover_file_id, kind, size_bytes, department, folder_id, uploaded_by, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("people").select("id, full_name"),
    supabase.from("people").select("id, is_admin").limit(1000),
  ]);

  if (foldersRes.error || filesRes.error) return null;

  const allFiles = (filesRes.data ?? []) as LibraryFile[];
  const counts = new Map<string, number>();
  for (const f of allFiles) {
    if (f.folder_id) counts.set(f.folder_id, (counts.get(f.folder_id) ?? 0) + 1);
  }

  const folders: Folder[] = (foldersRes.data ?? []).map((f) => ({
    id: f.id as string,
    name: f.name as string,
    description: (f.description as string | null) ?? null,
    department: (f.department as string | null) ?? null,
    created_by: (f.created_by as string | null) ?? null,
    fileCount: counts.get(f.id as string) ?? 0,
  }));

  return {
    folders,
    files: allFiles.filter((f) => (f.folder_id ?? null) === folderId),
    unfiledCount: allFiles.filter((f) => !f.folder_id).length,
    names: new Map((peopleRes.data ?? []).map((p) => [p.id as string, p.full_name as string])),
    adminIds: new Set(
      (meRes.data ?? []).filter((p) => p.is_admin).map((p) => p.id as string),
    ),
  };
}
