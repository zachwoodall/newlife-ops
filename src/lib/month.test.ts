import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { monthGrid, monthWindow, shiftMonth } from "./month.ts";

describe("monthGrid", () => {
  test("is always six weeks, so the grid never reflows", () => {
    for (const m of [0, 1, 5, 11]) {
      assert.equal(monthGrid(2026, m).length, 42);
    }
    assert.equal(monthGrid(2026, 1).length, 42, "even a short February");
  });

  test("starts on a Sunday", () => {
    const first = monthGrid(2026, 9)[0];
    assert.equal(new Date(`${first.date}T00:00:00Z`).getUTCDay(), 0);
  });

  test("marks which cells belong to the month", () => {
    const cells = monthGrid(2026, 9); // October 2026
    const inMonth = cells.filter((c) => c.inMonth);
    assert.equal(inMonth.length, 31, "October has 31 days");
    assert.equal(inMonth[0].date, "2026-10-01");
    assert.equal(inMonth[30].date, "2026-10-31");
  });

  test("leading cells come from the previous month", () => {
    const cells = monthGrid(2026, 9);
    assert.equal(cells[0].inMonth, false);
    assert.ok(cells[0].date < "2026-10-01");
  });

  test("handles a leap February", () => {
    const inMonth = monthGrid(2028, 1).filter((c) => c.inMonth);
    assert.equal(inMonth.length, 29, "2028 is a leap year");
  });

  test("handles a non-leap February", () => {
    assert.equal(monthGrid(2026, 1).filter((c) => c.inMonth).length, 28);
  });

  test("dates are consecutive with no gaps or repeats", () => {
    const cells = monthGrid(2026, 11);
    const dates = cells.map((c) => c.date);
    assert.equal(new Set(dates).size, 42, "no duplicates");
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(`${dates[i - 1]}T00:00:00Z`);
      const cur = new Date(`${dates[i]}T00:00:00Z`);
      assert.equal(cur.getTime() - prev.getTime(), 86_400_000, "exactly one day apart");
    }
  });

  test("December spills into the new year correctly", () => {
    const cells = monthGrid(2026, 11);
    assert.ok(cells.some((c) => c.date.startsWith("2027-01")), "January should appear");
  });
});

describe("monthWindow", () => {
  test("spans the whole visible grid, not just the month", () => {
    const w = monthWindow(2026, 9);
    const cells = monthGrid(2026, 9);
    assert.equal(w.from, cells[0].date);
    assert.equal(w.to, cells[41].date);
    assert.ok(w.from < "2026-10-01", "includes trailing days of September");
  });
});

describe("shiftMonth", () => {
  test("steps forward and back", () => {
    assert.deepEqual(shiftMonth(2026, 9, 1), { year: 2026, month: 10 });
    assert.deepEqual(shiftMonth(2026, 9, -1), { year: 2026, month: 8 });
  });

  test("wraps the year in both directions", () => {
    assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
    assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
  });

  test("handles multi-year jumps", () => {
    assert.deepEqual(shiftMonth(2026, 0, -13), { year: 2024, month: 11 });
  });
});
