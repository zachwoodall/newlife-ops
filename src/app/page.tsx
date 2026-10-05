const pages = [
  {
    name: "Home",
    detail: "Welcome message and your top 5 incomplete tasks for the week.",
    milestone: "Milestones 2 & 7",
  },
  {
    name: "My Department",
    detail:
      "Editable org chart with your supervisor above and your team below. Click a person to message them or assign a task.",
    milestone: "Milestones 4, 5 & 10",
  },
  {
    name: "Task Directory",
    detail:
      "Everything you own, grouped weekly, monthly, quarterly, and yearly. Opens a project board per task.",
    milestone: "Milestones 6, 8 & 9",
  },
];

const swatches = [
  { name: "brand-500", value: "#175B9D", className: "bg-brand-500" },
  { name: "brand-deep", value: "#00549F", className: "bg-brand-deep" },
  { name: "brand-700", value: "#11406F", className: "bg-brand-700" },
  { name: "black", value: "#000000", className: "bg-black" },
];

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-brand-500 text-sm font-semibold tracking-widest uppercase">
        Milestone 1 complete
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        Church Ops
      </h1>
      <p className="text-muted mt-4 text-lg">
        Staff, teams, and weekly assignments for New Life Church. The foundation
        is running — Next.js, TypeScript, and Tailwind. Authentication comes
        next.
      </p>

      <ul className="mt-12 space-y-3">
        {pages.map((page) => (
          <li
            key={page.name}
            className="border-border border-l-brand-500 rounded-lg border border-l-4 p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-semibold">{page.name}</h2>
              <span className="text-muted text-xs">{page.milestone}</span>
            </div>
            <p className="text-muted mt-1.5 text-sm">{page.detail}</p>
          </li>
        ))}
      </ul>

      <div className="border-border mt-12 border-t pt-6">
        <p className="text-muted text-xs font-semibold tracking-widest uppercase">
          Brand palette
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {swatches.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span
                className={`${s.className} border-border size-8 rounded border`}
              />
              <span className="text-muted font-mono text-xs">{s.value}</span>
            </div>
          ))}
        </div>
        <p className="text-brand-500 mt-6 text-xs font-semibold tracking-widest uppercase">
          Worship · Word · Walk · Witness
        </p>
      </div>
    </main>
  );
}
