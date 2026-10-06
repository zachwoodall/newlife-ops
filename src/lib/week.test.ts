import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { endOfWeek, isDueThisWeek, weekReminders, isOverdue, type Task } from "./tasks.ts";

const task = (over: Partial<Task> = {}): Task => ({
  id: Math.random().toString(36).slice(2),
  title: "Task",
  notes: null,
  owner_id: "me",
  created_by: "me",
  cadence: "weekly",
  kind: "project",
  status: "open",
  due_date: null,
  ...over,
});

// Wednesday 7 October 2026.
const WED = new Date("2026-10-07T09:00:00");

/** Local calendar date — toISOString() would shift across the UTC boundary. */
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

describe("endOfWeek", () => {
  test("a Wednesday rolls forward to that Saturday", () => {
    assert.equal(localDay(endOfWeek(WED)), "2026-10-10");
  });

  test("Sunday is the start, so it ends the following Saturday", () => {
    const sun = new Date("2026-10-04T09:00:00");
    assert.equal(localDay(endOfWeek(sun)), "2026-10-10");
  });

  test("Saturday ends on itself, not a week later", () => {
    const sat = new Date("2026-10-10T09:00:00");
    assert.equal(localDay(endOfWeek(sat)), "2026-10-10");
  });
});

describe("isDueThisWeek", () => {
  test("due Saturday counts", () => {
    assert.equal(isDueThisWeek(task({ due_date: "2026-10-10" }), WED), true);
  });

  test("due the following Sunday does not", () => {
    assert.equal(isDueThisWeek(task({ due_date: "2026-10-11" }), WED), false);
  });

  test("overdue from last week still counts", () => {
    assert.equal(isDueThisWeek(task({ due_date: "2026-10-05" }), WED), true);
  });

  test("a completed task never counts", () => {
    assert.equal(
      isDueThisWeek(
        task({ due_date: "2026-10-05", status: "done" }),
        WED,
      ),
      false,
    );
  });

  test("an undated task never counts", () => {
    assert.equal(isDueThisWeek(task({ due_date: null }), WED), false);
  });
});

describe("isOverdue", () => {
  test("yesterday is overdue", () => {
    assert.equal(isOverdue(task({ due_date: "2026-10-06" }), WED), true);
  });

  test("today is not overdue", () => {
    assert.equal(isOverdue(task({ due_date: "2026-10-07" }), WED), false);
  });

  test("a done task is never overdue", () => {
    assert.equal(
      isOverdue(task({ due_date: "2026-10-01", status: "done" }), WED),
      false,
    );
  });
});

describe("weekReminders", () => {
  test("shows at most five, soonest first", () => {
    const tasks = [
      task({ title: "F", due_date: "2026-10-10" }),
      task({ title: "A", due_date: "2026-10-05" }),
      task({ title: "C", due_date: "2026-10-07" }),
      task({ title: "B", due_date: "2026-10-06" }),
      task({ title: "E", due_date: "2026-10-09" }),
      task({ title: "D", due_date: "2026-10-08" }),
    ];
    const { shown, total } = weekReminders(tasks, WED);
    assert.deepEqual(shown.map((t) => t.title), ["A", "B", "C", "D", "E"]);
    assert.equal(total, 6);
  });

  test("completed tasks drop out and the next one moves up", () => {
    const tasks = [
      task({ title: "Done", due_date: "2026-10-05", status: "done" }),
      task({ title: "Open", due_date: "2026-10-06" }),
    ];
    const { shown } = weekReminders(tasks, WED);
    assert.deepEqual(shown.map((t) => t.title), ["Open"]);
  });

  test("next week's work is not shown", () => {
    const { shown } = weekReminders([task({ due_date: "2026-10-20" })], WED);
    assert.equal(shown.length, 0);
  });

  test("ties break alphabetically so the order is stable", () => {
    const tasks = [
      task({ title: "Zebra", due_date: "2026-10-08" }),
      task({ title: "Apple", due_date: "2026-10-08" }),
    ];
    const { shown } = weekReminders(tasks, WED);
    assert.deepEqual(shown.map((t) => t.title), ["Apple", "Zebra"]);
  });
});
