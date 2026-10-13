import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generatePassword, AMBIGUOUS } from "./passwords.ts";

describe("generatePassword", () => {
  test("is the requested length", () => {
    assert.equal(generatePassword().length, 16);
    assert.equal(generatePassword(24).length, 24);
  });

  test("omits characters that are misread", () => {
    // Many samples, since any single one might miss by chance.
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword(32);
      for (const c of AMBIGUOUS) {
        assert.ok(!pw.includes(c), `${c} should never appear`);
      }
    }
  });

  test("two passwords are not the same", () => {
    const seen = new Set(Array.from({ length: 100 }, () => generatePassword()));
    assert.equal(seen.size, 100);
  });

  test("uses the whole alphabet rather than a narrow slice", () => {
    const chars = new Set(generatePassword(2000).split(""));
    assert.ok(chars.size > 40, `expected wide coverage, saw ${chars.size}`);
  });

  test("is deterministic when given the randomness, so it can be tested", () => {
    const fixed = (n: number) => new Uint8Array(n).fill(0);
    assert.equal(generatePassword(4, fixed), "AAAA");
  });
});
