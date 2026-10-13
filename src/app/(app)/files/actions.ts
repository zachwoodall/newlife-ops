"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
import { deleteFromImageKit } from "@/lib/imagekit";

export type LibraryRecord = {
  imagekit_file_id: string;
  name: string;
  url: string;
  thumbnail_url: string | null;
  kind: "image" | "video" | "document";
  size_bytes: number | null;
  department: string | null;
  folder_id?: string | null;
};

export async function recordLibraryFile(file: LibraryRecord) {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("library_files").insert({
    ...file,
    uploaded_by: current.person.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/files", "layout");
  return { ok: true as const };
}

export async function removeLibraryFile(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();

  // Same ordering as task files: the row first, so RLS decides whether this
  // person may remove it, and only a returned row authorises deleting bytes.
  const { data: removed } = await supabase
    .from("library_files")
    .delete()
    .eq("id", id)
    .select("imagekit_file_id, cover_file_id")
    .maybeSingle();

  if (removed?.imagekit_file_id) {
    const result = await deleteFromImageKit(removed.imagekit_file_id);
    if (!result.ok) {
      console.warn(
        `Removed library file ${id} but its ImageKit copy remains: ${result.reason}`,
      );
    }
  }

  // A custom cover is a second stored file; it goes with the thing it covers.
  if (removed?.cover_file_id) {
    await deleteFromImageKit(removed.cover_file_id as string);
  }

  revalidatePath("/files");
}

export type FolderResult = { error: string } | { ok: true; id?: string };

export async function createFolder(
  _prev: FolderResult | null,
  formData: FormData,
): Promise<FolderResult> {
  const current = await getCurrentPerson();
  if (!current?.person) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the folder a name." };

  const description = String(formData.get("description") ?? "").trim() || null;
  const department = String(formData.get("department") ?? "").trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("library_folders")
    .insert({ name, description, department, created_by: current.person.id })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  revalidatePath("/files");
  return { ok: true, id: data?.id as string };
}

export async function renameFolder(formData: FormData) {
  const id = String(formData.get("folder_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const description = String(formData.get("description") ?? "").trim() || null;

  const supabase = await createClient();
  await supabase.from("library_folders").update({ name, description }).eq("id", id);
  revalidatePath("/files");
  revalidatePath(`/files/${id}`);
}

/** Removing a folder leaves its files; the database sets folder_id to null. */
export async function deleteFolder(formData: FormData) {
  const id = String(formData.get("folder_id") ?? "");
  const supabase = await createClient();
  await supabase.from("library_folders").delete().eq("id", id);
  revalidatePath("/files");
}

export async function moveFile(formData: FormData) {
  const fileId = String(formData.get("file_id") ?? "");
  const raw = String(formData.get("folder_id") ?? "");
  const folderId = raw === "" ? null : raw;

  const supabase = await createClient();
  await supabase.from("library_files").update({ folder_id: folderId }).eq("id", fileId);
  revalidatePath("/files", "layout");
}

/** Records a cover image that the browser has already pushed to ImageKit. */
export async function setCover(
  fileId: string,
  cover: { url: string; fileId: string },
) {
  const supabase = await createClient();

  // Replace rather than accumulate: drop the previous cover's bytes.
  const { data: existing } = await supabase
    .from("library_files")
    .select("cover_file_id")
    .eq("id", fileId)
    .maybeSingle();

  const { error } = await supabase
    .from("library_files")
    .update({ cover_url: cover.url, cover_file_id: cover.fileId })
    .eq("id", fileId);

  if (error) return { error: error.message };

  if (existing?.cover_file_id) {
    await deleteFromImageKit(existing.cover_file_id as string);
  }

  revalidatePath("/files", "layout");
  return { ok: true as const };
}

export async function removeCover(formData: FormData) {
  const fileId = String(formData.get("file_id") ?? "");
  const supabase = await createClient();

  const { data: removed } = await supabase
    .from("library_files")
    .update({ cover_url: null, cover_file_id: null })
    .eq("id", fileId)
    .select("cover_file_id")
    .maybeSingle();

  // The row is updated first, so RLS has decided; only then touch storage.
  if (removed?.cover_file_id) {
    await deleteFromImageKit(removed.cover_file_id as string);
  }

  revalidatePath("/files", "layout");
}
