import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { firstName } from "./names.ts";

describe("firstName", () => {
  test("plain names", () => {
    assert.equal(firstName("Zach Woodall"), "Zach");
    assert.equal(firstName("JB Kitts"), "JB");
  });

  test("skips an honorific", () => {
    assert.equal(firstName("Dr. Allan Malloy"), "Allan");
    assert.equal(firstName("Pastor Thomas Davis"), "Thomas");
    assert.equal(firstName("Rev Kathy Malloy"), "Kathy");
  });

  test("a single name is returned as-is", () => {
    assert.equal(firstName("Anna"), "Anna");
  });

  test("a name that is only a title falls back rather than returning empty", () => {
    assert.equal(firstName("Dr."), "Dr.");
  });

  test("extra whitespace does not break it", () => {
    assert.equal(firstName("  Sarah   Woodall "), "Sarah");
  });
});
