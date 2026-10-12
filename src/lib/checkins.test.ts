import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { periodKey, periodLabel } from "./weekly.ts";

const TZ = "America/New_York";

describe("periodKey", () => {
  test("a weekly question groups by the church week", () => {
    assert.equal(periodKey("weekly", new Date("2026-10-07T13:00:00Z"), TZ), "2026-10-04");
    assert.equal(periodKey("weekly", new Date("2026-10-10T13:00:00Z"), TZ), "2026-10-04");
  });

  test("a new week opens the question again", () => {
    const thisWeek = periodKey("weekly", new Date("2026-10-10T13:00:00Z"), TZ);
    const nextWeek = periodKey("weekly", new Date("2026-10-11T13:00:00Z"), TZ);
    assert.notEqual(thisWeek, nextWeek, "Sunday starts a new period");
  });

  test("a monthly question groups by calendar month", () => {
    assert.equal(periodKey("monthly", new Date("2026-10-01T13:00:00Z"), TZ), "2026-10-01");
    assert.equal(periodKey("monthly", new Date("2026-10-31T13:00:00Z"), TZ), "2026-10-01");
    assert.equal(periodKey("monthly", new Date("2026-11-01T13:00:00Z"), TZ), "2026-11-01");
  });

  test("periods turn over in church time, not UTC", () => {
    // 11pm on 31 October in Canton is already 1 November in UTC.
    const lateOct = new Date("2026-11-01T03:00:00Z");
    assert.equal(periodKey("monthly", lateOct, TZ), "2026-10-01", "still October locally");
  });

  test("the weekly period crossing a year boundary resolves to December", () => {
    assert.equal(periodKey("weekly", new Date("2027-01-01T13:00:00Z"), TZ), "2026-12-27");
  });

  test("a monthly period in January is the first of January", () => {
    assert.equal(periodKey("monthly", new Date("2027-01-15T13:00:00Z"), TZ), "2027-01-01");
  });
});

describe("periodLabel", () => {
  test("a weekly period reads as a week", () => {
    assert.match(periodLabel("weekly", "2026-10-04"), /^Week of /);
  });

  test("a monthly period reads as a month and year", () => {
    assert.match(periodLabel("monthly", "2026-10-01"), /October/);
    assert.match(periodLabel("monthly", "2026-10-01"), /2026/);
  });
});
