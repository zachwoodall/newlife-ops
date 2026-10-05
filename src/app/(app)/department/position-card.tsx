import type { OrgData, Position } from "@/lib/org";

export function PositionCard({
  org,
  position,
  tone = "normal",
  /** Campus currently being viewed — a card from elsewhere gets labelled. */
  viewingCampus,
}: {
  org: OrgData;
  position: Position;
  tone?: "normal" | "self" | "muted";
  viewingCampus?: string;
}) {
  const names = position.holders
    .map((k) => org.people.find((p) => p.key === k)?.full_name)
    .filter(Boolean) as string[];

  const open = names.length === 0;

  const elsewhere =
    viewingCampus !== undefined && position.campus !== viewingCampus;
  const campusName = org.campuses.find((c) => c.key === position.campus)?.name;

  const ring =
    tone === "self" ? "border-brand-500 ring-brand-500/20 ring-2" : "border-border";

  return (
    <div className={`bg-surface rounded-lg border ${ring} overflow-hidden`}>
      <div
        className={
          tone === "muted"
            ? "bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"
            : "bg-brand-500 px-3 py-1.5"
        }
      >
        <p
          className={
            tone === "muted"
              ? "text-muted text-xs font-semibold tracking-wider uppercase"
              : "text-xs font-semibold tracking-wider text-white uppercase"
          }
        >
          {position.title}
        </p>
      </div>

      <div className="px-3 py-3">
        {open ? (
          <p className="text-muted text-sm italic">Open position</p>
        ) : (
          <p className="text-sm font-medium">{names.join(" & ")}</p>
        )}
        <p className="text-muted mt-0.5 text-xs">
          {position.department}
          {elsewhere && campusName && (
            <span className="border-border text-muted ml-1.5 rounded border px-1 py-0.5 text-[10px] tracking-wide uppercase">
              {campusName}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
