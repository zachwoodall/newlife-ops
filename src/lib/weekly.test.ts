import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { weekStart, isCheckedThisWeek, daysUntilReset } from "./weekly.ts";

const TZ = "America/New_York";

describe("weekStart", () => {
  test("a Wednesday belongs to the Sunday before it", () => {
    assert.equal(weekStart(new Date("2026-10-07T13:00:00Z"), TZ), "2026-10-04");
  });

  test("Sunday is the start of its own week", () => {
    assert.equal(weekStart(new Date("2026-10-04T13:00:00Z"), TZ), "2026-10-04");
  });

  test("Saturday still belongs to the week that began six days earlier", () => {
    assert.equal(weekStart(new Date("2026-10-10T13:00:00Z"), TZ), "2026-10-04");
  });

  test("late Saturday night has NOT rolled over yet, though it is Sunday in UTC", () => {
    // 11pm Saturday in Canton is 03:00 Sunday UTC. Using UTC here would reset
    // the board a day early, wiping it before Sunday morning.
    const lateSaturday = new Date("2026-10-11T03:00:00Z");
    assert.equal(weekStart(lateSaturday, TZ), "2026-10-04");
  });

  test("rolls over at local midnight, not UTC midnight", () => {
    // 12:30am Sunday in Canton = 04:30 Sunday UTC.
    const justAfterMidnight = new Date("2026-10-11T04:30:00Z");
    assert.equal(weekStart(justAfterMidnight, TZ), "2026-10-11");
  });

  test("the week spanning the spring DST jump is still seven days", () => {
    // US DST begins Sunday 8 March 2026.
    assert.equal(weekStart(new Date("2026-03-08T12:00:00Z"), TZ), "2026-03-08");
    assert.equal(weekStart(new Date("2026-03-14T12:00:00Z"), TZ), "2026-03-08");
    assert.equal(weekStart(new Date("2026-03-15T12:00:00Z"), TZ), "2026-03-15");
  });

  test("the week spanning the autumn DST fallback behaves too", () => {
    // DST ends Sunday 1 November 2026.
    assert.equal(weekStart(new Date("2026-11-01T12:00:00Z"), TZ), "2026-11-01");
    assert.equal(weekStart(new Date("2026-11-07T12:00:00Z"), TZ), "2026-11-01");
  });

  test("a week spanning new year resolves to the December Sunday", () => {
    assert.equal(weekStart(new Date("2027-01-01T12:00:00Z"), TZ), "2026-12-27");
  });

  test("every day of one week maps to the same Sunday", () => {
    const starts = new Set(
      ["04", "05", "06", "07", "08", "09", "10"].map((d) =>
        weekStart(new Date(`2026-10-${d}T17:00:00Z`), TZ),
      ),
    );
    assert.deepEqual([...starts], ["2026-10-04"]);
  });
});

describe("isCheckedThisWeek", () => {
  const wednesday = new Date("2026-10-07T13:00:00Z");

  test("an item checked this week reads as done", () => {
    assert.equal(isCheckedThisWeek("2026-10-04", wednesday, TZ), true);
  });

  test("an item checked last week has reset", () => {
    assert.equal(isCheckedThisWeek("2026-09-27", wednesday, TZ), false);
  });

  test("an item never checked is not done", () => {
    assert.equal(isCheckedThisWeek(null, wednesday, TZ), false);
  });

  test("checking on Saturday survives until Sunday, then resets", () => {
    const saturday = new Date("2026-10-10T22:00:00Z");
    assert.equal(isCheckedThisWeek("2026-10-04", saturday, TZ), true);
    const sunday = new Date("2026-10-11T14:00:00Z");
    assert.equal(isCheckedThisWeek("2026-10-04", sunday, TZ), false);
  });
});

describe("daysUntilReset", () => {
  test("counts down to the coming Sunday", () => {
    assert.equal(daysUntilReset(new Date("2026-10-04T13:00:00Z"), TZ), 7);
    assert.equal(daysUntilReset(new Date("2026-10-07T13:00:00Z"), TZ), 4);
    assert.equal(daysUntilReset(new Date("2026-10-10T13:00:00Z"), TZ), 1);
  });
});
