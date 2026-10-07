/**
 * Recurring series: date arithmetic and occurrence generation.
 *
 * The thing that must hold: completing one occurrence never disturbs the
 * others. These run against real Postgres so the date maths is Postgres's,
 * not a JavaScript approximation of it.
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

let db: PGlite;

async function actAs(email: string) {
  await db.exec("reset role;");
  await db.exec(`set request.jwt.claims = '{"email":"${email}"}';`);
  await db.exec("set role authenticated;");
}
async function asAdmin() {
  await db.exec("reset role;");
  await db.exec(`set request.jwt.claims = '';`);
}
const idOf = async (key: string) => {
  const { rows } = await db.query<{ id: string }>(
    "select id from people where key = $1",
    [key],
  );
  return rows[0].id;
};
const one = async <T>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows[0];

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  for (const f of [
    "supabase/migrations/0001_org_structure.sql",
    "supabase/seed.sql",
  ]) {
    await db.exec(readFileSync(f, "utf8"));
  }
  await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
  for (const f of [
    "supabase/migrations/0002_rls.sql",
    "supabase/migrations/0003_tasks.sql",
    "supabase/migrations/0004_task_board.sql",
    "supabase/migrations/0005_recurrence.sql",
  ]) {
    await db.exec(readFileSync(f, "utf8"));
  }
  await db.exec(`
    grant select, insert, update, delete
      on tasks, task_assignees, task_checklist, task_series to authenticated;
  `);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from task_series; delete from tasks;");
});

describe("nth_occurrence steps from the start, without drift", () => {
  test("weekly", async () => {
    const r = await one<{ a: string; b: string }>(
      `select nth_occurrence('2026-10-05','weekly',1)::text a,
              nth_occurrence('2026-10-05','weekly',4)::text b`,
    );
    assert.equal(r.a, "2026-10-12");
    assert.equal(r.b, "2026-11-02");
  });

  test("monthly from the 31st does not walk backwards", async () => {
    // Stepping one month at a time would give Jan 31 -> Feb 28 -> Mar 28.
    const r = await one<{ feb: string; mar: string; apr: string }>(
      `select nth_occurrence('2026-01-31','monthly',1)::text feb,
              nth_occurrence('2026-01-31','monthly',2)::text mar,
              nth_occurrence('2026-01-31','monthly',3)::text apr`,
    );
    assert.equal(r.feb, "2026-02-28");
    assert.equal(r.mar, "2026-03-31");
    assert.equal(r.apr, "2026-04-30");
  });

  test("quarterly and yearly", async () => {
    const r = await one<{ q: string; y: string }>(
      `select nth_occurrence('2026-10-05','quarterly',2)::text q,
              nth_occurrence('2028-02-29','yearly',1)::text y`,
    );
    assert.equal(r.q, "2027-04-05");
    assert.equal(r.y, "2029-02-28"); // 2029 is not a leap year
  });
});

async function makeSeries(cadence: string, startsOn: string, endsOn: string | null = null) {
  const zach = await idOf("zach-woodall");
  await actAs("zach@newlifecanton.com");
  const { rows } = await db.query<{ id: string }>(
    `insert into task_series (title, owner_id, created_by, cadence, starts_on, ends_on)
     values ('Plan Sunday setlist', $1, $1, $2, $3, $4) returning id`,
    [zach, cadence, startsOn, endsOn],
  );
  return rows[0].id;
}

describe("generating occurrences", () => {
  test("creates the requested number of future dates", async () => {
    const id = await makeSeries("weekly", "2026-01-04");
    const made = await one<{ generate_occurrences: number }>(
      "select generate_occurrences($1, 4)",
      [id],
    );
    assert.equal(Number(made.generate_occurrences), 4);

    const { rows } = await db.query<{ occurrence_date: string }>(
      `select occurrence_date::text from tasks
        where series_id = $1 order by occurrence_date`,
      [id],
    );
    await asAdmin();
    assert.equal(rows.length, 4);
    // Exactly 7 calendar days apart. Parsed as UTC on purpose: local
    // parsing shifts an hour across a daylight saving change, which makes
    // a correct 7-day gap measure as 7.04.
    const days = rows.map((r) => Date.parse(r.occurrence_date + "T00:00:00Z"));
    for (let i = 1; i < days.length; i++) {
      assert.equal((days[i] - days[i - 1]) / 86_400_000, 7);
    }
    const today = new Date().toISOString().slice(0, 10);
    for (const r of rows) assert.ok(r.occurrence_date >= today);
  });

  test("running it twice does not duplicate", async () => {
    const id = await makeSeries("weekly", "2026-01-04");
    await db.query("select generate_occurrences($1, 4)", [id]);
    const second = await one<{ generate_occurrences: number }>(
      "select generate_occurrences($1, 4)",
      [id],
    );
    assert.equal(Number(second.generate_occurrences), 0);
    const { rows } = await db.query("select * from tasks where series_id = $1", [id]);
    await asAdmin();
    assert.equal(rows.length, 4);
  });

  test("completing one occurrence leaves the rest untouched", async () => {
    const id = await makeSeries("weekly", "2026-01-04");
    await db.query("select generate_occurrences($1, 4)", [id]);

    const first = await one<{ id: string }>(
      `select id from tasks where series_id = $1 order by occurrence_date limit 1`,
      [id],
    );
    await db.query(
      `update tasks set status = 'done', completed_at = now() where id = $1`,
      [first.id],
    );

    const { rows } = await db.query<{ status: string }>(
      `select status from tasks where series_id = $1 order by occurrence_date`,
      [id],
    );
    await asAdmin();
    assert.deepEqual(rows.map((r) => r.status), ["done", "open", "open", "open"]);
  });

  test("it stops at the end date", async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    const endsOn = soon.toISOString().slice(0, 10);

    const id = await makeSeries("weekly", "2026-01-04", endsOn);
    await db.query("select generate_occurrences($1, 10)", [id]);
    const { rows } = await db.query<{ occurrence_date: string }>(
      `select occurrence_date::text from tasks where series_id = $1`,
      [id],
    );
    await asAdmin();
    assert.ok(rows.length <= 2, `expected at most 2 within 10 days, got ${rows.length}`);
    for (const r of rows) assert.ok(r.occurrence_date <= endsOn);
  });

  test("an inactive series generates nothing", async () => {
    const id = await makeSeries("weekly", "2026-01-04");
    await db.query("update task_series set active = false where id = $1", [id]);
    const made = await one<{ generate_occurrences: number }>(
      "select generate_occurrences($1, 4)",
      [id],
    );
    await asAdmin();
    assert.equal(Number(made.generate_occurrences), 0);
  });

  test("you cannot generate for someone else's series", async () => {
    const id = await makeSeries("weekly", "2026-01-04");
    await actAs("brandon-ford@newlifecanton.com");
    await assert.rejects(
      () => db.query("select generate_occurrences($1, 4)", [id]),
      /Not your series/,
    );
    await asAdmin();
  });

  test("deleting the series removes its occurrences", async () => {
    const id = await makeSeries("weekly", "2026-01-04");
    await db.query("select generate_occurrences($1, 4)", [id]);
    await db.query("delete from task_series where id = $1", [id]);
    await asAdmin();
    const { rows } = await db.query("select * from tasks where series_id = $1", [id]);
    assert.equal(rows.length, 0);
  });
});

describe("series permissions", () => {
  test("you may schedule for someone below you", async () => {
    const zach = await idOf("zach-woodall");
    const levi = await idOf("levi-porter");
    await actAs("zach@newlifecanton.com");
    await db.query(
      `insert into task_series (title, owner_id, created_by, cadence, starts_on)
       values ('Weekly room reset', $1, $2, 'weekly', current_date)`,
      [levi, zach],
    );
    const { rows } = await db.query("select * from task_series");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you may not schedule for someone above you", async () => {
    const zach = await idOf("zach-woodall");
    const jb = await idOf("jb-kitts");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () =>
        db.query(
          `insert into task_series (title, owner_id, created_by, cadence, starts_on)
           values ('Paperwork', $1, $2, 'weekly', current_date)`,
          [jb, zach],
        ),
      /policy/i,
    );
    await asAdmin();
  });
});
