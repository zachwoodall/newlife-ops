import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { escapeLike, likePattern, excerpt, isUsableQuery } from "./search.ts";

describe("escapeLike", () => {
  test("a percent sign is a literal, not a wildcard", () => {
    assert.equal(escapeLike("100%"), "100\\%");
  });

  test("an underscore is a literal, not a single-character wildcard", () => {
    assert.equal(escapeLike("stage_plot"), "stage\\_plot");
  });

  test("backslashes are escaped first so nothing double-escapes", () => {
    assert.equal(escapeLike("a\\b"), "a\\\\b");
    assert.equal(escapeLike("a\\%b"), "a\\\\\\%b");
  });

  test("ordinary text is untouched", () => {
    assert.equal(escapeLike("Sunday setlist"), "Sunday setlist");
  });
});

describe("likePattern", () => {
  test("wraps the term for a contains match", () => {
    assert.equal(likePattern("setlist"), "*setlist*");
  });

  test("a lone wildcard cannot match everything", () => {
    // Without escaping this would be '***' and match every row.
    assert.equal(likePattern("%"), "*\\%*");
  });

  test("quotes are escaped so they cannot break out of the filter", () => {
    assert.equal(likePattern('say "hi"'), '*say \\"hi\\"*');
  });
});

describe("excerpt", () => {
  const body = "The band needs the updated stage plot before Thursday rehearsal, " +
    "otherwise we cannot set the monitors correctly for the Sunday service.";

  test("centres on the match", () => {
    const out = excerpt(body, "monitors");
    assert.ok(out.includes("monitors"));
  });

  test("marks that text was trimmed from the front", () => {
    assert.ok(excerpt(body, "monitors").startsWith("…"));
  });

  test("a match near the start is not prefixed with an ellipsis", () => {
    assert.ok(!excerpt(body, "band").startsWith("…"));
  });

  test("collapses whitespace so excerpts stay on one line", () => {
    assert.equal(excerpt("one\n\n   two", "two"), "one two");
  });

  test("short text comes back whole", () => {
    assert.equal(excerpt("Short note", "note"), "Short note");
  });

  test("a term that is not present still yields a readable opening", () => {
    const out = excerpt(body, "zzz");
    assert.ok(out.length > 0);
    assert.ok(out.startsWith("The band"));
  });

  test("matching is case-insensitive", () => {
    assert.ok(excerpt(body, "SUNDAY").includes("Sunday"));
  });
});

describe("isUsableQuery", () => {
  test("rejects empty or near-empty queries", () => {
    assert.equal(isUsableQuery(""), false);
    assert.equal(isUsableQuery("   "), false);
    assert.equal(isUsableQuery("a"), false);
  });

  test("accepts two characters or more", () => {
    assert.equal(isUsableQuery("pa"), true);
    assert.equal(isUsableQuery(" setlist "), true);
  });
});
