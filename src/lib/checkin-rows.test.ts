/** Check-ins: a recurring question, one answer per person per period. */

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
const idOf = async (key: string) =>
  (await db.query<{ id: string }>("select id from people where key = $1", [key])).rows[0].id;

before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
                 grant usage on schema public to anon, authenticated;`);
  await db.exec(readFileSync("supabase/migrations/0001_org_structure.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
  for (const m of ["0002_rls", "0003_tasks", "0004_task_board", "0005_recurrence",
                   "0006_org_editing", "0007_messages", "0008_task_files",
                   "0009_weekly_items", "0010_task_comments", "0011_notifications",
                   "0012_announcements", "0013_calendar", "0014_reactions",
                   "0015_library", "0016_checkins"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete
                   on checkins, checkin_answers to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from checkins;");
});

async function aCheckin(cadence = "weekly", dept: string | null = null) {
  const zach = await idOf("zach-woodall");
  await actAs("zach@newlifecanton.com");
  const { rows } = await db.query<{ id: string }>(
    `insert into checkins (question, cadence, department, created_by)
     values ('What are you working on?', $1, $2, $3) returning id`,
    [cadence, dept, zach],
  );
  return { id: rows[0].id, zach };
}

const answer = (checkinId: string, personId: string, period: string, body = "Setlist") =>
  db.query(
    `insert into checkin_answers (checkin_id, person_id, period, body)
     values ($1,$2,$3,$4)`, [checkinId, personId, period, body]);

describe("asking", () => {
  test("anyone can start a check-in for everyone", async () => {
    await aCheckin();
    const { rows } = await db.query("select * from checkins");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you cannot aim one at a department you are not in", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () => db.query(
        `insert into checkins (question, department, created_by)
         values ('x', 'Not My Department', $1)`, [zach]),
      /policy/i);
    await asAdmin();
  });

  test("an empty question is rejected", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () => db.query(
        `insert into checkins (question, created_by) values ('   ', $1)`, [zach]),
      /question/);
    await asAdmin();
  });

  test("cadence is limited to weekly or monthly", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () => db.query(
        `insert into checkins (question, cadence, created_by) values ('x','hourly',$1)`, [zach]),
      /cadence/);
    await asAdmin();
  });
});

describe("answering", () => {
  test("you can answer, and everyone who sees the question sees the answer", async () => {
    const { id, zach } = await aCheckin();
    await answer(id, zach, "2026-10-04", "Rebuilding the setlist");

    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query<{ body: string }>("select body from checkin_answers");
    await asAdmin();
    assert.equal(rows[0].body, "Rebuilding the setlist", "the point is reading each other");
  });

  test("one answer per person per period", async () => {
    const { id, zach } = await aCheckin();
    await answer(id, zach, "2026-10-04");
    await assert.rejects(() => answer(id, zach, "2026-10-04", "again"), /duplicate key|unique/i);
    await asAdmin();
  });

  test("a new period is a separate answer, and the old one survives", async () => {
    const { id, zach } = await aCheckin();
    await answer(id, zach, "2026-10-04", "Last week");
    await answer(id, zach, "2026-10-11", "This week");
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from checkin_answers");
    await asAdmin();
    assert.equal(rows[0].n, 2, "history is kept, not overwritten");
  });

  test("you cannot answer as someone else", async () => {
    const { id } = await aCheckin();
    const levi = await idOf("levi-porter");
    await assert.rejects(() => answer(id, levi, "2026-10-04"), /policy/i);
    await asAdmin();
  });

  test("an empty answer is rejected", async () => {
    const { id, zach } = await aCheckin();
    await assert.rejects(() => answer(id, zach, "2026-10-04", "   "), /body/);
    await asAdmin();
  });

  test("you can revise your own answer", async () => {
    const { id, zach } = await aCheckin();
    await answer(id, zach, "2026-10-04", "Draft");
    await db.query(
      `update checkin_answers set body = 'Final', updated_at = now() where person_id = $1`,
      [zach]);
    const { rows } = await db.query<{ body: string }>("select body from checkin_answers");
    await asAdmin();
    assert.equal(rows[0].body, "Final");
  });

  test("nobody can revise someone else's answer", async () => {
    const { id, zach } = await aCheckin();
    await answer(id, zach, "2026-10-04", "Mine");

    await actAs("brandon-ford@newlifecanton.com");
    await db.query(`update checkin_answers set body = 'Tampered'`);
    await asAdmin();
    const { rows } = await db.query<{ body: string }>("select body from checkin_answers");
    assert.equal(rows[0].body, "Mine");
  });

  test("removing the question removes its answers", async () => {
    const { id, zach } = await aCheckin();
    await answer(id, zach, "2026-10-04");
    await db.query("delete from checkins where id = $1", [id]);
    await asAdmin();
    const { rows } = await db.query("select * from checkin_answers");
    assert.equal(rows.length, 0);
  });
});
