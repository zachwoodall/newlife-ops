/**
 * Applies the real migration and seed to an in-process Postgres (PGlite)
 * and checks the database agrees with src/lib/org.ts on every rule.
 *
 * The assignment rule is enforced in both places — TypeScript for the UI,
 * SQL for anything that reaches the database directly. If they ever disagree,
 * the UI is lying about permissions, so the cross-check below is exhaustive.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { type OrgData, canAssignTask } from "./org.ts";

const org: OrgData = JSON.parse(readFileSync("seed/org.json", "utf8"));

let db: PGlite;
/** person key -> uuid */
const ids = new Map<string, string>();

before(async () => {
  db = new PGlite();
  await db.exec(readFileSync("supabase/migrations/0001_org_structure.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));

  const { rows } = await db.query<{ key: string; id: string }>(
    "select key, id from people",
  );
  for (const r of rows) ids.set(r.key, r.id);
});

after(async () => {
  await db.close();
});

describe("migration applies and seeds", () => {
  test("row counts match the org charts", async () => {
    const one = async (sql: string) =>
      Number((await db.query<{ n: number }>(sql)).rows[0].n);

    assert.equal(await one("select count(*) n from campuses"), 2);
    assert.equal(await one("select count(*) n from people"), 15);
    assert.equal(await one("select count(*) n from positions"), 22);
    assert.equal(
      await one(`select count(*) n from positions p
                 where not exists (select 1 from position_holders h
                                   where h.position_id = p.id)`),
      6,
    );
  });

  test("every person resolved to a row", () => {
    assert.equal(ids.size, org.people.length);
  });

  test("only Zach has an email so far", async () => {
    const { rows } = await db.query<{ email: string }>(
      "select email from people where email is not null",
    );
    assert.deepEqual(rows.map((r) => r.email), ["zach@newlifecanton.com"]);
  });

  test("reporting lines survived the seed", async () => {
    const { rows } = await db.query<{ sup: string }>(
      `select sup.key sup from positions p
         join positions sup on sup.id = p.reports_to_id
        where p.key = 'uh-production-director'`,
    );
    assert.equal(rows[0].sup, "hs-worship");
  });

  test("the campus lead flag landed on the campus pastor", async () => {
    const { rows } = await db.query<{ key: string }>(
      "select key from positions where campus_lead",
    );
    assert.deepEqual(rows.map((r) => r.key), ["uh-campus-pastor"]);
  });
});

describe("SQL and TypeScript agree on assignment", () => {
  test("all 225 person pairs produce the same answer", async () => {
    const keys = org.people.map((p) => p.key);
    const disagreements: string[] = [];

    for (const from of keys) {
      for (const to of keys) {
        const { rows } = await db.query<{ ok: boolean }>(
          "select can_assign_task($1, $2) as ok",
          [ids.get(from), ids.get(to)],
        );
        const sql = rows[0].ok;
        const ts = canAssignTask(org, from, to);
        if (sql !== ts) {
          disagreements.push(`${from} -> ${to}: sql=${sql} ts=${ts}`);
        }
      }
    }

    assert.deepEqual(disagreements, [], `\n${disagreements.join("\n")}`);
  });

  test("spot checks against the charts", async () => {
    const may = async (from: string, to: string) =>
      (
        await db.query<{ ok: boolean }>("select can_assign_task($1, $2) as ok", [
          ids.get(from),
          ids.get(to),
        ])
      ).rows[0].ok;

    // downward
    assert.equal(await may("jb-kitts", "thomas-davis"), true);
    assert.equal(await may("thomas-davis", "roumar-bromfield"), true);
    // upward is refused
    assert.equal(await may("thomas-davis", "jb-kitts"), false);
    assert.equal(await may("roumar-bromfield", "thomas-davis"), false);
    // campus lead reaches across reporting lines at his own campus
    assert.equal(await may("zach-woodall", "john-booth"), true);
    assert.equal(await may("zach-woodall", "charlie-shultz"), true);
    // but not to the other campus, and not upward
    assert.equal(await may("zach-woodall", "thomas-davis"), false);
    assert.equal(await may("zach-woodall", "jb-kitts"), false);
    // peers
    assert.equal(await may("shelby-koerner", "kathy-malloy"), false);
  });
});

describe("integrity guards", () => {
  test("a reporting loop is rejected", async () => {
    await assert.rejects(
      () =>
        db.exec(`update positions
                    set reports_to_id = (select id from positions where key = 'hs-music-director')
                  where key = 'hs-senior-pastor'`),
      /Cycle/,
    );
  });

  test("a position cannot report to itself", async () => {
    await assert.rejects(
      () =>
        db.exec(
          "update positions set reports_to_id = id where key = 'hs-worship'",
        ),
      /positions_no_self_report|Cycle/,
    );
  });

  test("two people may hold one position", async () => {
    const { rows } = await db.query<{ n: number }>(
      `select count(*) n from position_holders h
         join positions p on p.id = h.position_id
        where p.key = 'hs-students'`,
    );
    assert.equal(Number(rows[0].n), 2);
  });

  test("one person may hold positions at both campuses", async () => {
    const { rows } = await db.query<{ campus: string }>(
      `select c.key campus from position_holders h
         join positions p on p.id = h.position_id
         join campuses c on c.id = p.campus_id
         join people ppl on ppl.id = h.person_id
        where ppl.key = 'zach-woodall'
        order by c.key`,
    );
    assert.deepEqual(rows.map((r) => r.campus), ["holly-springs", "union-hill"]);
  });
});
