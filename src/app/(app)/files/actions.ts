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
  revalidatePath("/files");
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
    .select("imagekit_file_id")
    .maybeSingle();

  if (removed?.imagekit_file_id) {
    const result = await deleteFromImageKit(removed.imagekit_file_id);
    if (!result.ok) {
      console.warn(
        `Removed library file ${id} but its ImageKit copy remains: ${result.reason}`,
      );
    }
  }

  revalidatePath("/files");
}
