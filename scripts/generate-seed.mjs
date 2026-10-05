// Generates supabase/seed.sql from seed/org.json so the two can never drift.
// Run: npm run seed:generate

import { readFileSync, writeFileSync } from "node:fs";

const org = JSON.parse(readFileSync("seed/org.json", "utf8"));
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

const out = [];
out.push("-- GENERATED FILE — do not edit by hand.");
out.push("-- Source: seed/org.json · Regenerate: npm run seed:generate");
out.push("");
out.push("begin;");
out.push("");

out.push("-- campuses");
for (const c of org.campuses) {
  out.push(
    `insert into campuses (key, name, is_primary) values (${q(c.key)}, ${q(c.name)}, ${c.is_primary ? "true" : "false"})\n  on conflict (key) do update set name = excluded.name, is_primary = excluded.is_primary;`,
  );
}
out.push("");

out.push("-- people");
for (const p of org.people) {
  out.push(
    `insert into people (key, full_name, email) values (${q(p.key)}, ${q(p.full_name)}, ${q(p.email)})\n  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;`,
  );
}
out.push("");

out.push("-- positions (reporting lines set afterwards so order never matters)");
for (const p of org.positions) {
  out.push(
    `insert into positions (key, title, department, campus_id, campus_lead)\n  select ${q(p.key)}, ${q(p.title)}, ${q(p.department)}, c.id, ${p.campus_lead ? "true" : "false"}\n    from campuses c where c.key = ${q(p.campus)}\n  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;`,
  );
}
out.push("");

out.push("-- reporting lines");
for (const p of org.positions) {
  if (!p.reports_to) continue;
  out.push(
    `update positions set reports_to_id = (select id from positions where key = ${q(p.reports_to)}) where key = ${q(p.key)};`,
  );
}
out.push("");

out.push("-- who holds which position");
for (const p of org.positions) {
  for (const h of p.holders) {
    out.push(
      `insert into position_holders (position_id, person_id)\n  select pos.id, ppl.id from positions pos, people ppl\n   where pos.key = ${q(p.key)} and ppl.key = ${q(h)}\n  on conflict do nothing;`,
    );
  }
}
out.push("");
out.push("commit;");
out.push("");

writeFileSync("supabase/seed.sql", out.join("\n"));

const open = org.positions.filter((p) => p.holders.length === 0).length;
console.log(
  `supabase/seed.sql written — ${org.campuses.length} campuses, ${org.people.length} people, ${org.positions.length} positions (${open} open)`,
);
