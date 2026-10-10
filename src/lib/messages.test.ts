/**
 * Messages. The rule that distinguishes them from tasks: they ignore the
 * org chart. Anyone may write to anyone, in either direction.
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
                   "0006_org_editing", "0007_messages"]) {
    await db.exec(readFileSync(`supabase/migrations/${m}.sql`, "utf8"));
  }
  await db.exec(`grant select, insert, update, delete on messages to authenticated;`);
  await db.exec(`update people set email = key || '@newlifecanton.com' where email is null;`);
});

after(async () => db.close());

beforeEach(async () => {
  await asAdmin();
  await db.exec("delete from messages;");
});

async function send(fromEmail: string, fromKey: string, toKey: string, body: string) {
  const from = await idOf(fromKey);
  const to = await idOf(toKey);
  await actAs(fromEmail);
  const { rows } = await db.query<{ id: string }>(
    `insert into messages (sender_id, recipient_id, body) values ($1,$2,$3) returning id`,
    [from, to, body],
  );
  return rows[0].id;
}

describe("messages ignore the org chart", () => {
  test("an intern can write to the senior pastor", async () => {
    await send("levi-porter@newlifecanton.com", "levi-porter", "allan-malloy", "Question about Sunday");
    const { rows } = await db.query("select * from messages");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you can write upward two levels", async () => {
    await send("zach@newlifecanton.com", "zach-woodall", "allan-malloy", "Campus update");
    const { rows } = await db.query("select * from messages");
    await asAdmin();
    assert.equal(rows.length, 1);
  });

  test("you cannot send as someone else", async () => {
    const thomas = await idOf("thomas-davis");
    const jb = await idOf("jb-kitts");
    await actAs("levi-porter@newlifecanton.com");
    await assert.rejects(
      () =>
        db.query(`insert into messages (sender_id, recipient_id, body) values ($1,$2,'forged')`, [
          thomas,
          jb,
        ]),
      /policy/i,
    );
    await asAdmin();
  });

  test("you cannot message yourself", async () => {
    const levi = await idOf("levi-porter");
    await actAs("levi-porter@newlifecanton.com");
    await assert.rejects(
      () =>
        db.query(`insert into messages (sender_id, recipient_id, body) values ($1,$1,'hello me')`, [
          levi,
        ]),
      /messages_not_self/,
    );
    await asAdmin();
  });

  test("an empty message is rejected", async () => {
    const levi = await idOf("levi-porter");
    const zach = await idOf("zach-woodall");
    await actAs("levi-porter@newlifecanton.com");
    await assert.rejects(
      () =>
        db.query(`insert into messages (sender_id, recipient_id, body) values ($1,$2,'   ')`, [
          levi,
          zach,
        ]),
      /body/,
    );
    await asAdmin();
  });
});

describe("who can read a conversation", () => {
  test("both sides see it", async () => {
    await send("levi-porter@newlifecanton.com", "levi-porter", "zach-woodall", "Room is ready");

    await actAs("zach@newlifecanton.com");
    const asRecipient = await db.query("select * from messages");
    assert.equal(asRecipient.rows.length, 1);

    await actAs("levi-porter@newlifecanton.com");
    const asSender = await db.query("select * from messages");
    await asAdmin();
    assert.equal(asSender.rows.length, 1);
  });

  test("a third person sees nothing", async () => {
    await send("levi-porter@newlifecanton.com", "levi-porter", "zach-woodall", "Private");
    await actAs("brandon-ford@newlifecanton.com");
    const { rows } = await db.query("select * from messages");
    await asAdmin();
    assert.equal(rows.length, 0);
  });
});

describe("read receipts", () => {
  test("the recipient can mark it read", async () => {
    const id = await send("levi-porter@newlifecanton.com", "levi-porter", "zach-woodall", "Hi");
    await actAs("zach@newlifecanton.com");
    await db.query("update messages set read_at = now() where id = $1", [id]);
    const { rows } = await db.query<{ read_at: string | null }>(
      "select read_at from messages where id = $1",
      [id],
    );
    await asAdmin();
    assert.ok(rows[0].read_at);
  });

  test("the sender cannot mark their own message read", async () => {
    const id = await send("levi-porter@newlifecanton.com", "levi-porter", "zach-woodall", "Hi");
    await actAs("levi-porter@newlifecanton.com");
    await db.query("update messages set read_at = now() where id = $1", [id]);
    await asAdmin();
    const { rows } = await db.query<{ read_at: string | null }>(
      "select read_at from messages where id = $1",
      [id],
    );
    assert.equal(rows[0].read_at, null, "sender should not be able to mark it read");
  });

  test("the body cannot be rewritten", async () => {
    const id = await send("levi-porter@newlifecanton.com", "levi-porter", "zach-woodall", "Original");
    await actAs("zach@newlifecanton.com");
    await assert.rejects(
      () => db.query("update messages set body = 'Rewritten' where id = $1", [id]),
      /Only read_at may be changed/,
    );
    await asAdmin();
  });
});

describe("unsending", () => {
  test("the sender can delete what they wrote", async () => {
    const id = await send("levi-porter@newlifecanton.com", "levi-porter", "zach-woodall", "Oops");
    await db.query("delete from messages where id = $1", [id]);
    await asAdmin();
    const { rows } = await db.query("select * from messages");
    assert.equal(rows.length, 0);
  });

  test("the recipient cannot delete what they were sent", async () => {
    const id = await send("levi-porter@newlifecanton.com", "levi-porter", "zach-woodall", "Keep");
    await actAs("zach@newlifecanton.com");
    await db.query("delete from messages where id = $1", [id]);
    await asAdmin();
    const { rows } = await db.query("select * from messages");
    assert.equal(rows.length, 1, "recipient should not be able to erase the record");
  });
});
