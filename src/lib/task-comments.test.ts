/** Discussion on a task. Visibility follows the task; authorship is protected. */

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
                   "0009_weekly_items", "0010_task_comments"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete
                   on tasks, task_assignees, task_comments to authenticated;`);
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

const comment = (taskId: string, authorId: string, body = "Looks good to me.") =>
  db.query(`insert into task_comments (task_id, author_id, body) values ($1,$2,$3)`,
    [taskId, authorId, body]);

describe("joining the discussion", () => {
  test("the owner can comment on their own task", async () => {
    const id = await zachTask();
    await comment(id, await idOf("zach-woodall"));
    const { rows } = await db.query("select * from task_comments");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("a tagged helper can comment", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);
    await actAs("levi-porter@newlifecanton.com");
    await comment(id, levi, "Which stage plot should I use?");
    const { rows } = await db.query("select * from task_comments");
    await asAdmin();
    assert.equal(rows.length, 1, "helpers must be able to ask questions");
  });

  test("someone unconnected to the task cannot comment", async () => {
    const id = await zachTask();
    const brandon = await idOf("brandon-ford");
    await actAs("brandon-ford@newlifecanton.com");
    await assert.rejects(() => comment(id, brandon), /policy/i);
    await asAdmin();
  });

  test("an empty comment is rejected", async () => {
    const id = await zachTask();
    const zach = await idOf("zach-woodall");
    await assert.rejects(() => comment(id, zach, "   "), /body/);
    await asAdmin();
  });

  test("you cannot post under someone else's name", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(() => comment(id, levi), /policy/i);
    await asAdmin();
  });
});

describe("reading", () => {
  test("an unconnected person sees no comments", async () => {
    const id = await zachTask();
    await comment(id, await idOf("zach-woodall"), "Internal chatter");
    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from task_comments");
    await asAdmin();
    assert.equal(rows.length, 0);
  });

  test("comments come back oldest first, so a thread reads in order", async () => {
    const id = await zachTask();
    const zach = await idOf("zach-woodall");
    await comment(id, zach, "First");
    await comment(id, zach, "Second");
    await comment(id, zach, "Third");
    const { rows } = await db.query<{ body: string }>(
      "select body from task_comments order by created_at, id",
    );
    await asAdmin();
    assert.deepEqual(rows.map((r) => r.body), ["First", "Second", "Third"]);
  });
});

describe("editing and removing", () => {
  test("you can edit your own comment", async () => {
    const id = await zachTask();
    await comment(id, await idOf("zach-woodall"), "Typo heer");
    await db.query(`update task_comments set body = 'Typo here', edited_at = now()`);
    const { rows } = await db.query<{ body: string }>("select body from task_comments");
    await asAdmin();
    assert.equal(rows[0].body, "Typo here");
  });

  test("nobody can edit someone else's words, not even the task owner", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);
    await actAs("levi-porter@newlifecanton.com");
    await comment(id, levi, "I disagree with this plan.");

    await actAs("zach@newlifecanton.com");
    await db.query(`update task_comments set body = 'I agree with this plan.'`);
    await asAdmin();
    const { rows } = await db.query<{ body: string }>("select body from task_comments");
    assert.equal(rows[0].body, "I disagree with this plan.", "an altered quote is worse than none");
  });

  test("the task owner can remove a comment from their board", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);
    await actAs("levi-porter@newlifecanton.com");
    await comment(id, levi, "Off-topic");

    await actAs("zach@newlifecanton.com");
    await db.query("delete from task_comments");
    await asAdmin();
    const { rows } = await db.query("select * from task_comments");
    assert.equal(rows.length, 0);
  });

  test("a helper cannot remove the owner's comment", async () => {
    const id = await zachTask();
    const zach = await idOf("zach-woodall");
    const levi = await idOf("levi-porter");
    await comment(id, zach, "Please use the blue backdrop.");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);

    await actAs("levi-porter@newlifecanton.com");
    await db.query("delete from task_comments");
    await asAdmin();
    const { rows } = await db.query("select * from task_comments");
    assert.equal(rows.length, 1);
  });

  test("deleting the task takes its discussion with it", async () => {
    const id = await zachTask();
    await comment(id, await idOf("zach-woodall"));
    await db.query("delete from tasks where id = $1", [id]);
    await asAdmin();
    const { rows } = await db.query("select * from task_comments");
    assert.equal(rows.length, 0);
  });
});
