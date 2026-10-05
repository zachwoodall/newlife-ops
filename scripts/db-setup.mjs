/**
 * Applies the migration and seed to the live Supabase project, then verifies.
 * Reads DATABASE_URL from .env.local. Run: npm run db:setup
 */

import { readFileSync } from "node:fs";
import pg from "pg";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "\n  DATABASE_URL is not set in .env.local.\n" +
      "  Supabase dashboard -> Connect -> Session pooler -> copy the URI.\n",
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

const step = (msg) => console.log(`  ${msg}`);

try {
  await client.connect();
  step("connected");

  await client.query(readFileSync("supabase/migrations/0001_org_structure.sql", "utf8"));
  step("migration applied");

  await client.query(readFileSync("supabase/seed.sql", "utf8"));
  step("seed loaded");

  const counts = await client.query(`
    select
      (select count(*) from campuses)         as campuses,
      (select count(*) from people)           as people,
      (select count(*) from positions)        as positions,
      (select count(*) from position_holders) as holders,
      (select count(*) from positions p
        where not exists (select 1 from position_holders h
                          where h.position_id = p.id)) as open_roles
  `);
  console.log("\n  Loaded:", counts.rows[0]);

  // The rule has to hold in the live database too, not just in tests.
  const check = await client.query(`
    select
      can_assign_task(
        (select id from people where key = 'jb-kitts'),
        (select id from people where key = 'thomas-davis')) as exec_to_worship,
      can_assign_task(
        (select id from people where key = 'thomas-davis'),
        (select id from people where key = 'jb-kitts')) as worship_to_exec,
      can_assign_task(
        (select id from people where key = 'zach-woodall'),
        (select id from people where key = 'john-booth')) as campus_lead_across,
      can_assign_task(
        (select id from people where key = 'zach-woodall'),
        (select id from people where key = 'thomas-davis')) as other_campus
  `);
  const r = check.rows[0];
  console.log("  Assignment rule:", r);

  const ok =
    r.exec_to_worship === true &&
    r.worship_to_exec === false &&
    r.campus_lead_across === true &&
    r.other_campus === false;

  console.log(ok ? "\n  Rule verified in the live database.\n" : "\n  RULE MISMATCH\n");
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error("\n  Failed:", err.message, "\n");
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
