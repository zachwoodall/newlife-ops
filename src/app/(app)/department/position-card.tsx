import Link from "next/link";
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
  const holders = position.holders
    .map((k) => org.people.find((p) => p.key === k))
    .filter(Boolean) as { id?: string; full_name: string }[];

  const open = holders.length === 0;

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
          <div className="space-y-0.5">
            {holders.map((h) => (
              <p key={h.full_name} className="flex items-center gap-2 text-sm font-medium">
                <span className="flex-1">{h.full_name}</span>
                {h.id && (
                  <Link
                    href={`/messages/${h.id}`}
                    className="text-muted hover:text-brand-700 text-[11px] font-medium"
                  >
                    Message
                  </Link>
                )}
              </p>
            ))}
          </div>
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
