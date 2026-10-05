import { getCurrentPerson } from "@/lib/current-person";
import { SetupNotice } from "../setup-notice";

export default async function DepartmentPage() {
  const current = await getCurrentPerson();
  if (!current) return null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">My Department</h1>
      <p className="text-muted mt-1">
        Your supervisor, your team, and who you can assign work to.
      </p>

      {!current.dbReady && (
        <div className="mt-6">
          <SetupNotice />
        </div>
      )}

      <div className="border-border text-muted mt-8 rounded-lg border border-dashed p-12 text-center text-sm">
        The org chart arrives in Milestone 4.
      </div>
    </main>
  );
}
