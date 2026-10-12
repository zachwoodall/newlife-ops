/** Announcements: posted once, to everyone or one department, with replies. */

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
                   "0012_announcements"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete
                   on announcements, announcement_replies to authenticated;`);
  await db.exec(`grant select, update, delete on notifications to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from announcements; delete from notifications;");
});

const postAll = (authorId: string, title = "Lunch moved") =>
  db.query<{ id: string }>(
    `insert into announcements (author_id, title, body, audience)
     values ($1, $2, 'Details inside.', 'all') returning id`,
    [authorId, title],
  );

const postDept = (authorId: string, dept: string, title = "Dept note") =>
  db.query<{ id: string }>(
    `insert into announcements (author_id, title, body, audience, department)
     values ($1, $2, 'Details inside.', 'department', $3) returning id`,
    [authorId, title, dept],
  );

/** A department that Zach actually holds a position in. */
async function zachDepartment() {
  await asAdmin();
  const { rows } = await db.query<{ department: string }>(
    `select distinct p.department
       from position_holders ph
       join positions p on p.id = ph.position_id
       join people pe on pe.id = ph.person_id
      where pe.key = 'zach-woodall' and p.department is not null
      limit 1`,
  );
  return rows[0]?.department;
}

describe("posting", () => {
  test("anyone on staff can post to everyone", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await postAll(zach);
    const { rows } = await db.query("select * from announcements");
    await asAdmin();
    assert.equal(rows.length, 1, "information does not only flow downward");
  });

  test("you cannot post under someone else's name", async () => {
    const allan = await idOf("allan-malloy");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(() => postAll(allan), /policy/i);
    await asAdmin();
  });

  test("an all-staff post may not name a department", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () => db.query(
        `insert into announcements (author_id, title, body, audience, department)
         values ($1, 'x', 'y', 'all', 'Worship')`, [zach]),
      /audience_matches_department/);
    await asAdmin();
  });

  test("a department post must name one", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () => db.query(
        `insert into announcements (author_id, title, body, audience)
         values ($1, 'x', 'y', 'department')`, [zach]),
      /audience_matches_department/);
    await asAdmin();
  });

  test("an empty title is rejected", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(() => postAll(zach, "   "), /title/);
    await asAdmin();
  });
});

describe("who sees what", () => {
  test("everyone sees an all-staff announcement", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await postAll(zach);

    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from announcements");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("a department post is hidden from other departments", async () => {
    const dept = await zachDepartment();
    assert.ok(dept, "seed should give Zach a department");
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await postDept(zach, dept!);

    // Someone whose positions are in no such department.
    await asAdmin();
    const { rows: outsiders } = await db.query<{ email: string }>(
      `select pe.email from people pe
        where pe.id not in (
          select ph.person_id from position_holders ph
          join positions p on p.id = ph.position_id
          where p.department = $1
        ) and pe.email is not null limit 1`, [dept]);

    await actAs(outsiders[0].email);
    const { rows } = await db.query("select * from announcements");
    await asAdmin();
    assert.equal(rows.length, 0, "other departments should not see it");
  });

  test("the department sees its own post", async () => {
    const dept = await zachDepartment();
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await postDept(zach, dept!);
    const { rows } = await db.query("select * from announcements");
    await asAdmin();
    assert.equal(rows.length, 1);
  });
});

describe("replies", () => {
  test("anyone who sees it can reply, and replies read in order", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    const { rows: a } = await postAll(zach);
    const brandon = await idOf("brandon-ford");

    await actAs("brandon-ford@newlifecanton.com");
    await db.query(
      `insert into announcement_replies (announcement_id, author_id, body)
       values ($1,$2,'What time?')`, [a[0].id, brandon]);
    const { rows } = await db.query<{ body: string }>(
      "select body from announcement_replies order by created_at");
    await asAdmin();
    assert.deepEqual(rows.map((r) => r.body), ["What time?"]);
  });

  test("withdrawing an announcement takes its replies with it", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    const { rows: a } = await postAll(zach);
    await db.query(
      `insert into announcement_replies (announcement_id, author_id, body)
       values ($1,$2,'Noted')`, [a[0].id, zach]);
    await db.query("delete from announcements");
    const { rows } = await db.query("select * from announcement_replies");
    await asAdmin();
    assert.equal(rows.length, 0);
  });
});

describe("notifications", () => {
  test("an all-staff post tells everyone except the author", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await postAll(zach, "Staff meeting Thursday");

    await asAdmin();
    const { rows: all } = await db.query<{ n: number }>(
      "select count(*)::int as n from notifications where kind = 'announcement'");
    const { rows: people } = await db.query<{ n: number }>(
      "select count(*)::int as n from people");
    const { rows: mine } = await db.query<{ n: number }>(
      "select count(*)::int as n from notifications where person_id = $1", [zach]);

    assert.equal(all[0].n, people[0].n - 1, "everyone but the author");
    assert.equal(mine[0].n, 0, "the author is not told about their own post");
  });

  test("a department post only tells that department", async () => {
    const dept = await zachDepartment();
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await postDept(zach, dept!, "Worship note");

    await asAdmin();
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from notifications
        where person_id not in (
          select ph.person_id from position_holders ph
          join positions p on p.id = ph.position_id
          where p.department = $1
        )`, [dept]);
    assert.equal(rows[0].n, 0, "nobody outside the department should be told");
  });
});
