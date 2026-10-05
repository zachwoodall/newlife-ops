import { getCurrentPerson } from "@/lib/current-person";
import { SetupNotice } from "../setup-notice";

export default async function TasksPage() {
  const current = await getCurrentPerson();
  if (!current) return null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Task Directory</h1>
      <p className="text-muted mt-1">
        Everything you own, by weekly, monthly, quarterly, and yearly cadence.
      </p>

      {!current.dbReady && (
        <div className="mt-6">
          <SetupNotice />
        </div>
      )}

      <div className="border-border text-muted mt-8 rounded-lg border border-dashed p-12 text-center text-sm">
        The task directory arrives in Milestone 6.
      </div>
    </main>
  );
}
