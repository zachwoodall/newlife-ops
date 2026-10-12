/**
 * Minimal iCalendar (RFC 5545) output for the task feed.
 *
 * Hand-rolled rather than pulled from a library: the subset needed here is
 * small, and the two rules that actually matter -- escaping and line folding
 * -- are easy to verify directly.
 */

export type FeedEvent = {
  taskId: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  status: string;
  isOwner: boolean;
};

/** Commas, semicolons, backslashes and newlines are structural in iCalendar. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Lines must be at most 75 octets; continuations begin with a single space.
 * Measured in octets, not characters, so a multi-byte name cannot push a line
 * over the limit or be split through the middle of a character.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (currentBytes + size > limit) {
      out.push(current);
      current = " ";
      currentBytes = 1;
      limit = 75;
    }
    current += char;
    currentBytes += size;
  }
  out.push(current);
  return out.join("\r\n");
}

/** YYYY-MM-DD to the DATE form iCalendar wants. */
function asDate(iso: string): string {
  return iso.replace(/-/g, "");
}

/** The day after, since an all-day DTEND is exclusive. */
function dayAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return asDate(d.toISOString().slice(0, 10));
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildCalendar(
  events: FeedEvent[],
  baseUrl: string,
  now: Date = new Date(),
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Church Ops//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Church Ops",
    // Ask clients not to hammer the feed.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const e of events) {
    const done = e.status === "done";
    lines.push(
      "BEGIN:VEVENT",
      `UID:task-${e.taskId}@church-ops`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${asDate(e.dueDate)}`,
      `DTEND;VALUE=DATE:${dayAfter(e.dueDate)}`,
      `SUMMARY:${escapeText(done ? `Done: ${e.title}` : e.title)}`,
      `DESCRIPTION:${escapeText(e.isOwner ? "You own this task." : "You are tagged on this task.")}`,
      `URL:${escapeText(`${baseUrl}/tasks/${e.taskId}`)}`,
      `STATUS:${done ? "COMPLETED" : "CONFIRMED"}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
