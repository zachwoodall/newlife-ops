/**
 * Editing the org chart.
 *
 * The rule that matters most: nobody can promote themselves or reshape
 * anything at or above their own level. These drive the policies directly
 * as the authenticated role, the way a hostile client would.
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
const posId = async (key: string) =>
  (await db.query<{ id: string }>("select id from positions where key = $1", [key]))
    .rows[0].id;
const personId = async (key: string) =>
  (await db.query<{ id: string }>("select id from people where key = $1", [key]))
    .rows[0].id;

const MIGRATIONS = [
  "0002_rls", "0003_tasks", "0004_task_board", "0005_recurrence", "0006_org_editing",
];

before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
                 grant usage on schema public to anon, authenticated;`);
  await db.exec(readFileSync("supabase/migrations/0001_org_structure.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
  for (const m of MIGRATIONS) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`
    grant select, insert, update, delete
      on tasks, task_assignees, task_checklist, task_series,
         people, positions, position_holders to authenticated;
  `);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  // Restore the seeded chart between tests. TRUNCATE rather than DELETE:
  // the reparent trigger fires per row and collides with a bulk delete that
  // is removing parent and child in the same command.
  await db.exec(`truncate campuses, people, positions, position_holders,
                          tasks, task_series, task_assignees, task_checklist
                 restart identity cascade;`);
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

describe("editing positions you manage", () => {
  test("you can rename a role beneath you", async () => {
    await actAs("zach@newlifecanton.com");
    const intern = await posId("hs-students-intern");
    await db.query("update positions set title = 'Student Ministry Intern' where id = $1", [intern]);
    const { rows } = await db.query<{ title: string }>(
      "select title from positions where id = $1",
      [intern],
    );
    await asAdmin();
    assert.equal(rows[0].title, "Student Ministry Intern");
  });

  test("you cannot rename your own role", async () => {
    await actAs("zach@newlifecanton.com");
    const mine = await posId("hs-students");
    await db.query("update positions set title = 'Supreme Leader' where id = $1", [mine]);
    await asAdmin();
    const { rows } = await db.query<{ title: string }>(
      "select title from positions where id = $1",
      [mine],
    );
    assert.equal(rows[0].title, "Students", "own position should be unchanged");
  });

  test("you cannot rename your supervisor's role", async () => {
    await actAs("zach@newlifecanton.com");
    const boss = await posId("hs-executive-pastor");
    await db.query("update positions set title = 'Assistant' where id = $1", [boss]);
    await asAdmin();
    const { rows } = await db.query<{ title: string }>(
      "select title from positions where id = $1",
      [boss],
    );
    assert.equal(rows[0].title, "Executive Pastor");
  });

  test("a campus lead can edit roles at their campus", async () => {
    await actAs("zach@newlifecanton.com");
    const uhWorship = await posId("uh-worship-director");
    await db.query("update positions set department = 'Music' where id = $1", [uhWorship]);
    await asAdmin();
    const { rows } = await db.query<{ department: string }>(
      "select department from positions where id = $1",
      [uhWorship],
    );
    assert.equal(rows[0].department, "Music");
  });
});

describe("adding and removing roles", () => {
  test("you can add a role under your own position", async () => {
    await actAs("zach@newlifecanton.com");
    const mine = await posId("hs-students");
    const campus = (
      await db.query<{ campus_id: string }>("select campus_id from positions where id = $1", [mine])
    ).rows[0].campus_id;
    await db.query(
      `insert into positions (key, title, department, campus_id, reports_to_id)
       values ('hs-students-worship', 'Student Worship Lead', 'Students', $1, $2)`,
      [campus, mine],
    );
    const { rows } = await db.query("select * from positions where key = 'hs-students-worship'");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you cannot add a role under your supervisor", async () => {
    await actAs("zach@newlifecanton.com");
    const boss = await posId("hs-executive-pastor");
    const campus = (
      await db.query<{ campus_id: string }>("select campus_id from positions where id = $1", [boss])
    ).rows[0].campus_id;
    await assert.rejects(
      () =>
        db.query(
          `insert into positions (key, title, department, campus_id, reports_to_id)
           values ('sneaky', 'Co-Executive Pastor', 'Leadership', $1, $2)`,
          [campus, boss],
        ),
      /policy/i,
    );
    await asAdmin();
  });

  test("deleting a role lifts its reports to the level above", async () => {
    // Worship has a Music Director under it. Thomas's boss JB deletes Worship;
    // the Music Director should end up reporting to JB, not float free.
    await actAs("jb-kitts@newlifecanton.com");
    const worship = await posId("hs-worship");
    const exec = await posId("hs-executive-pastor");
    await db.query("delete from positions where id = $1", [worship]);
    await asAdmin();
    const { rows } = await db.query<{ reports_to_id: string }>(
      "select reports_to_id from positions where key = 'hs-music-director'",
    );
    assert.equal(rows[0].reports_to_id, exec);
  });
});

describe("reporting lines", () => {
  test("you can move someone beneath you to another of your roles", async () => {
    await actAs("jb-kitts@newlifecanton.com");
    const intern = await posId("hs-students-intern");
    const kids = await posId("hs-kids");
    await db.query("update positions set reports_to_id = $1 where id = $2", [kids, intern]);
    await asAdmin();
    const { rows } = await db.query<{ reports_to_id: string }>(
      "select reports_to_id from positions where id = $1",
      [intern],
    );
    assert.equal(rows[0].reports_to_id, kids);
  });

  test("a loop is refused", async () => {
    await actAs("jb-kitts@newlifecanton.com");
    const worship = await posId("hs-worship");
    const music = await posId("hs-music-director");
    await assert.rejects(
      () => db.query("update positions set reports_to_id = $1 where id = $2", [music, worship]),
      /Cycle/,
    );
    await asAdmin();
  });
});

describe("filling and emptying roles", () => {
  test("you can put someone into a role beneath you", async () => {
    await actAs("zach@newlifecanton.com");
    const uhStudent = await posId("uh-student-director");
    const anna = await personId("anna");
    await db.query(
      "insert into position_holders (position_id, person_id) values ($1, $2)",
      [uhStudent, anna],
    );
    const { rows } = await db.query("select * from position_holders where position_id = $1", [
      uhStudent,
    ]);
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you cannot put yourself into your supervisor's role", async () => {
    await actAs("zach@newlifecanton.com");
    const boss = await posId("hs-executive-pastor");
    const me = await personId("zach-woodall");
    await assert.rejects(
      () =>
        db.query("insert into position_holders (position_id, person_id) values ($1, $2)", [
          boss,
          me,
        ]),
      /policy/i,
    );
    await asAdmin();
  });

  test("you can empty a role beneath you", async () => {
    await actAs("zach@newlifecanton.com");
    const intern = await posId("hs-students-intern");
    await db.query("delete from position_holders where position_id = $1", [intern]);
    await asAdmin();
    const { rows } = await db.query("select * from position_holders where position_id = $1", [
      intern,
    ]);
    assert.equal(rows.length, 0, "the role should now be open");
  });

  test("an intern can change nothing", async () => {
    await actAs("levi-porter@newlifecanton.com");
    const students = await posId("hs-students");
    await db.query("update positions set title = 'Hacked' where id = $1", [students]);
    await asAdmin();
    const { rows } = await db.query<{ title: string }>(
      "select title from positions where id = $1",
      [students],
    );
    assert.equal(rows[0].title, "Students");
  });
});
