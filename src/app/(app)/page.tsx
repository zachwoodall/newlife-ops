import { getCurrentPerson, displayName } from "@/lib/current-person";
import { SetupNotice } from "./setup-notice";

export default async function HomePage() {
  const current = await getCurrentPerson();
  if (!current) return null; // middleware redirects before this can happen

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome, {displayName(current)}
      </h1>
      <p className="text-muted mt-1">
        Here&apos;s what needs your attention this week.
      </p>

      {!current.dbReady && (
        <div className="mt-6">
          <SetupNotice />
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-widest uppercase">
          Top 5 incomplete this week
        </h2>
        <div className="border-border text-muted mt-3 rounded-lg border border-dashed p-8 text-center text-sm">
          Task tracking arrives in Milestone 7.
        </div>
      </section>
    </main>
  );
}
