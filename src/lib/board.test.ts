/** The project board: checklist items and co-assignment, against real Postgres. */

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

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  await db.exec(readFileSync("supabase/migrations/0001_org_structure.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
  await db.exec(readFileSync("supabase/migrations/0002_rls.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/0003_tasks.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/0004_task_board.sql", "utf8"));
  await db.exec(`
    grant select, insert, update, delete
      on tasks, task_assignees, task_checklist to authenticated;
  `);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from tasks;");
});

/** A task owned and created by Zach. */
async function zachTask(title = "Board task") {
  const zach = await idOf("zach-woodall");
  await actAs("zach@newlifecanton.com");
  const { rows } = await db.query<{ id: string }>(
    `insert into tasks (title, owner_id, created_by) values ($1, $2, $2) returning id`,
    [title, zach],
  );
  return rows[0].id;
}

describe("checklist", () => {
  test("the owner can add and tick items", async () => {
    const id = await zachTask();
    await db.query(
      `insert into task_checklist (task_id, label, sort_order)
       values ($1, 'Book the room', 0), ($1, 'Send the rota', 1)`,
      [id],
    );
    await db.query(
      `update task_checklist set done = true where task_id = $1 and label = 'Book the room'`,
      [id],
    );
    const { rows } = await db.query<{ label: string; done: boolean }>(
      "select label, done from task_checklist where task_id = $1 order by sort_order",
      [id],
    );
    await asAdmin();
    assert.deepEqual(rows, [
      { label: "Book the room", done: true },
      { label: "Send the rota", done: false },
    ]);
  });

  test("a tagged helper can tick items but not add them", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1, $2)`, [
      id,
      levi,
    ]);
    await db.query(`insert into task_checklist (task_id, label) values ($1, 'Set up')`, [id]);

    await actAs("levi-porter@newlifecanton.com");
    await db.query(`update task_checklist set done = true where task_id = $1`, [id]);
    const ticked = await db.query<{ done: boolean }>(
      "select done from task_checklist where task_id = $1",
      [id],
    );
    assert.equal(ticked.rows[0].done, true);

    await assert.rejects(
      () => db.query(`insert into task_checklist (task_id, label) values ($1, 'Sneaky')`, [id]),
      /policy/i,
    );
    await asAdmin();
  });

  test("an unrelated person sees no checklist at all", async () => {
    const id = await zachTask();
    await db.query(`insert into task_checklist (task_id, label) values ($1, 'Private')`, [id]);
    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from task_checklist");
    await asAdmin();
    assert.equal(rows.length, 0);
  });

  test("a blank label is rejected", async () => {
    const id = await zachTask();
    await assert.rejects(
      () => db.query(`insert into task_checklist (task_id, label) values ($1, '  ')`, [id]),
      /label/,
    );
    await asAdmin();
  });

  test("deleting a task takes its checklist with it", async () => {
    const id = await zachTask();
    await db.query(`insert into task_checklist (task_id, label) values ($1, 'Item')`, [id]);
    await db.query("delete from tasks where id = $1", [id]);
    await asAdmin();
    const { rows } = await db.query("select * from task_checklist");
    assert.equal(rows.length, 0);
  });
});

describe("co-assignment follows the org chart", () => {
  test("you can tag someone below you", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await db.query(
      `insert into task_assignees (task_id, person_id, role_label)
       values ($1, $2, 'Setup crew')`,
      [id, levi],
    );
    const { rows } = await db.query("select * from task_assignees where task_id = $1", [id]);
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("a campus lead can tag across reporting lines at their campus", async () => {
    const id = await zachTask();
    const john = await idOf("john-booth");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1, $2)`, [
      id,
      john,
    ]);
    const { rows } = await db.query("select * from task_assignees where task_id = $1", [id]);
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you cannot tag someone above you", async () => {
    const id = await zachTask();
    const jb = await idOf("jb-kitts");
    await assert.rejects(
      () => db.query(`insert into task_assignees (task_id, person_id) values ($1, $2)`, [id, jb]),
      /policy/i,
    );
    await asAdmin();
  });

  test("a tagged helper cannot tag others onto the task", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    const anna = await idOf("anna");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1, $2)`, [id, levi]);

    await actAs("levi-porter@newlifecanton.com");
    await assert.rejects(
      () => db.query(`insert into task_assignees (task_id, person_id) values ($1, $2)`, [id, anna]),
      /policy/i,
    );
    await asAdmin();
  });
});
