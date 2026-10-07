import { getCurrentPerson } from "@/lib/current-person";
import { loadOrg } from "@/lib/org-data";
import { getSelectedCampus } from "@/lib/campus";
import { positionsOf, directReports, campusesOf, isBelow } from "@/lib/org";
import { SetupNotice } from "../setup-notice";
import { CampusSwitcher } from "./campus-switcher";
import { PositionCard } from "./position-card";
import { EditableCard, type CardPosition } from "./editable-card";
import { AddRole } from "./add-role";

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

  const peopleById = new Map(org.people.map((p) => [p.key, p]));
  const allPeople = org.people
    .filter((p) => p.id)
    .map((p) => ({ id: p.id!, name: p.full_name }));

  /** Shape a position for the editable card, labelling off-campus roles. */
  const toCard = (p: (typeof org.positions)[number]): CardPosition => ({
    id: p.id!,
    title: p.title,
    department: p.department,
    campusName:
      p.campus === selected
        ? null
        : (org.campuses.find((c) => c.key === p.campus)?.name ?? null),
    holders: p.holders
      .map((k) => peopleById.get(k))
      .filter(Boolean)
      .map((person) => ({ id: person!.id!, name: person!.full_name })),
  });
  const primaryCampusName =
    org.campuses.find((c) => c.is_primary)?.name ?? "the main campus";

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
        const beneath = org.positions.filter(
          (p) => p.id && p.key !== position.key && isBelow(org, p.key, position.key),
        );
        const moveTargets = [
          { id: position.id!, label: `${position.title} (you)` },
          ...beneath.map((p) => ({ id: p.id!, label: p.title })),
        ];
        // A campus lead oversees everyone at their campus, including roles
        // whose reporting line runs to the other campus.
        const oversight = position.campus_lead
          ? org.positions.filter(
              (p) =>
                p.campus === position.campus &&
                p.key !== position.key &&
                !reports.some((r) => r.key === p.key),
            )
          : [];

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
                    <PositionCard org={org} position={supervisor} tone="muted" viewingCampus={selected} />
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
                  <PositionCard org={org} position={position} tone="self" viewingCampus={selected} />
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
                      <EditableCard
                        key={r.key}
                        position={toCard(r)}
                        allPeople={allPeople}
                        reportsToOptions={moveTargets}
                        reportsToId={
                          org.positions.find((p) => p.key === r.reports_to)?.id ?? null
                        }
                      />
                    ))}
                  </div>
                )}
                <div className="mt-3 max-w-xs">
                  <AddRole
                    parentId={position.id!}
                    campusKey={position.campus}
                    department={position.department}
                  />
                </div>
              </div>

              {position.campus_lead && (
                <div>
                  <p className="text-muted mb-2 text-xs tracking-wider uppercase">
                    Also at this campus ({oversight.length})
                  </p>
                  <p className="text-muted mb-3 text-sm">
                    These roles report to their {primaryCampusName} department
                    head, but work at {campusName} under you. You can assign
                    them tasks.
                  </p>
                  {oversight.length === 0 ? (
                    <p className="text-muted text-sm italic">
                      No other roles at this campus.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {oversight.map((r) => (
                        <EditableCard
                          key={r.key}
                          position={toCard(r)}
                          allPeople={allPeople}
                          reportsToOptions={moveTargets}
                          reportsToId={
                            org.positions.find((p) => p.key === r.reports_to)?.id ?? null
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
