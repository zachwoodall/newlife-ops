import { getCurrentPerson } from "@/lib/current-person";
import { loadOrg } from "@/lib/org-data";
import { getSelectedCampus } from "@/lib/campus";
import { positionsOf, directReports, campusesOf } from "@/lib/org";
import { SetupNotice } from "../setup-notice";
import { CampusSwitcher } from "./campus-switcher";
import { PositionCard } from "./position-card";

export default async function DepartmentPage() {
  const current = await getCurrentPerson();
  if (!current) return null;

  const org = await loadOrg();

  if (!org || !current.person) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">My Department</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </main>
    );
  }

  const me = current.person.key;
  const myCampusKeys = campusesOf(org, me);
  const selected = await getSelectedCampus(myCampusKeys);

  const myCampuses = org.campuses.filter((c) => myCampusKeys.includes(c.key));
  const here = positionsOf(org, me).filter((p) => p.campus === selected);
  const campusName =
    org.campuses.find((c) => c.key === selected)?.name ?? selected;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            My Department
          </h1>
          <p className="text-muted mt-1">
            {campusName} · {current.person.full_name}
          </p>
        </div>
        <CampusSwitcher campuses={myCampuses} selected={selected} />
      </div>

      {here.length === 0 && (
        <p className="text-muted mt-10 text-sm">
          You don&apos;t hold a position at {campusName}.
        </p>
      )}

      {here.map((position) => {
        const supervisor = position.reports_to
          ? (org.positions.find((p) => p.key === position.reports_to) ?? null)
          : null;
        const reports = directReports(org, position.key);

        return (
          <section key={position.key} className="mt-10">
            <h2 className="text-sm font-semibold tracking-widest uppercase">
              {position.department}
            </h2>

            <div className="mt-4 space-y-6">
              <div>
                <p className="text-muted mb-2 text-xs tracking-wider uppercase">
                  Reports to
                </p>
                {supervisor ? (
                  <div className="max-w-xs">
                    <PositionCard org={org} position={supervisor} tone="muted" />
                  </div>
                ) : (
                  <p className="text-muted text-sm italic">
                    No supervisor assigned.
                  </p>
                )}
              </div>

              <div>
                <p className="text-muted mb-2 text-xs tracking-wider uppercase">
                  You
                </p>
                <div className="max-w-xs">
                  <PositionCard org={org} position={position} tone="self" />
                </div>
              </div>

              <div>
                <p className="text-muted mb-2 text-xs tracking-wider uppercase">
                  Your team ({reports.length})
                </p>
                {reports.length === 0 ? (
                  <p className="text-muted text-sm italic">
                    Nobody reports to you in this role.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {reports.map((r) => (
                      <PositionCard key={r.key} org={org} position={r} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
