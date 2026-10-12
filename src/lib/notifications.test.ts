/**
 * Notifications are written by database triggers, so they happen whatever
 * route the work arrives by. They are also strictly private.
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
                   "0009_weekly_items", "0010_task_comments", "0011_notifications"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete
                   on tasks, task_assignees, task_comments, messages to authenticated;`);
  await db.exec(`grant select, update, delete on notifications to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from tasks; delete from messages; delete from notifications;");
});

async function zachTask(title = "Setlist") {
  const zach = await idOf("zach-woodall");
  await actAs("zach@newlifecanton.com");
  const { rows } = await db.query<{ id: string }>(
    `insert into tasks (title, owner_id, created_by) values ($1, $2, $2) returning id`,
    [title, zach],
  );
  return rows[0].id;
}

const notesFor = async (key: string) => {
  await asAdmin();
  const id = await idOf(key);
  const { rows } = await db.query<{ kind: string; summary: string; url: string }>(
    `select kind, summary, url from notifications where person_id = $1 order by created_at`,
    [id],
  );
  return rows;
};

describe("being tagged on a task", () => {
  test("the helper is told, with who and which task", async () => {
    const id = await zachTask("Sunday setlist");
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);

    const notes = await notesFor("levi-porter");
    assert.equal(notes.length, 1);
    assert.equal(notes[0].kind, "assigned");
    assert.match(notes[0].summary, /Zach Woodall tagged you on "Sunday setlist"/);
    assert.equal(notes[0].url, `/tasks/${id}`);
  });

  test("tagging yourself is not news", async () => {
    const id = await zachTask();
    const zach = await idOf("zach-woodall");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, zach]);
    assert.equal((await notesFor("zach-woodall")).length, 0);
  });
});

describe("comments", () => {
  test("the task owner hears about a helper's comment", async () => {
    const id = await zachTask("Stage plot");
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);
    await asAdmin();
    await db.query("delete from notifications");

    await actAs("levi-porter@newlifecanton.com");
    await db.query(`insert into task_comments (task_id, author_id, body) values ($1,$2,'Question')`,
      [id, levi]);

    const notes = await notesFor("zach-woodall");
    assert.equal(notes.length, 1);
    assert.match(notes[0].summary, /Levi Porter commented on "Stage plot"/);
  });

  test("your own comment never notifies you", async () => {
    const id = await zachTask();
    const zach = await idOf("zach-woodall");
    await db.query(`insert into task_comments (task_id, author_id, body) values ($1,$2,'Note')`,
      [id, zach]);
    assert.equal((await notesFor("zach-woodall")).length, 0);
  });

  test("every tagged helper hears, not just the owner", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    const john = await idOf("john-booth");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2),($1,$3)`,
      [id, levi, john]);
    await asAdmin();
    await db.query("delete from notifications");

    await actAs("levi-porter@newlifecanton.com");
    await db.query(`insert into task_comments (task_id, author_id, body) values ($1,$2,'Hi')`,
      [id, levi]);

    assert.equal((await notesFor("john-booth")).length, 1, "the other helper should hear");
    assert.equal((await notesFor("zach-woodall")).length, 1, "the owner should hear");
    assert.equal((await notesFor("levi-porter")).length, 0, "the author should not");
  });
});

describe("messages", () => {
  test("the recipient is told and linked to the thread", async () => {
    const zach = await idOf("zach-woodall");
    const allan = await idOf("allan-malloy");
    await actAs("zach@newlifecanton.com");
    await db.query(`insert into messages (sender_id, recipient_id, body) values ($1,$2,'Hello')`,
      [zach, allan]);

    const notes = await notesFor("allan-malloy");
    assert.equal(notes.length, 1);
    assert.equal(notes[0].kind, "message");
    assert.equal(notes[0].url, `/messages/${zach}`);
  });
});

describe("privacy", () => {
  test("you cannot read someone else's notifications", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);

    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from notifications");
    await asAdmin();
    assert.equal(rows.length, 0);
  });

  test("nobody can invent a notification for someone else", async () => {
    const brandon = await idOf("brandon-ford");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () => db.query(
        `insert into notifications (person_id, kind, summary, url)
         values ($1, 'message', 'You are fired', '/')`, [brandon]),
      /policy|permission/i,
      "there is no insert policy, so clients cannot fabricate alerts",
    );
    await asAdmin();
  });

  test("you can mark your own as read", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);

    await actAs("levi-porter@newlifecanton.com");
    await db.query("update notifications set read_at = now()");
    const { rows } = await db.query<{ read_at: string | null }>("select read_at from notifications");
    await asAdmin();
    assert.ok(rows[0].read_at, "marking read should stick");
  });

  test("you cannot mark someone else's as read", async () => {
    const id = await zachTask();
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`, [id, levi]);

    await actAs("brandon-ford@newlifecanton.com");
    await db.query("update notifications set read_at = now()");
    await asAdmin();
    const { rows } = await db.query<{ read_at: string | null }>("select read_at from notifications");
    assert.equal(rows[0].read_at, null);
  });
});
