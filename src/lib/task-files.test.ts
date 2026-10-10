/** Files attached to a task board. Permissions follow the task. */

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
                   "0006_org_editing", "0007_messages", "0008_task_files"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete
                   on tasks, task_assignees, task_checklist, task_files to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from tasks;");
});

async function zachTask() {
  const zach = await idOf("zach-woodall");
  await actAs("zach@newlifecanton.com");
  const { rows } = await db.query<{ id: string }>(
    `insert into tasks (title, owner_id, created_by) values ('Setlist', $1, $1) returning id`,
    [zach],
  );
  return rows[0].id;
}

const attach = (taskId: string, personId: string, name = "stage-plot.pdf", kind = "document") =>
  db.query(
    `insert into task_files (task_id, imagekit_file_id, name, url, kind, uploaded_by)
     values ($1, 'ik_123', $2, 'https://ik.example/f.pdf', $3, $4)`,
    [taskId, name, kind, personId],
  );

describe("attaching files", () => {
  test("the task owner can attach", async () => {
    const id = await zachTask();
    await attach(id, await idOf("zach-woodall"));
    const { rows } = await db.query("select * from task_files");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("a tagged helper can attach", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);

    await actAs("levi-porter@newlifecanton.com");
    await attach(id, levi, "lighting.png", "image");
    const { rows } = await db.query("select * from task_files");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("someone unconnected to the task cannot attach", async () => {
    const id = await zachTask();
    const brandon = await idOf("brandon-ford");
    await actAs("brandon-ford@newlifecanton.com");
    await assert.rejects(() => attach(id, brandon), /policy/i);
    await asAdmin();
  });

  test("you cannot attribute an upload to someone else", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(() => attach(id, levi), /policy/i);
    await asAdmin();
  });

  test("kind is limited to image, video or document", async () => {
    const id = await zachTask();
    const zach = await idOf("zach-woodall");
    await assert.rejects(() => attach(id, zach, "x.exe", "executable"), /kind/);
    await asAdmin();
  });
});

describe("seeing and removing files", () => {
  test("an unconnected person sees none", async () => {
    const id = await zachTask();
    await attach(id, await idOf("zach-woodall"));
    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from task_files");
    await asAdmin();
    assert.equal(rows.length, 0);
  });

  test("a helper can remove their own upload", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);
    await actAs("levi-porter@newlifecanton.com");
    await attach(id, levi);
    await db.query("delete from task_files");
    const { rows } = await db.query("select * from task_files");
    await asAdmin();
    assert.equal(rows.length, 0);
  });

  test("a helper cannot remove the owner's upload", async () => {
    const id = await zachTask();
    const zach = await idOf("zach-woodall");
    const levi = await idOf("levi-porter");
    await attach(id, zach);
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);

    await actAs("levi-porter@newlifecanton.com");
    await db.query("delete from task_files");
    await asAdmin();
    const { rows } = await db.query("select * from task_files");
    assert.equal(rows.length, 1, "the owner's file should survive");
  });

  test("deleting the task takes its files with it", async () => {
    const id = await zachTask();
    await attach(id, await idOf("zach-woodall"));
    await db.query("delete from tasks where id = $1", [id]);
    await asAdmin();
    const { rows } = await db.query("select * from task_files");
    assert.equal(rows.length, 0);
  });
});
