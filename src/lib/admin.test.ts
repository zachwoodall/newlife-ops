/** Administrator rights, and the guard against locking everyone out. */

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
                   "0015_library", "0016_checkins", "0018_admin"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete on people to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  // Exactly one administrator to start: Zach. Promote him first, so demoting
  // the others never momentarily leaves zero -- which the trigger refuses,
  // correctly.
  await db.exec(`update people set is_admin = true where key = 'zach-woodall';`);
  await db.exec(`update people set is_admin = false
                  where key <> 'zach-woodall' and is_admin;`);
  await db.exec(`update people set is_active = true, email = key || '@newlifecanton.com'
                  where key <> 'zach-woodall';`);
});

describe("is_admin()", () => {
  test("is true for an administrator", async () => {
    await actAs("zach@newlifecanton.com");
    const { rows } = await db.query<{ v: boolean }>("select is_admin() as v");
    await asAdmin();
    assert.equal(rows[0].v, true);
  });

  test("is false for everyone else", async () => {
    await actAs("levi-porter@newlifecanton.com");
    const { rows } = await db.query<{ v: boolean }>("select is_admin() as v");
    await asAdmin();
    assert.equal(rows[0].v, false);
  });
});

describe("granting and revoking", () => {
  test("an administrator can set someone's email address", async () => {
    const levi = await idOf("levi-porter");
    await actAs("zach@newlifecanton.com");
    await db.query("update people set email = $1 where id = $2",
      ["levi.new@newlifecanton.com", levi]);
    const { rows } = await db.query<{ email: string }>(
      "select email from people where id = $1", [levi]);
    await asAdmin();
    assert.equal(rows[0].email, "levi.new@newlifecanton.com");
  });

  test("an administrator can deactivate someone", async () => {
    const levi = await idOf("levi-porter");
    await actAs("zach@newlifecanton.com");
    await db.query("update people set is_active = false where id = $1", [levi]);
    const { rows } = await db.query<{ is_active: boolean }>(
      "select is_active from people where id = $1", [levi]);
    await asAdmin();
    assert.equal(rows[0].is_active, false);
  });

  test("a non-administrator cannot make themselves one", async () => {
    const levi = await idOf("levi-porter");
    await actAs("levi-porter@newlifecanton.com");
    await db.query("update people set is_admin = true where id = $1", [levi]);
    await asAdmin();
    const { rows } = await db.query<{ is_admin: boolean }>(
      "select is_admin from people where id = $1", [levi]);
    assert.equal(rows[0].is_admin, false, "self-promotion must be impossible");
  });

  test("a non-administrator cannot deactivate someone above them", async () => {
    const allan = await idOf("allan-malloy");
    await actAs("levi-porter@newlifecanton.com");
    await db.query("update people set is_active = false where id = $1", [allan]);
    await asAdmin();
    const { rows } = await db.query<{ is_active: boolean }>(
      "select is_active from people where id = $1", [allan]);
    assert.equal(rows[0].is_active, true);
  });
});

describe("never locking everyone out", () => {
  test("the only administrator cannot be demoted", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () => db.query("update people set is_admin = false where id = $1", [zach]),
      /at least one administrator/,
    );
    await asAdmin();
  });

  test("once there are two, either may be demoted", async () => {
    const zach = await idOf("zach-woodall");
    const allan = await idOf("allan-malloy");
    await actAs("zach@newlifecanton.com");
    await db.query("update people set is_admin = true where id = $1", [allan]);
    await db.query("update people set is_admin = false where id = $1", [zach]);
    await asAdmin();
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from people where is_admin");
    assert.equal(rows[0].n, 1, "one administrator remains");
  });

  test("the guard holds even against a direct database write", async () => {
    await asAdmin();
    await assert.rejects(
      () => db.query("update people set is_admin = false where is_admin"),
      /at least one administrator/,
      "enforced in the database, not only in the UI",
    );
  });
});
