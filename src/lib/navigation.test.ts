import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SECTIONS, ACCOUNT_LINKS, sectionFor, childFor } from "./navigation.ts";

describe("the shape of the bar", () => {
  test("is four sections, not twelve links", () => {
    assert.equal(SECTIONS.length, 4);
    assert.deepEqual(SECTIONS.map((s) => s.label), ["Home", "Tasks", "Team", "Files"]);
  });

  test("every page that used to be top level is still reachable", () => {
    const reachable = new Set([
      ...SECTIONS.map((s) => s.href),
      ...SECTIONS.flatMap((s) => s.children.map((c) => c.href)),
      ...ACCOUNT_LINKS.map((l) => l.href),
      "/search",
      "/notifications",
    ]);
    for (const href of [
      "/", "/department", "/tasks", "/weekly", "/calendar", "/files",
      "/announcements", "/checkins", "/messages", "/notifications",
      "/search", "/admin",
    ]) {
      assert.ok(reachable.has(href), `${href} must still be reachable`);
    }
  });
});

describe("sectionFor", () => {
  test("home matches only itself", () => {
    assert.equal(sectionFor("/")?.label, "Home");
    assert.notEqual(sectionFor("/tasks")?.label, "Home");
  });

  test("the task pages all belong to Tasks", () => {
    for (const p of ["/tasks", "/tasks/abc", "/weekly", "/calendar"]) {
      assert.equal(sectionFor(p)?.label, "Tasks", `${p} should be under Tasks`);
    }
  });

  test("the people pages all belong to Team", () => {
    for (const p of ["/announcements", "/announcements/x", "/checkins", "/messages", "/messages/x", "/department"]) {
      assert.equal(sectionFor(p)?.label, "Team", `${p} should be under Team`);
    }
  });

  test("files is its own section", () => {
    assert.equal(sectionFor("/files")?.label, "Files");
  });

  test("pages outside the bar belong to no section", () => {
    assert.equal(sectionFor("/admin"), null);
    assert.equal(sectionFor("/search"), null);
    assert.equal(sectionFor("/notifications"), null);
  });
});

describe("childFor", () => {
  const tasks = SECTIONS.find((s) => s.label === "Tasks")!;
  const team = SECTIONS.find((s) => s.label === "Team")!;

  test("picks the current tab", () => {
    assert.equal(childFor("/weekly", tasks)?.label, "This week");
    assert.equal(childFor("/calendar", tasks)?.label, "Calendar");
    assert.equal(childFor("/tasks", tasks)?.label, "Directory");
  });

  test("a task board still highlights Directory", () => {
    assert.equal(childFor("/tasks/some-id", tasks)?.label, "Directory");
  });

  test("a message thread still highlights Messages", () => {
    assert.equal(childFor("/messages/some-id", team)?.label, "Messages");
  });
});
