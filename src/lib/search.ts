/**
 * Query handling for search.
 *
 * Postgres full-text indexing would be the eventual answer, but at this size
 * -- a staff of fifteen -- case-insensitive substring matching across a few
 * tables is both sufficient and far easier to reason about. The important
 * part is that the search text is escaped so a stray % or _ cannot turn into
 * a wildcard, and that nothing bypasses row level security.
 */

export type SearchKind = "task" | "comment" | "announcement" | "message" | "file";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  /** The matching text, trimmed around the match. */
  excerpt: string;
  url: string;
  when: string;
};

/** Escape the characters that are wildcards inside a LIKE/ILIKE pattern. */
export function escapeLike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * PostgREST treats commas and parentheses as structure inside `or=(...)`,
 * so a term containing them has to be quoted and its quotes escaped.
 */
export function likePattern(term: string): string {
  return `*${escapeLike(term).replace(/"/g, '\\"')}*`;
}

/** Trim a long body down to the part that actually matched. */
export function excerpt(body: string, term: string, radius = 70): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!term) return flat.slice(0, radius * 2);

  const at = flat.toLowerCase().indexOf(term.toLowerCase());
  if (at === -1) return flat.slice(0, radius * 2) + (flat.length > radius * 2 ? "…" : "");

  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + term.length + radius);
  return (
    (start > 0 ? "…" : "") + flat.slice(start, end) + (end < flat.length ? "…" : "")
  );
}

/** A query worth running: trimmed, and long enough to be meaningful. */
export function isUsableQuery(raw: string): boolean {
  return raw.trim().length >= 2;
}
