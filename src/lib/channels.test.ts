/** Channels: rooms with members, and one that is everyone by definition. */

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
  await db.exec(`create schema if not exists auth;
                 create table if not exists auth.users (id uuid primary key, email text);`);
  for (const m of ["0002_rls", "0003_tasks", "0004_task_board", "0005_recurrence",
                   "0006_org_editing", "0007_messages", "0008_task_files",
                   "0009_weekly_items", "0010_task_comments", "0011_notifications",
                   "0012_announcements", "0013_calendar", "0014_reactions",
                   "0015_library", "0016_checkins", "0018_admin", "0019_channels"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete
                   on channels, channel_members, channel_messages, channel_reads
                   to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from channels where name <> 'All staff';");
  await db.exec("delete from channel_messages;");
  // Admin rights are granted by individual tests; reset so they do not leak.
  // The last-administrator guard from 0018 would refuse a blanket clear, and
  // rightly so, which is why it is lifted only for this setup.
  await db.exec("alter table people disable trigger keep_one_admin;");
  await db.exec("update people set is_admin = false;");
  await db.exec("alter table people enable trigger keep_one_admin;");
});

const allStaffChannel = async () => {
  await asAdmin();
  const { rows } = await db.query<{ id: string }>(
    "select id from channels where name = 'All staff' limit 1");
  return rows[0].id;
};

async function privateChannel(ownerEmail: string, ownerKey: string, name = "Worship team") {
  const owner = await idOf(ownerKey);
  await actAs(ownerEmail);
  const { rows } = await db.query<{ id: string }>(
    `insert into channels (name, created_by) values ($1,$2) returning id`, [name, owner]);
  await db.query(`insert into channel_members (channel_id, person_id) values ($1,$2)`,
    [rows[0].id, owner]);
  return rows[0].id;
}

describe("the all-staff channel", () => {
  test("exists after the migration, with everyone in it", async () => {
    await asAdmin();
    const { rows } = await db.query<{ members: number; people: number }>(
      `select (select count(*) from channel_members m
                join channels c on c.id = m.channel_id
               where c.name = 'All staff')::int as members,
              (select count(*) from people)::int as people`);
    assert.equal(rows[0].members, rows[0].people, "everyone on the books is a member");
  });

  test("a member can post, and the other members see it", async () => {
    const id = await allStaffChannel();
    const levi = await idOf("levi-porter");
    await actAs("levi-porter@newlifecanton.com");
    await db.query(
      `insert into channel_messages (channel_id, sender_id, body) values ($1,$2,'Morning all')`,
      [id, levi]);

    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query<{ body: string }>("select body from channel_messages");
    await asAdmin();
    assert.equal(rows[0].body, "Morning all");
  });

  test("a new person is NOT added automatically -- they must be invited", async () => {
    await asAdmin();
    const { rows: added } = await db.query<{ email: string }>(
      `insert into people (key, full_name, email)
       values ('new-hire', 'New Hire', 'new-hire@newlifecanton.com') returning email`);
    await actAs(added[0].email);
    const { rows } = await db.query("select id from channels");
    await asAdmin();
    await db.query("delete from people where key = 'new-hire'");
    assert.equal(rows.length, 0, "an explicit list means somebody has to add them");
  });

  test("an administrator can rename it, though nobody created it", async () => {
    const id = await allStaffChannel();
    await asAdmin();
    await db.exec(`update people set is_admin = true where key = 'zach-woodall';`);
    await actAs("zach@newlifecanton.com");
    await db.query("update channels set name = 'Whole team' where id = $1", [id]);
    await asAdmin();
    const { rows } = await db.query<{ name: string }>(
      "select name from channels where id = $1", [id]);
    await db.query("update channels set name = 'All staff' where id = $1", [id]);
    assert.equal(rows[0].name, "Whole team");
  });

  test("an ordinary member cannot rename it", async () => {
    const id = await allStaffChannel();
    await asAdmin();
    await db.exec(`update people set is_admin = false where key = 'levi-porter';`);
    await actAs("levi-porter@newlifecanton.com");
    await db.query("update channels set name = 'Hijacked' where id = $1", [id]);
    await asAdmin();
    const { rows } = await db.query<{ name: string }>(
      "select name from channels where id = $1", [id]);
    assert.equal(rows[0].name, "All staff");
  });

  test("an administrator can remove someone from it", async () => {
    const id = await allStaffChannel();
    const brandon = await idOf("brandon-ford");
    await db.exec(`update people set is_admin = true where key = 'zach-woodall';`);
    await actAs("zach@newlifecanton.com");
    await db.query("delete from channel_members where channel_id = $1 and person_id = $2",
      [id, brandon]);

    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select id from channels where id = $1", [id]);
    await asAdmin();
    await db.query(`insert into channel_members (channel_id, person_id) values ($1,$2)
                    on conflict do nothing`, [id, brandon]);
    assert.equal(rows.length, 0, "removed means they can no longer see it");
  });
});

describe("private channels", () => {
  test("a member can see it and post", async () => {
    const id = await privateChannel("zach@newlifecanton.com", "zach-woodall");
    const zach = await idOf("zach-woodall");
    await db.query(
      `insert into channel_messages (channel_id, sender_id, body) values ($1,$2,'Setlist?')`,
      [id, zach]);
    const { rows } = await db.query("select * from channel_messages");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("a non-member cannot see the channel at all", async () => {
    await privateChannel("zach@newlifecanton.com", "zach-woodall");
    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from channels where name <> 'All staff'");
    await asAdmin();
    assert.equal(rows.length, 0);
  });

  test("a non-member cannot read its messages", async () => {
    const id = await privateChannel("zach@newlifecanton.com", "zach-woodall");
    const zach = await idOf("zach-woodall");
    await db.query(
      `insert into channel_messages (channel_id, sender_id, body) values ($1,$2,'Private')`,
      [id, zach]);

    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from channel_messages");
    await asAdmin();
    assert.equal(rows.length, 0);
  });

  test("a non-member cannot post into it", async () => {
    const id = await privateChannel("zach@newlifecanton.com", "zach-woodall");
    const brandon = await idOf("brandon-ford");
    await actAs("brandon-ford@newlifecanton.com");
    await assert.rejects(
      () => db.query(
        `insert into channel_messages (channel_id, sender_id, body) values ($1,$2,'Hello')`,
        [id, brandon]),
      /policy/i);
    await asAdmin();
  });

  test("a member can bring someone in, and they then see the history", async () => {
    const id = await privateChannel("zach@newlifecanton.com", "zach-woodall");
    const zach = await idOf("zach-woodall");
    const levi = await idOf("levi-porter");
    await db.query(
      `insert into channel_messages (channel_id, sender_id, body) values ($1,$2,'Earlier')`,
      [id, zach]);
    await db.query(`insert into channel_members (channel_id, person_id) values ($1,$2)`,
      [id, levi]);

    await actAs("levi-porter@newlifecanton.com");
    const { rows } = await db.query<{ body: string }>("select body from channel_messages");
    await asAdmin();
    assert.equal(rows[0].body, "Earlier", "joining shows what was said before");
  });

  test("you cannot post as someone else", async () => {
    const id = await privateChannel("zach@newlifecanton.com", "zach-woodall");
    const levi = await idOf("levi-porter");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () => db.query(
        `insert into channel_messages (channel_id, sender_id, body) values ($1,$2,'Not mine')`,
        [id, levi]),
      /policy/i);
    await asAdmin();
  });

  test("you can delete your own message but not someone else's", async () => {
    const id = await privateChannel("zach@newlifecanton.com", "zach-woodall");
    const zach = await idOf("zach-woodall");
    const levi = await idOf("levi-porter");
    await db.query(`insert into channel_members (channel_id, person_id) values ($1,$2)`,
      [id, levi]);
    await db.query(
      `insert into channel_messages (channel_id, sender_id, body) values ($1,$2,'Zach said this')`,
      [id, zach]);

    await actAs("levi-porter@newlifecanton.com");
    await db.query("delete from channel_messages");
    await asAdmin();
    const { rows } = await db.query("select * from channel_messages");
    assert.equal(rows.length, 1, "another member cannot delete your words");
  });

  test("leaving removes only yourself", async () => {
    const id = await privateChannel("zach@newlifecanton.com", "zach-woodall");
    const levi = await idOf("levi-porter");
    await db.query(`insert into channel_members (channel_id, person_id) values ($1,$2)`,
      [id, levi]);

    await actAs("levi-porter@newlifecanton.com");
    await db.query("delete from channel_members");
    await asAdmin();
    const { rows } = await db.query("select person_id from channel_members where channel_id = $1",
      [id]);
    assert.equal(rows.length, 1, "the owner is still a member");
  });
});

describe("unread tracking", () => {
  test("your read position is yours alone", async () => {
    const id = await allStaffChannel();
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await db.query(
      `insert into channel_reads (channel_id, person_id) values ($1,$2)`, [id, zach]);

    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from channel_reads");
    await asAdmin();
    assert.equal(rows.length, 0, "nobody sees where anyone else has read to");
  });
});
