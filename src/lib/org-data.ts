import { createClient } from "@/lib/supabase/server";
import type { OrgData } from "@/lib/org";

type Row = Record<string, unknown>;

/**
 * Loads the whole org from Supabase into the shape src/lib/org.ts expects.
 *
 * The org is 22 positions and 15 people, so fetching it whole and walking the
 * tree in memory is cheaper and far simpler than recursive SQL per request —
 * and it reuses the tree logic that is already under test.
 */
export async function loadOrg(): Promise<OrgData | null> {
  const supabase = await createClient();

  const [campuses, people, positions, holders] = await Promise.all([
    supabase.from("campuses").select("id, key, name, is_primary"),
    supabase.from("people").select("id, key, full_name, email"),
    supabase
      .from("positions")
      .select("id, key, title, department, campus_id, reports_to_id, campus_lead"),
    supabase.from("position_holders").select("position_id, person_id"),
  ]);

  if (campuses.error || people.error || positions.error || holders.error) {
    return null;
  }
  if (!positions.data?.length) return null;

  const campusKey = new Map<string, string>();
  for (const c of campuses.data as Row[]) {
    campusKey.set(c.id as string, c.key as string);
  }

  const positionKey = new Map<string, string>();
  for (const p of positions.data as Row[]) {
    positionKey.set(p.id as string, p.key as string);
  }

  const personKey = new Map<string, string>();
  for (const p of people.data as Row[]) {
    personKey.set(p.id as string, p.key as string);
  }

  const holdersByPosition = new Map<string, string[]>();
  for (const h of holders.data as Row[]) {
    const pos = positionKey.get(h.position_id as string);
    const per = personKey.get(h.person_id as string);
    if (!pos || !per) continue;
    const list = holdersByPosition.get(pos) ?? [];
    list.push(per);
    holdersByPosition.set(pos, list);
  }

  return {
    campuses: (campuses.data as Row[]).map((c) => ({
      key: c.key as string,
      name: c.name as string,
      is_primary: Boolean(c.is_primary),
    })),
    people: (people.data as Row[]).map((p) => ({
      id: p.id as string,
      key: p.key as string,
      full_name: p.full_name as string,
      email: (p.email as string) ?? null,
    })),
    positions: (positions.data as Row[]).map((p) => ({
      id: p.id as string,
      key: p.key as string,
      title: p.title as string,
      department: p.department as string,
      campus: campusKey.get(p.campus_id as string) ?? "",
      reports_to: p.reports_to_id
        ? (positionKey.get(p.reports_to_id as string) ?? null)
        : null,
      holders: holdersByPosition.get(p.key as string) ?? [],
      campus_lead: Boolean(p.campus_lead),
    })),
  };
}
