/** Month-grid maths for the calendar, kept separate so it can be tested. */

export type Cell = {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** First and last date shown for a month, as YYYY-MM-DD. */
export function monthWindow(year: number, month: number): { from: string; to: string } {
  const cells = monthGrid(year, month);
  return { from: cells[0].date, to: cells[cells.length - 1].date };
}

/**
 * Six weeks of cells starting on Sunday, matching the rest of the app's
 * Sunday-to-Saturday week. Always 42 cells so the grid never reflows.
 */
export function monthGrid(year: number, month: number): Cell[] {
  const first = new Date(Date.UTC(year, month, 1));
  const leading = first.getUTCDay(); // 0 = Sunday
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - leading);

  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    cells.push({
      date: iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      inMonth: d.getUTCMonth() === month && d.getUTCFullYear() === year,
    });
  }
  return cells;
}

/** Step a year/month pair, handling the year boundary. */
export function shiftMonth(year: number, month: number, by: number) {
  const total = year * 12 + month + by;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
