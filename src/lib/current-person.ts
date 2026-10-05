import { createClient } from "@/lib/supabase/server";

export type CurrentPerson = {
  email: string | null;
  /** Matched row from `people`, or null if the migration has not been run
   *  yet or no row carries this email. */
  person: { key: string; full_name: string } | null;
  /** False when the `people` table is not reachable — i.e. the migration
   *  has not been applied to this project yet. */
  dbReady: boolean;
};

/** The signed-in user, joined to their row in `people` when one exists. */
export async function getCurrentPerson(): Promise<CurrentPerson | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("people")
    .select("key, full_name")
    .eq("email", user.email ?? "")
    .maybeSingle();

  return {
    email: user.email ?? null,
    person: error ? null : data,
    dbReady: !error,
  };
}

/** First name for greetings, falling back to the email local part. */
export function displayName(current: CurrentPerson): string {
  if (current.person) return current.person.full_name.split(" ")[0];
  return current.email?.split("@")[0] ?? "there";
}
