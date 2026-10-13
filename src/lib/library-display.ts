/**
 * How a library file presents itself. Kept free of imports so it can be
 * tested directly -- the data layer that fetches these rows pulls in the
 * Supabase client, which a unit test has no business loading.
 */

export type LibraryFile = {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string | null;
  cover_url: string | null;
  cover_file_id: string | null;
  kind: "image" | "video" | "document";
  size_bytes: number | null;
  department: string | null;
  folder_id: string | null;
  uploaded_by: string | null;
  created_at: string;
};

/**
 * The picture to show: the cover someone chose, otherwise whatever ImageKit
 * generated. Covers are stored alongside rather than replacing the generated
 * thumbnail, so removing one falls back instead of leaving a blank card.
 */
export function displayImage(file: LibraryFile): string | null {
  return file.cover_url ?? file.thumbnail_url;
}
