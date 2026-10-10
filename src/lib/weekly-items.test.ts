/** The weekly board is private to each person, including from their leader. */

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
                   "0009_weekly_items"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete on weekly_items to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from weekly_items;");
});

const add = (personId: string, title: string, order = 0) =>
  db.query(
    `insert into weekly_items (person_id, title, sort_order) values ($1, $2, $3)`,
    [personId, title, order],
  );

describe("keeping your own list", () => {
  test("you can add and read your own items", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach, "Confirm Sunday setlist");
    const { rows } = await db.query("select title from weekly_items");
    await asAdmin();
    assert.deepEqual(rows, [{ title: "Confirm Sunday setlist" }]);
  });

  test("a blank title is rejected", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(() => add(zach, "   "), /title/);
    await asAdmin();
  });

  test("you cannot put an item on someone else's list", async () => {
    const levi = await idOf("levi-porter");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(() => add(levi, "Not yours"), /policy/i);
    await asAdmin();
  });
});

describe("privacy", () => {
  test("a peer cannot see your list", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach, "Private reminder");

    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from weekly_items");
    await asAdmin();
    assert.equal(rows.length, 0);
  });

  test("even your leader cannot see it", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach, "Private reminder");

    // JB leads Zach and can assign him tasks, but this list is still his own.
    await actAs("jb-kitts@newlifecanton.com");
    const { rows } = await db.query("select * from weekly_items");
    await asAdmin();
    assert.equal(rows.length, 0, "the weekly board is personal");
  });

  test("a leader cannot check off your items either", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach, "Private reminder");

    await actAs("jb-kitts@newlifecanton.com");
    await db.query(`update weekly_items set checked_week = '2026-10-04'`);
    await asAdmin();
    const { rows } = await db.query<{ checked_week: string | null }>(
      "select checked_week from weekly_items",
    );
    assert.equal(rows[0].checked_week, null);
  });

  test("a leader cannot delete your items", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach, "Private reminder");

    await actAs("jb-kitts@newlifecanton.com");
    await db.query("delete from weekly_items");
    await asAdmin();
    const { rows } = await db.query("select * from weekly_items");
    assert.equal(rows.length, 1);
  });
});

describe("checking off and resetting", () => {
  test("checking stores the week rather than a boolean", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach, "Confirm setlist");
    await db.query(`update weekly_items set checked_week = '2026-10-04'`);
    const { rows } = await db.query<{ checked_week: string }>(
      "select checked_week::text from weekly_items",
    );
    await asAdmin();
    assert.equal(rows[0].checked_week, "2026-10-04");
  });

  test("a stale check simply stops counting; the row survives", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach, "Confirm setlist");
    // Checked a fortnight ago: the item is still on the list, just unchecked.
    await db.query(`update weekly_items set checked_week = '2026-09-20'`);
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from weekly_items
        where checked_week is distinct from '2026-10-04'::date`,
    );
    await asAdmin();
    assert.equal(rows[0].n, 1, "last week's check no longer counts as done");
  });

  test("deleting a person takes their list with them", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await add(zach, "Confirm setlist");
    await asAdmin();
    await db.query("delete from people where id = $1", [zach]);
    const { rows } = await db.query("select * from weekly_items");
    assert.equal(rows.length, 0);
  });
});
