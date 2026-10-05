// Generates supabase/seed.sql from seed/org.json so the two can never drift.
// Run: npm run seed:generate

import { readFileSync, writeFileSync } from "node:fs";

const org = JSON.parse(readFileSync("seed/org.json", "utf8"));
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const L = [];
L.push("-- GENERATED FILE — do not edit by hand.");
L.push("-- Source: seed/org.json · Regenerate: npm run seed:generate");
L.push("");
L.push("begin;");
L.push("");

L.push("insert into campuses (key, name, is_primary) values");
L.push(org.campuses.map((c) => `  (${q(c.key)}, ${q(c.name)}, ${c.is_primary ? "true" : "false"})`).join(",\n"));
L.push("on conflict (key) do update set name = excluded.name, is_primary = excluded.is_primary;");
L.push("");

L.push("insert into people (key, full_name, email) values");
L.push(org.people.map((p) => `  (${q(p.key)}, ${q(p.full_name)}, ${q(p.email)})`).join(",\n"));
L.push("on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;");
L.push("");

L.push("insert into positions (key, title, department, campus_id, campus_lead)");
L.push("select v.key, v.title, v.department, c.id, v.campus_lead");
L.push("  from (values");
L.push(
  org.positions
    .map((p) => `    (${q(p.key)}, ${q(p.title)}, ${q(p.department)}, ${q(p.campus)}, ${p.campus_lead ? "true" : "false"})`)
    .join(",\n"),
);
L.push("  ) as v (key, title, department, campus, campus_lead)");
L.push("  join campuses c on c.key = v.campus");
L.push("on conflict (key) do update set title = excluded.title, department = excluded.department,");
L.push("  campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;");
L.push("");

const links = org.positions.filter((p) => p.reports_to);
L.push("update positions p set reports_to_id = sup.id");
L.push("  from (values");
L.push(links.map((p) => `    (${q(p.key)}, ${q(p.reports_to)})`).join(",\n"));
L.push("  ) as v (child, parent)");
L.push("  join positions sup on sup.key = v.parent");
L.push(" where p.key = v.child;");
L.push("");

const holders = org.positions.flatMap((p) => p.holders.map((h) => [p.key, h]));
L.push("insert into position_holders (position_id, person_id)");
L.push("select pos.id, ppl.id");
L.push("  from (values");
L.push(holders.map(([pos, per]) => `    (${q(pos)}, ${q(per)})`).join(",\n"));
L.push("  ) as v (position_key, person_key)");
L.push("  join positions pos on pos.key = v.position_key");
L.push("  join people    ppl on ppl.key = v.person_key");
L.push("on conflict do nothing;");
L.push("");
L.push("commit;");
L.push("");

writeFileSync("supabase/seed.sql", L.join("\n"));
const open = org.positions.filter((p) => p.holders.length === 0).length;
console.log(
  `supabase/seed.sql — ${org.campuses.length} campuses, ${org.people.length} people, ${org.positions.length} positions (${open} open), ${holders.length} holder links`,
);
