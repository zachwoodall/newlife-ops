/** Reactions: cheap acknowledgement, visible wherever their subject is. */

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
                   "0012_announcements", "0013_calendar", "0014_reactions"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete
                   on tasks, task_assignees, task_comments, announcements,
                      announcement_replies, reactions to authenticated;`);
  await db.exec(`grant select, update, delete on notifications to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from tasks; delete from announcements; delete from reactions;");
});

async function aComment() {
  const zach = await idOf("zach-woodall");
  await actAs("zach@newlifecanton.com");
  const { rows: t } = await db.query<{ id: string }>(
    `insert into tasks (title, owner_id, created_by) values ('Setlist',$1,$1) returning id`,
    [zach]);
  const { rows: c } = await db.query<{ id: string }>(
    `insert into task_comments (task_id, author_id, body) values ($1,$2,'Ready') returning id`,
    [t[0].id, zach]);
  return { taskId: t[0].id, commentId: c[0].id, zach };
}

describe("reacting", () => {
  test("you can react to a comment", async () => {
    const { commentId, zach } = await aComment();
    await db.query(
      `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'👍')`,
      [zach, commentId]);
    const { rows } = await db.query("select * from reactions");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("the same emoji twice from one person is rejected", async () => {
    const { commentId, zach } = await aComment();
    await db.query(
      `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'👍')`,
      [zach, commentId]);
    await assert.rejects(
      () => db.query(
        `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'👍')`,
        [zach, commentId]),
      /duplicate key|unique/i);
    await asAdmin();
  });

  test("a different emoji from the same person is fine", async () => {
    const { commentId, zach } = await aComment();
    await db.query(
      `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'👍')`, [zach, commentId]);
    await db.query(
      `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'🎉')`, [zach, commentId]);
    const { rows } = await db.query("select * from reactions");
    await asAdmin();
    assert.equal(rows.length, 2);
  });

  test("you cannot react as someone else", async () => {
    const { commentId } = await aComment();
    const levi = await idOf("levi-porter");
    await assert.rejects(
      () => db.query(
        `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'👍')`,
        [levi, commentId]),
      /policy/i);
    await asAdmin();
  });

  test("a reaction must attach to exactly one thing", async () => {
    const { zach } = await aComment();
    // Rejected either by the check constraint or by the insert policy, whose
    // existence branches cannot be satisfied with no subject. Which guard
    // fires first is an implementation detail; being rejected is the point.
    await assert.rejects(
      () => db.query(
        `insert into reactions (person_id, emoji) values ($1,'👍')`, [zach]),
      /exactly_one_subject|policy/i);
    await asAdmin();
  });

  test("it cannot attach to two things at once", async () => {
    const { commentId, zach } = await aComment();
    const { rows: a } = await db.query<{ id: string }>(
      `insert into announcements (author_id, title, body) values ($1,'Hi','There') returning id`,
      [zach]);
    await assert.rejects(
      () => db.query(
        `insert into reactions (person_id, comment_id, announcement_id, emoji)
         values ($1,$2,$3,'👍')`, [zach, commentId, a[0].id]),
      /exactly_one_subject/);
    await asAdmin();
  });
});

describe("visibility and removal", () => {
  test("someone who cannot see the task cannot see its reactions", async () => {
    const { commentId, zach } = await aComment();
    await db.query(
      `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'👍')`,
      [zach, commentId]);

    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from reactions");
    await asAdmin();
    assert.equal(rows.length, 0, "visibility follows the subject");
  });

  test("you can take your own reaction back", async () => {
    const { commentId, zach } = await aComment();
    await db.query(
      `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'👍')`,
      [zach, commentId]);
    await db.query("delete from reactions");
    const { rows } = await db.query("select * from reactions");
    await asAdmin();
    assert.equal(rows.length, 0);
  });

  test("nobody can remove someone else's reaction", async () => {
    const { taskId, commentId, zach } = await aComment();
    await db.query(
      `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'👍')`,
      [zach, commentId]);
    const levi = await idOf("levi-porter");
    await db.query(`insert into task_assignees (task_id, person_id) values ($1,$2)`,
      [taskId, levi]);

    await actAs("levi-porter@newlifecanton.com");
    await db.query("delete from reactions");
    await asAdmin();
    const { rows } = await db.query("select * from reactions");
    assert.equal(rows.length, 1);
  });

  test("deleting the comment takes its reactions with it", async () => {
    const { commentId, zach } = await aComment();
    await db.query(
      `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'👍')`,
      [zach, commentId]);
    await db.query("delete from task_comments where id = $1", [commentId]);
    await asAdmin();
    const { rows } = await db.query("select * from reactions");
    assert.equal(rows.length, 0);
  });

  test("reacting never creates a notification", async () => {
    const { commentId, zach } = await aComment();
    await asAdmin();
    await db.query("delete from notifications");
    await actAs("zach@newlifecanton.com");
    await db.query(
      `insert into reactions (person_id, comment_id, emoji) values ($1,$2,'👍')`,
      [zach, commentId]);
    await asAdmin();
    const { rows } = await db.query("select * from notifications");
    assert.equal(rows.length, 0, "the point is a signal too cheap to interrupt");
  });
});
