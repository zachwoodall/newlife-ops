/**
 * Verifies the RLS policies actually block the anon role.
 *
 * The anon key is public — it ships inside every browser that loads the app —
 * so "anon can read staff data" is the difference between a private tool and
 * an open database. This test asserts the lock rather than trusting it.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

let db: PGlite;

before(async () => {
  db = new PGlite();
  // Supabase ships these roles; PGlite does not, so create them to match.
  await db.exec(`
    create role anon;
    create role authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  await db.exec(readFileSync("supabase/migrations/0001_org_structure.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`
    grant select on all tables in schema public to anon, authenticated;
  `);
  await db.exec(readFileSync("supabase/migrations/0002_rls.sql", "utf8"));
});

after(async () => {
  await db.close();
});

const TABLES = ["campuses", "people", "positions", "position_holders"];

describe("row level security", () => {
  test("RLS is enabled on every table", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
        where relname = any($1) and relkind = 'r'`,
      [TABLES],
    );
    assert.equal(rows.length, TABLES.length);
    for (const r of rows) {
      assert.equal(r.relrowsecurity, true, `${r.relname} has RLS off`);
    }
  });

  test("anon reads nothing from any table", async () => {
    for (const t of TABLES) {
      await db.exec("set role anon;");
      const { rows } = await db.query(`select * from ${t}`);
      await db.exec("reset role;");
      assert.equal(rows.length, 0, `anon could read ${t}`);
    }
  });

  test("signed-in staff can read the org", async () => {
    await db.exec("set role authenticated;");
    const people = await db.query(`select * from people`);
    const positions = await db.query(`select * from positions`);
    await db.exec("reset role;");
    assert.equal(people.rows.length, 15);
    assert.equal(positions.rows.length, 22);
  });

  test("anon cannot write", async () => {
    await db.exec("set role anon;");
    await assert.rejects(
      () => db.exec(`insert into people (key, full_name) values ('x', 'Intruder')`),
      /policy|permission|denied/i,
    );
    await db.exec("reset role;");
  });

  test("signed-in staff cannot write either, until Milestone 5", async () => {
    await db.exec("set role authenticated;");
    await assert.rejects(
      () => db.exec(`delete from people where key = 'jb-kitts'`),
      /policy|permission|denied/i,
    );
    await db.exec("reset role;");
  });

  test("the data is still there underneath", async () => {
    const { rows } = await db.query<{ n: number }>("select count(*) n from people");
    assert.equal(Number(rows[0].n), 15);
  });
});
