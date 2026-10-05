import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  type OrgData,
  canAssignTask,
  campusesOf,
  directReports,
  isOpen,
  needsCampusSwitcher,
  supervisorChain,
} from "./org.ts";

const org: OrgData = JSON.parse(readFileSync("seed/org.json", "utf8"));

describe("org data integrity", () => {
  test("every reports_to points at a real position", () => {
    const keys = new Set(org.positions.map((p) => p.key));
    for (const p of org.positions) {
      if (p.reports_to) assert.ok(keys.has(p.reports_to), `${p.key} -> ${p.reports_to}`);
    }
  });

  test("every holder points at a real person", () => {
    const keys = new Set(org.people.map((p) => p.key));
    for (const pos of org.positions) {
      for (const h of pos.holders) assert.ok(keys.has(h), `${pos.key} holds ${h}`);
    }
  });

  test("no reporting cycles", () => {
    for (const p of org.positions) {
      const chain = supervisorChain(org, p.key);
      assert.ok(!chain.some((c) => c.key === p.key), `${p.key} reports to itself`);
    }
  });

  test("counts match the charts", () => {
    assert.equal(org.campuses.length, 2);
    assert.equal(org.people.length, 15);
    assert.equal(org.positions.length, 22);
    assert.equal(org.positions.filter(isOpen).length, 6);
  });
});

describe("reporting lines", () => {
  test("Executive Pastor reports to Senior Pastor", () => {
    const chain = supervisorChain(org, "hs-executive-pastor");
    assert.deepEqual(chain.map((p) => p.key), ["hs-senior-pastor"]);
  });

  test("Music Director chains up through Worship to the top", () => {
    const chain = supervisorChain(org, "hs-music-director").map((p) => p.key);
    assert.deepEqual(chain, ["hs-worship", "hs-executive-pastor", "hs-senior-pastor"]);
  });

  test("Executive Pastor has 8 Holly Springs departments plus cross-campus reports", () => {
    const reports = directReports(org, "hs-executive-pastor").map((p) => p.key);
    assert.ok(reports.includes("hs-worship"));
    assert.ok(reports.includes("hs-small-groups"));
    assert.ok(reports.includes("uh-campus-pastor"));
    assert.ok(reports.includes("uh-facilities-director"));
  });

  test("Union Hill Production Director reports to Worship, not Production", () => {
    const chain = supervisorChain(org, "uh-production-director");
    assert.equal(chain[0].key, "hs-worship");
  });

  test("Next Steps Director has no supervisor yet", () => {
    const pos = org.positions.find((p) => p.key === "uh-next-steps-director")!;
    assert.equal(pos.reports_to, null);
  });
});

describe("multi-campus people", () => {
  test("Zach works at both campuses and gets the switcher", () => {
    assert.deepEqual(campusesOf(org, "zach-woodall").sort(), ["holly-springs", "union-hill"]);
    assert.equal(needsCampusSwitcher(org, "zach-woodall"), true);
  });

  test("John Booth and Charlie Shultz also span both campuses", () => {
    assert.equal(needsCampusSwitcher(org, "john-booth"), true);
    assert.equal(needsCampusSwitcher(org, "charlie-shultz"), true);
  });

  test("single-campus staff get no switcher", () => {
    assert.equal(needsCampusSwitcher(org, "brandon-ford"), false);
    assert.equal(needsCampusSwitcher(org, "thomas-davis"), false);
  });

  test("shared roles hold two people", () => {
    const students = org.positions.find((p) => p.key === "hs-students")!;
    assert.deepEqual(students.holders, ["zach-woodall", "sarah-woodall"]);
    const production = org.positions.find((p) => p.key === "hs-production")!;
    assert.deepEqual(production.holders, ["john-booth", "josh-floyd"]);
  });
});

describe("task assignment — downward only", () => {
  test("Senior Pastor may assign to anyone", () => {
    assert.ok(canAssignTask(org, "allan-malloy", "jb-kitts"));
    assert.ok(canAssignTask(org, "allan-malloy", "levi-porter"));
    assert.ok(canAssignTask(org, "allan-malloy", "kathy-malloy"));
  });

  test("Executive Pastor may assign down to a department head", () => {
    assert.ok(canAssignTask(org, "jb-kitts", "thomas-davis"));
  });

  test("a department head may assign to their own report", () => {
    assert.ok(canAssignTask(org, "thomas-davis", "roumar-bromfield"));
    assert.ok(canAssignTask(org, "vannessa-smith", "anna"));
  });

  test("nobody may assign upward", () => {
    assert.equal(canAssignTask(org, "thomas-davis", "jb-kitts"), false);
    assert.equal(canAssignTask(org, "roumar-bromfield", "thomas-davis"), false);
    assert.equal(canAssignTask(org, "jb-kitts", "allan-malloy"), false);
    assert.equal(canAssignTask(org, "zach-woodall", "jb-kitts"), false);
  });

  test("peers may not assign to each other", () => {
    assert.equal(canAssignTask(org, "thomas-davis", "brandon-ford"), false);
    assert.equal(canAssignTask(org, "shelby-koerner", "kathy-malloy"), false);
  });

  test("an intern may assign to nobody", () => {
    assert.deepEqual(
      org.people.filter(
        (p) => p.key !== "levi-porter" && canAssignTask(org, "levi-porter", p.key),
      ),
      [],
    );
  });

  test("assigning to yourself is allowed", () => {
    assert.ok(canAssignTask(org, "levi-porter", "levi-porter"));
  });
});

describe("task assignment — campus pastor rule", () => {
  test("Campus Pastor may assign across reporting lines at their campus", () => {
    // John Booth is UH Production Director but reports to Thomas Davis.
    assert.ok(canAssignTask(org, "zach-woodall", "john-booth"));
    // Charlie Shultz is UH Facilities Director but reports to JB Kitts.
    assert.ok(canAssignTask(org, "zach-woodall", "charlie-shultz"));
  });

  test("the campus rule does not leak to the other campus", () => {
    // Thomas Davis is Holly Springs only — the Union Hill rule must not reach him.
    assert.equal(canAssignTask(org, "zach-woodall", "thomas-davis"), false);
    assert.equal(canAssignTask(org, "zach-woodall", "brandon-ford"), false);
  });

  test("the campus rule is not a back door upward", () => {
    // JB Kitts holds no Union Hill position, so the campus rule cannot reach him.
    assert.equal(canAssignTask(org, "zach-woodall", "jb-kitts"), false);
  });

  test("Zach still assigns down his Holly Springs line", () => {
    assert.ok(canAssignTask(org, "zach-woodall", "levi-porter"));
  });

  test("non-leads at Union Hill get no campus-wide power", () => {
    assert.equal(canAssignTask(org, "john-booth", "charlie-shultz"), false);
  });
});
