/**
 * Org tree logic: reporting lines, and who may assign tasks to whom.
 *
 * These are pure functions over an OrgData object so they can be tested
 * against seed/org.json today and swapped to Supabase rows at Milestone 3
 * without the rules changing.
 */

export type Campus = {
  key: string;
  name: string;
  is_primary?: boolean;
};

export type Person = {
  key: string;
  full_name: string;
  email: string | null;
  /** Database id. Absent when the data came from seed/org.json. */
  id?: string;
};

export type Position = {
  key: string;
  /** Database id. Absent when the data came from seed/org.json. */
  id?: string;
  title: string;
  department: string;
  campus: string;
  /** Position this one reports to. null = top of the tree, or unassigned. */
  reports_to: string | null;
  /** Person keys filling this position. Empty = open role. */
  holders: string[];
  /** Campus leads may assign to anyone at their campus, across reporting lines. */
  campus_lead?: boolean;
  /** Union Hill directors sit under a campus pastor but report elsewhere. */
  campus_oversight?: string;
};

export type OrgData = {
  campuses: Campus[];
  people: Person[];
  positions: Position[];
};

/** Positions held by a person. A person may hold several, across campuses. */
export function positionsOf(org: OrgData, personKey: string): Position[] {
  return org.positions.filter((p) => p.holders.includes(personKey));
}

/** Campuses a person works at, derived from the positions they hold. */
export function campusesOf(org: OrgData, personKey: string): string[] {
  return [...new Set(positionsOf(org, personKey).map((p) => p.campus))];
}

/** True when a person holds positions at more than one campus. */
export function needsCampusSwitcher(org: OrgData, personKey: string): boolean {
  return campusesOf(org, personKey).length > 1;
}

/** A position is open when nobody holds it. */
export function isOpen(position: Position): boolean {
  return position.holders.length === 0;
}

/**
 * Walk up the reporting chain from a position to the top.
 * Guards against a cycle in the data rather than looping forever.
 */
export function supervisorChain(org: OrgData, positionKey: string): Position[] {
  const byKey = new Map(org.positions.map((p) => [p.key, p]));
  const chain: Position[] = [];
  const seen = new Set<string>([positionKey]);

  let current = byKey.get(positionKey)?.reports_to ?? null;
  while (current) {
    if (seen.has(current)) break; // cycle — stop rather than hang
    seen.add(current);
    const next = byKey.get(current);
    if (!next) break;
    chain.push(next);
    current = next.reports_to;
  }
  return chain;
}

/** Positions reporting directly to this one. */
export function directReports(org: OrgData, positionKey: string): Position[] {
  return org.positions.filter((p) => p.reports_to === positionKey);
}

/** Is `descendant` anywhere below `ancestor` in the reporting tree? */
export function isBelow(
  org: OrgData,
  descendantKey: string,
  ancestorKey: string,
): boolean {
  if (descendantKey === ancestorKey) return false;
  return supervisorChain(org, descendantKey).some((p) => p.key === ancestorKey);
}

/**
 * May `assigner` give a task to `assignee`?
 *
 * Two ways to qualify:
 *   1. The assignee holds a position below one of the assigner's positions.
 *   2. The assigner is a campus lead and the assignee holds a position at
 *      that campus. This covers Union Hill directors, who report to their
 *      Holly Springs department head but work under the campus pastor.
 *
 * Assigning to yourself is allowed. Assigning upward never is.
 */
export function canAssignTask(
  org: OrgData,
  assignerKey: string,
  assigneeKey: string,
): boolean {
  if (assignerKey === assigneeKey) return true;

  const from = positionsOf(org, assignerKey);
  const to = positionsOf(org, assigneeKey);
  if (from.length === 0 || to.length === 0) return false;

  return from.some((a) =>
    to.some(
      (b) =>
        isBelow(org, b.key, a.key) ||
        (a.campus_lead === true && b.campus === a.campus && b.key !== a.key),
    ),
  );
}

/** Everyone this person may assign tasks to, excluding themselves. */
export function assignableBy(org: OrgData, personKey: string): Person[] {
  return org.people.filter(
    (p) => p.key !== personKey && canAssignTask(org, personKey, p.key),
  );
}

/** Messages may go to anyone on staff. Here for symmetry with assignment. */
export function canMessage(
  org: OrgData,
  _senderKey: string,
  recipientKey: string,
): boolean {
  return org.people.some((p) => p.key === recipientKey);
}
