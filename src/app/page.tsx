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

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-widest text-neutral-500 uppercase">
        Milestone 1 complete
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        Church Ops
      </h1>
      <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
        Staff, teams, and weekly assignments. The foundation is running —
        Next.js, TypeScript, and Tailwind. Authentication comes next.
      </p>

      <ul className="mt-12 space-y-3">
        {pages.map((page) => (
          <li
            key={page.name}
            className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-semibold">{page.name}</h2>
              <span className="text-xs text-neutral-500">{page.milestone}</span>
            </div>
            <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
              {page.detail}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-12 text-sm text-neutral-500">
        Next up — Milestone 2: Supabase sign-in and the three-page navigation
        shell.
      </p>
    </main>
  );
}
