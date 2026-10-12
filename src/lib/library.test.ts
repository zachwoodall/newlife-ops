/** The shared files area: everyone, or one department you actually belong to. */

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
                   "0015_library"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete on library_files to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from library_files;");
});

const add = (uploader: string, dept: string | null = null, name = "logo.png") =>
  db.query(
    `insert into library_files (name, imagekit_file_id, url, kind, department, uploaded_by)
     values ($1,'ik_1','https://ik.example/a.png','image',$2,$3)`,
    [name, dept, uploader],
  );

async function zachDepartment() {
  await asAdmin();
  const { rows } = await db.query<{ department: string }>(
    `select distinct p.department from position_holders ph
       join positions p on p.id = ph.position_id
       join people pe on pe.id = ph.person_id
      where pe.key = 'zach-woodall' and p.department is not null limit 1`);
  return rows[0].department;
}

describe("contributing", () => {
  test("anyone on staff can add a file for everyone", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach);
    const { rows } = await db.query("select * from library_files");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you cannot attribute an upload to someone else", async () => {
    const levi = await idOf("levi-porter");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(() => add(levi), /policy/i);
    await asAdmin();
  });

  test("you cannot file something into a department you are not in", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () => add(zach, "A Department Zach Is Not In"),
      /policy/i,
      "naming a department must not be enough",
    );
    await asAdmin();
  });

  test("you can file into a department you are in", async () => {
    const dept = await zachDepartment();
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach, dept);
    const { rows } = await db.query("select * from library_files");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("an empty name is rejected", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(() => add(zach, null, "  "), /name/);
    await asAdmin();
  });
});

describe("who sees what", () => {
  test("an everyone file is visible to everyone", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach);
    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from library_files");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("a department file is hidden from other departments", async () => {
    const dept = await zachDepartment();
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach, dept, "worship-only.pdf");

    await asAdmin();
    const { rows: outsiders } = await db.query<{ email: string }>(
      `select pe.email from people pe
        where pe.id not in (
          select ph.person_id from position_holders ph
          join positions p on p.id = ph.position_id
          where p.department = $1
        ) and pe.email is not null limit 1`, [dept]);

    await actAs(outsiders[0].email);
    const { rows } = await db.query("select * from library_files");
    await asAdmin();
    assert.equal(rows.length, 0);
  });
});

describe("removal", () => {
  test("you can remove your own upload", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach);
    await db.query("delete from library_files");
    const { rows } = await db.query("select * from library_files");
    await asAdmin();
    assert.equal(rows.length, 0);
  });

  test("you cannot remove someone else's", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach);
    await actAs("brandon-ford@newlifecanton.com");
    await db.query("delete from library_files");
    await asAdmin();
    const { rows } = await db.query("select * from library_files");
    assert.equal(rows.length, 1);
  });
});
