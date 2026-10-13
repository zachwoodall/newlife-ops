/** Folders organise files. They do not change who can see them. */

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
                   "0015_library", "0016_checkins", "0018_admin", "0019_channels",
                   "0020_library_folders"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete
                   on library_files, library_folders to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from library_folders; delete from library_files;");
  await db.exec("alter table people disable trigger keep_one_admin;");
  await db.exec("update people set is_admin = false;");
  await db.exec("alter table people enable trigger keep_one_admin;");
});

async function zachDepartment() {
  await asAdmin();
  const { rows } = await db.query<{ department: string }>(
    `select distinct p.department from position_holders ph
       join positions p on p.id = ph.position_id
       join people pe on pe.id = ph.person_id
      where pe.key = 'zach-woodall' and p.department is not null limit 1`);
  return rows[0].department;
}

const makeFolder = (owner: string, dept: string | null = null, name = "Training") =>
  db.query<{ id: string }>(
    `insert into library_folders (name, department, created_by) values ($1,$2,$3) returning id`,
    [name, dept, owner]);

const putFile = (owner: string, folderId: string | null, dept: string | null = null) =>
  db.query(
    `insert into library_files (name, imagekit_file_id, url, kind, department, folder_id, uploaded_by)
     values ('guide.pdf','ik_1','https://ik.example/a.pdf','document',$1,$2,$3)`,
    [dept, folderId, owner]);

describe("creating folders", () => {
  test("anyone can make one for everyone", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await makeFolder(zach);
    const { rows } = await db.query("select * from library_folders");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you can make one for a department you are in", async () => {
    const dept = await zachDepartment();
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await makeFolder(zach, dept, "Worship training");
    const { rows } = await db.query("select * from library_folders");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you cannot make one for a department you are not in", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(() => makeFolder(zach, "Not My Department"), /policy/i);
    await asAdmin();
  });

  test("an empty name is rejected", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(() => makeFolder(zach, null, "   "), /name/);
    await asAdmin();
  });
});

describe("who sees a folder", () => {
  test("an everyone folder is visible to everyone", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await makeFolder(zach);
    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from library_folders");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("a department folder is hidden from other departments", async () => {
    const dept = await zachDepartment();
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await makeFolder(zach, dept, "Worship only");

    await asAdmin();
    const { rows: outsiders } = await db.query<{ email: string }>(
      `select pe.email from people pe
        where pe.id not in (
          select ph.person_id from position_holders ph
          join positions p on p.id = ph.position_id where p.department = $1
        ) and pe.email is not null limit 1`, [dept]);

    await actAs(outsiders[0].email);
    const { rows } = await db.query("select * from library_folders");
    await asAdmin();
    assert.equal(rows.length, 0);
  });
});

describe("folders organise, they do not grant access", () => {
  test("an everyone file in a department folder is still visible to everyone", async () => {
    const dept = await zachDepartment();
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    const { rows: f } = await makeFolder(zach, dept, "Worship training");
    // The file itself is for everyone, even though the folder is not.
    await putFile(zach, f[0].id, null);

    await asAdmin();
    const { rows: outsiders } = await db.query<{ email: string }>(
      `select pe.email from people pe
        where pe.id not in (
          select ph.person_id from position_holders ph
          join positions p on p.id = ph.position_id where p.department = $1
        ) and pe.email is not null limit 1`, [dept]);

    await actAs(outsiders[0].email);
    const { rows } = await db.query("select * from library_files");
    await asAdmin();
    assert.equal(rows.length, 1, "the file's own audience governs, not the folder's");
  });

  test("a department file is hidden even in an everyone folder", async () => {
    const dept = await zachDepartment();
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    const { rows: f } = await makeFolder(zach, null, "Open folder");
    await putFile(zach, f[0].id, dept);

    await asAdmin();
    const { rows: outsiders } = await db.query<{ email: string }>(
      `select pe.email from people pe
        where pe.id not in (
          select ph.person_id from position_holders ph
          join positions p on p.id = ph.position_id where p.department = $1
        ) and pe.email is not null limit 1`, [dept]);

    await actAs(outsiders[0].email);
    const { rows } = await db.query("select * from library_files");
    await asAdmin();
    assert.equal(rows.length, 0, "an open folder must not expose a restricted file");
  });
});

describe("removing a folder", () => {
  test("the files survive and become unfiled", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    const { rows: f } = await makeFolder(zach);
    await putFile(zach, f[0].id);
    await db.query("delete from library_folders where id = $1", [f[0].id]);

    const { rows } = await db.query<{ folder_id: string | null }>(
      "select folder_id from library_files");
    await asAdmin();
    assert.equal(rows.length, 1, "the file is not deleted with the folder");
    assert.equal(rows[0].folder_id, null, "it falls back to unfiled");
  });

  test("you cannot remove someone else's folder", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await makeFolder(zach);
    await actAs("brandon-ford@newlifecanton.com");
    await db.query("delete from library_folders");
    await asAdmin();
    const { rows } = await db.query("select * from library_folders");
    assert.equal(rows.length, 1);
  });

  test("an administrator can tidy up anyone's folder", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await makeFolder(zach);
    await asAdmin();
    await db.exec("update people set is_admin = true where key = 'brandon-ford';");
    await actAs("brandon-ford@newlifecanton.com");
    await db.query("delete from library_folders");
    await asAdmin();
    const { rows } = await db.query("select * from library_folders");
    assert.equal(rows.length, 0);
  });
});

describe("cover images", () => {
  test("a custom cover is stored separately from the generated thumbnail", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await db.query(
      `insert into library_files
         (name, imagekit_file_id, url, thumbnail_url, kind, uploaded_by, cover_url, cover_file_id)
       values ('training.mp4','ik_1','https://ik.example/a.mp4',
               'https://ik.example/a.mp4/ik-thumbnail.jpg','video',$1,
               'https://ik.example/cover.png','ik_cover')`,
      [zach]);
    const { rows } = await db.query<{ thumbnail_url: string; cover_url: string }>(
      "select thumbnail_url, cover_url from library_files");
    await asAdmin();
    assert.equal(rows[0].cover_url, "https://ik.example/cover.png");
    assert.ok(
      rows[0].thumbnail_url.includes("ik-thumbnail"),
      "the generated thumbnail is kept, so removing the cover can fall back to it",
    );
  });

  test("a file with no cover is fine", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await db.query(
      `insert into library_files (name, imagekit_file_id, url, kind, uploaded_by)
       values ('notes.pdf','ik_2','https://ik.example/n.pdf','document',$1)`, [zach]);
    const { rows } = await db.query<{ cover_url: string | null }>(
      "select cover_url from library_files");
    await asAdmin();
    assert.equal(rows[0].cover_url, null);
  });
});
