/**
 * Tasks schema and its RLS policies, against real Postgres.
 *
 * The downward-only assignment rule is enforced here as a database policy,
 * not just in the UI, so these tests drive it the way a hostile client would:
 * as the `authenticated` role with a JWT, inserting directly.
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

let db: PGlite;

const MIGRATIONS = [
  "supabase/migrations/0001_org_structure.sql",
  "supabase/migrations/0002_rls.sql",
  "supabase/migrations/0003_tasks.sql",
];

/** Run the next statements as this signed-in person. */
async function actAs(email: string) {
  await db.exec("reset role;");
  await db.exec(`set request.jwt.claims = '{"email":"${email}"}';`);
  await db.exec("set role authenticated;");
}

async function asAdmin() {
  await db.exec("reset role;");
  await db.exec(`set request.jwt.claims = '';`);
}

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  await db.exec(readFileSync(MIGRATIONS[0], "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
  await db.exec(readFileSync(MIGRATIONS[1], "utf8"));
  await db.exec(readFileSync(MIGRATIONS[2], "utf8"));
  await db.exec(`
    grant select, insert, update, delete on tasks, task_assignees
      to authenticated;
  `);
  // Give everyone an email so they can be signed in as, in tests.
  await db.exec(`
    update people set email = key || '@newlifecanton.com' where email is null;
  `);
});

after(async () => {
  await db.close();
});

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from tasks;");
});

const idOf = async (key: string) => {
  const { rows } = await db.query<{ id: string }>(
    "select id from people where key = $1",
    [key],
  );
  return rows[0].id;
};

describe("current_person_id", () => {
  test("resolves the signed-in person", async () => {
    await actAs("zach@newlifecanton.com");
    const { rows } = await db.query<{ id: string }>("select current_person_id() as id");
    await asAdmin();
    assert.equal(rows[0].id, await idOf("zach-woodall"));
  });

  test("is null for an unknown email", async () => {
    await actAs("stranger@example.com");
    const { rows } = await db.query<{ id: string | null }>(
      "select current_person_id() as id",
    );
    await asAdmin();
    assert.equal(rows[0].id, null);
  });
});

describe("creating tasks respects the org chart", () => {
  test("you may create a task for yourself", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await db.query(
      `insert into tasks (title, owner_id, created_by, cadence)
       values ('Plan Sunday setlist', $1, $1, 'weekly')`,
      [zach],
    );
    const { rows } = await db.query("select * from tasks");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you may create a task for someone below you", async () => {
    const zach = await idOf("zach-woodall");
    const levi = await idOf("levi-porter");
    await actAs("zach@newlifecanton.com");
    await db.query(
      `insert into tasks (title, owner_id, created_by)
       values ('Set up student room', $1, $2)`,
      [levi, zach],
    );
    await asAdmin();
    const { rows } = await db.query("select * from tasks");
    assert.equal(rows.length, 1);
  });

  test("a campus lead may create across reporting lines at their campus", async () => {
    const zach = await idOf("zach-woodall");
    const john = await idOf("john-booth");
    await actAs("zach@newlifecanton.com");
    await db.query(
      `insert into tasks (title, owner_id, created_by)
       values ('Check Union Hill sound desk', $1, $2)`,
      [john, zach],
    );
    await asAdmin();
    const { rows } = await db.query("select * from tasks");
    assert.equal(rows.length, 1);
  });

  test("you may NOT create a task for someone above you", async () => {
    const zach = await idOf("zach-woodall");
    const jb = await idOf("jb-kitts");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () =>
        db.query(
          `insert into tasks (title, owner_id, created_by) values ('Do my paperwork', $1, $2)`,
          [jb, zach],
        ),
      /policy/i,
    );
    await asAdmin();
  });

  test("you may NOT create a task for a peer", async () => {
    const thomas = await idOf("thomas-davis");
    const brandon = await idOf("brandon-ford");
    await actAs("thomas-davis@newlifecanton.com");
    await assert.rejects(
      () =>
        db.query(
          `insert into tasks (title, owner_id, created_by) values ('Peer task', $1, $2)`,
          [brandon, thomas],
        ),
      /policy/i,
    );
    await asAdmin();
  });

  test("you may NOT forge the creator field", async () => {
    const zach = await idOf("zach-woodall");
    const levi = await idOf("levi-porter");
    await actAs("levi-porter@newlifecanton.com");
    await assert.rejects(
      () =>
        db.query(
          `insert into tasks (title, owner_id, created_by) values ('Forged', $1, $2)`,
          [levi, zach],
        ),
      /policy/i,
    );
    await asAdmin();
  });
});

describe("seeing tasks", () => {
  test("you see your own and not other people's", async () => {
    const zach = await idOf("zach-woodall");
    const thomas = await idOf("thomas-davis");
    const roumar = await idOf("roumar-bromfield");

    await actAs("zach@newlifecanton.com");
    await db.query(
      `insert into tasks (title, owner_id, created_by) values ('Zach task', $1, $1)`,
      [zach],
    );
    await actAs("thomas-davis@newlifecanton.com");
    await db.query(
      `insert into tasks (title, owner_id, created_by) values ('Roumar task', $1, $2)`,
      [roumar, thomas],
    );

    await actAs("zach@newlifecanton.com");
    const mine = await db.query<{ title: string }>("select title from tasks");
    await asAdmin();
    assert.deepEqual(mine.rows.map((r) => r.title), ["Zach task"]);
  });

  test("a tagged helper can see the task", async () => {
    const zach = await idOf("zach-woodall");
    const levi = await idOf("levi-porter");

    await actAs("zach@newlifecanton.com");
    const { rows } = await db.query<{ id: string }>(
      `insert into tasks (title, owner_id, created_by)
       values ('Shared job', $1, $1) returning id`,
      [zach],
    );
    await db.query(
      `insert into task_assignees (task_id, person_id, role_label)
       values ($1, $2, 'Helping')`,
      [rows[0].id, levi],
    );

    await actAs("levi-porter@newlifecanton.com");
    const seen = await db.query<{ title: string }>("select title from tasks");
    await asAdmin();
    assert.deepEqual(seen.rows.map((r) => r.title), ["Shared job"]);
  });

  test("an unrelated person sees nothing", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await db.query(
      `insert into tasks (title, owner_id, created_by) values ('Private', $1, $1)`,
      [zach],
    );
    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from tasks");
    await asAdmin();
    assert.equal(rows.length, 0);
  });
});

describe("data integrity", () => {
  test("completed_at must agree with status", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () =>
        db.query(
          `insert into tasks (title, owner_id, created_by, status)
           values ('Bad', $1, $1, 'done')`,
          [zach],
        ),
      /tasks_completed_matches_status/,
    );
    await asAdmin();
  });

  test("cadence is restricted to the four periods plus one-off", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () =>
        db.query(
          `insert into tasks (title, owner_id, created_by, cadence)
           values ('Bad', $1, $1, 'fortnightly')`,
          [zach],
        ),
      /cadence/,
    );
    await asAdmin();
  });

  test("a blank title is rejected", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () =>
        db.query(`insert into tasks (title, owner_id, created_by) values ('   ', $1, $1)`, [
          zach,
        ]),
      /title/,
    );
    await asAdmin();
  });
});

describe("editing and deleting", () => {
  test("the creator may delete", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    const { rows } = await db.query<{ id: string }>(
      `insert into tasks (title, owner_id, created_by) values ('Mine', $1, $1) returning id`,
      [zach],
    );
    await db.query("delete from tasks where id = $1", [rows[0].id]);
    const left = await db.query("select * from tasks");
    await asAdmin();
    assert.equal(left.rows.length, 0);
  });

  test("the owner may NOT delete a task someone else assigned them", async () => {
    const zach = await idOf("zach-woodall");
    const levi = await idOf("levi-porter");

    await actAs("zach@newlifecanton.com");
    const { rows } = await db.query<{ id: string }>(
      `insert into tasks (title, owner_id, created_by)
       values ('Assigned down', $1, $2) returning id`,
      [levi, zach],
    );

    // Levi owns it but did not create it — the delete silently matches no rows.
    await actAs("levi-porter@newlifecanton.com");
    await db.query("delete from tasks where id = $1", [rows[0].id]);

    await asAdmin();
    const left = await db.query("select * from tasks");
    assert.equal(left.rows.length, 1, "Levi should not have been able to delete it");
  });

  test("the owner may edit their own task", async () => {
    const zach = await idOf("zach-woodall");
    await actAs("zach@newlifecanton.com");
    const { rows } = await db.query<{ id: string }>(
      `insert into tasks (title, owner_id, created_by, cadence)
       values ('Before', $1, $1, 'weekly') returning id`,
      [zach],
    );
    await db.query(
      "update tasks set title = 'After', cadence = 'quarterly' where id = $1",
      [rows[0].id],
    );
    const { rows: after } = await db.query<{ title: string; cadence: string }>(
      "select title, cadence from tasks where id = $1",
      [rows[0].id],
    );
    await asAdmin();
    assert.equal(after[0].title, "After");
    assert.equal(after[0].cadence, "quarterly");
  });

  test("you may NOT hand a task to someone above you by editing it", async () => {
    const zach = await idOf("zach-woodall");
    const jb = await idOf("jb-kitts");
    await actAs("zach@newlifecanton.com");
    const { rows } = await db.query<{ id: string }>(
      `insert into tasks (title, owner_id, created_by) values ('Mine', $1, $1) returning id`,
      [zach],
    );
    await assert.rejects(
      () => db.query("update tasks set owner_id = $1 where id = $2", [jb, rows[0].id]),
      /policy/i,
    );
    await asAdmin();
  });

  test("reassigning downward is allowed", async () => {
    const zach = await idOf("zach-woodall");
    const levi = await idOf("levi-porter");
    await actAs("zach@newlifecanton.com");
    const { rows } = await db.query<{ id: string }>(
      `insert into tasks (title, owner_id, created_by) values ('Handoff', $1, $1) returning id`,
      [zach],
    );
    await db.query("update tasks set owner_id = $1 where id = $2", [levi, rows[0].id]);
    await asAdmin();
    const { rows: after } = await db.query<{ owner_id: string }>(
      "select owner_id from tasks where id = $1",
      [rows[0].id],
    );
    assert.equal(after[0].owner_id, levi);
  });
});
