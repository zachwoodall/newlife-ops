export function SetupNotice() {
  return (
    <div className="border-brand-200 bg-brand-50 text-brand-900 rounded-lg border p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
      <p className="font-semibold">Database not set up yet</p>
      <p className="mt-1">
        Sign-in works, but the org tables don&apos;t exist in this Supabase
        project yet. Run{" "}
        <code className="font-mono text-xs">
          supabase/migrations/0001_org_structure.sql
        </code>{" "}
        then <code className="font-mono text-xs">supabase/seed.sql</code> in the
        Supabase SQL Editor, and names, departments, and the org chart will fill
        in.
      </p>
    </div>
  );
}
