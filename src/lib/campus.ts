import { cookies } from "next/headers";

export const CAMPUS_COOKIE = "campus";

/** The campus the user last chose, when they still have access to it. */
export async function getSelectedCampus(available: string[]): Promise<string> {
  const store = await cookies();
  const saved = store.get(CAMPUS_COOKIE)?.value;
  if (saved && available.includes(saved)) return saved;
  return available[0] ?? "";
}
