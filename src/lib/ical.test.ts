import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { escapeText, foldLine, buildCalendar, type FeedEvent } from "./ical.ts";

const event = (over: Partial<FeedEvent> = {}): FeedEvent => ({
  taskId: "11111111-1111-1111-1111-111111111111",
  title: "Confirm setlist",
  dueDate: "2026-10-12",
  status: "open",
  isOwner: true,
  ...over,
});

describe("escapeText", () => {
  test("escapes the characters that are structural in iCalendar", () => {
    assert.equal(escapeText("Lunch, then setup"), "Lunch\\, then setup");
    assert.equal(escapeText("Sound; lights"), "Sound\; lights");
    assert.equal(escapeText("a\\b"), "a\\\\b");
  });

  test("newlines become the literal escape, never a real break", () => {
    const escaped = escapeText("one\ntwo");
    assert.equal(escaped, "one\\ntwo");
    assert.equal(escapeText("one\r\ntwo"), "one\\ntwo");
    // The point of the escape: no real line break survives into the output.
    assert.ok(!escaped.includes("\n"), "a literal newline would break the format");
    assert.ok(!escapeText("a\rb").includes("\r"));
  });

  test("backslash is escaped before the others, so it does not double-escape", () => {
    // A literal backslash followed by a comma must not become an escaped comma.
    assert.equal(escapeText("a\\,b"), "a\\\\\\,b");
  });
});

describe("foldLine", () => {
  test("a short line is untouched", () => {
    assert.equal(foldLine("SUMMARY:Short"), "SUMMARY:Short");
  });

  test("a long line is split with a leading space on continuations", () => {
    const folded = foldLine("SUMMARY:" + "x".repeat(200));
    const parts = folded.split("\r\n");
    assert.ok(parts.length > 1, "should have been folded");
    for (const p of parts.slice(1)) {
      assert.ok(p.startsWith(" "), "continuation lines begin with a space");
    }
  });

  test("no line exceeds 75 octets", () => {
    const folded = foldLine("DESCRIPTION:" + "y".repeat(500));
    for (const p of folded.split("\r\n")) {
      assert.ok(new TextEncoder().encode(p).length <= 75, `line too long: ${p.length}`);
    }
  });

  test("multi-byte characters are not split through the middle", () => {
    const folded = foldLine("SUMMARY:" + "é".repeat(100));
    for (const p of folded.split("\r\n")) {
      assert.ok(new TextEncoder().encode(p).length <= 75);
    }
    // Unfolding per RFC 5545 removes the CRLF *and* the single space after it.
    const unfolded = folded.replace(/\r\n /g, "");
    assert.equal(unfolded.replace(/^SUMMARY:/, ""), "é".repeat(100));
  });
});

describe("buildCalendar", () => {
  const NOW = new Date("2026-10-12T15:00:00Z");

  test("produces a well-formed calendar", () => {
    const out = buildCalendar([event()], "https://example.test", NOW);
    assert.ok(out.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(out.trimEnd().endsWith("END:VCALENDAR"));
    assert.equal((out.match(/BEGIN:VEVENT/g) ?? []).length, 1);
    assert.equal((out.match(/END:VEVENT/g) ?? []).length, 1);
  });

  test("every line ends CRLF, as the spec requires", () => {
    const out = buildCalendar([event()], "https://example.test", NOW);
    const bare = out.split("\r\n").join("");
    assert.ok(!bare.includes("\n"), "no stray bare newlines");
  });

  test("an all-day event ends the following day, since DTEND is exclusive", () => {
    const out = buildCalendar([event({ dueDate: "2026-10-12" })], "https://x.test", NOW);
    assert.match(out, /DTSTART;VALUE=DATE:20261012/);
    assert.match(out, /DTEND;VALUE=DATE:20261013/);
  });

  test("month and year roll over correctly", () => {
    const out = buildCalendar([event({ dueDate: "2026-12-31" })], "https://x.test", NOW);
    assert.match(out, /DTEND;VALUE=DATE:20270101/);
  });

  test("a done task is marked completed rather than hidden", () => {
    const out = buildCalendar([event({ status: "done" })], "https://x.test", NOW);
    assert.match(out, /STATUS:COMPLETED/);
    assert.match(out, /SUMMARY:Done: Confirm setlist/);
  });

  test("a title containing a comma cannot break the format", () => {
    const out = buildCalendar(
      [event({ title: "Lunch, then setup; bring gear" })],
      "https://x.test",
      NOW,
    );
    assert.match(out, /SUMMARY:Lunch\\, then setup\; bring gear/);
  });

  test("a title containing a newline cannot inject a fake property", () => {
    const out = buildCalendar(
      [event({ title: "Innocent\r\nSUMMARY:Injected" })],
      "https://x.test",
      NOW,
    );
    assert.equal((out.match(/^SUMMARY:/gm) ?? []).length, 1, "only one real SUMMARY");
    assert.match(out, /Innocent\\nSUMMARY:Injected/);
  });

  test("each task gets a stable unique id", () => {
    const out = buildCalendar([event()], "https://x.test", NOW);
    assert.match(out, /UID:task-11111111-1111-1111-1111-111111111111@church-ops/);
  });

  test("an empty feed is still a valid calendar", () => {
    const out = buildCalendar([], "https://x.test", NOW);
    assert.ok(out.includes("BEGIN:VCALENDAR"));
    assert.ok(!out.includes("BEGIN:VEVENT"));
  });
});
