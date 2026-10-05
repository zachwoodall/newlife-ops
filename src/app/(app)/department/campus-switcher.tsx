import { setCampus } from "./actions";

export function CampusSwitcher({
  campuses,
  selected,
}: {
  campuses: { key: string; name: string }[];
  selected: string;
}) {
  // People at a single campus never see this.
  if (campuses.length < 2) return null;

  return (
    <div className="border-border inline-flex rounded-lg border p-0.5">
      {campuses.map((c) => {
        const active = c.key === selected;
        return (
          <form action={setCampus} key={c.key}>
            <input type="hidden" name="campus" value={c.key} />
            <button
              type="submit"
              aria-pressed={active}
              className={
                active
                  ? "bg-brand-500 rounded-md px-3 py-1.5 text-sm font-medium text-white"
                  : "text-muted hover:text-brand-700 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              }
            >
              {c.name}
            </button>
          </form>
        );
      })}
    </div>
  );
}
