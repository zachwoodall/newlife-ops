import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  subjectFor,
  textBody,
  htmlBody,
  groupForSending,
  type Recipient,
  type PendingNotification,
} from "./email.ts";

const note = (over: Partial<PendingNotification> = {}): PendingNotification => ({
  id: "n1",
  kind: "comment",
  summary: "Levi Porter commented on \"Stage plot\"",
  url: "/tasks/abc",
  created_at: "2026-10-12T10:00:00Z",
  ...over,
});

const recipient = (over: Partial<Recipient> = {}): Recipient => ({
  personId: "p1",
  email: "zach@newlifecanton.com",
  name: "Zach",
  notifications: [note()],
  ...over,
});

describe("escapeHtml", () => {
  test("escapes the characters that could inject markup", () => {
    assert.equal(escapeHtml("<b>hi</b>"), "&lt;b&gt;hi&lt;/b&gt;");
    assert.equal(escapeHtml('a "quoted" word'), "a &quot;quoted&quot; word");
    assert.equal(escapeHtml("Tom & Jerry"), "Tom &amp; Jerry");
    assert.equal(escapeHtml("it's"), "it&#39;s");
  });

  test("ampersand is escaped first, so nothing double-escapes", () => {
    assert.equal(escapeHtml("&lt;"), "&amp;lt;");
  });
});

describe("subjectFor", () => {
  test("a single notification uses its own wording", () => {
    assert.equal(subjectFor(recipient()), 'Levi Porter commented on "Stage plot"');
  });

  test("several are summarised rather than listed", () => {
    const r = recipient({ notifications: [note(), note({ id: "n2" }), note({ id: "n3" })] });
    assert.equal(subjectFor(r), "3 updates in Church Ops");
  });
});

describe("textBody", () => {
  test("includes every notification and a full link", () => {
    const out = textBody(recipient(), "https://church.test");
    assert.ok(out.includes("Hello Zach,"));
    assert.ok(out.includes('Levi Porter commented on "Stage plot"'));
    assert.ok(out.includes("https://church.test/tasks/abc"));
  });

  test("links are absolute, since email has no origin", () => {
    const out = textBody(recipient(), "https://church.test");
    assert.ok(!out.includes("\n  /tasks/"), "a bare path would not be clickable");
  });
});

describe("htmlBody", () => {
  test("a task title containing markup cannot inject HTML", () => {
    const r = recipient({
      notifications: [note({ summary: 'Someone commented on "<script>alert(1)</script>"' })],
    });
    const out = htmlBody(r, "https://church.test");
    assert.ok(!out.includes("<script>"), "the script tag must not survive");
    assert.ok(out.includes("&lt;script&gt;"));
  });

  test("a crafted url cannot break out of the href attribute", () => {
    const r = recipient({ notifications: [note({ url: '/x" onmouseover="evil()' })] });
    const out = htmlBody(r, "https://church.test");
    assert.ok(!out.includes('onmouseover="evil()"'), "attribute must stay closed");
    assert.ok(out.includes("&quot;"));
  });

  test("the recipient's own name is escaped too", () => {
    const out = htmlBody(recipient({ name: "<b>Zach</b>" }), "https://church.test");
    assert.ok(!out.includes("<b>Zach</b>"));
  });

  test("one list item per notification", () => {
    const r = recipient({ notifications: [note(), note({ id: "n2" })] });
    const out = htmlBody(r, "https://church.test");
    assert.equal((out.match(/<li/g) ?? []).length, 2);
  });
});

describe("groupForSending", () => {
  const people = new Map([
    ["p1", { email: "a@test.com", name: "Ann" }],
    ["p2", { email: "b@test.com", name: "Bob" }],
    ["p3", { email: null, name: "No Email" }],
  ]);

  test("one message per person, not per notification", () => {
    const { recipients } = groupForSending(
      [
        { ...note({ id: "n1" }), person_id: "p1" },
        { ...note({ id: "n2" }), person_id: "p1" },
        { ...note({ id: "n3" }), person_id: "p2" },
      ],
      people,
    );
    assert.equal(recipients.length, 2, "two people, two emails");
    assert.equal(recipients.find((r) => r.personId === "p1")!.notifications.length, 2);
  });

  test("someone with no address is reported rather than silently retried", () => {
    const { recipients, undeliverable } = groupForSending(
      [{ ...note({ id: "n9" }), person_id: "p3" }],
      people,
    );
    assert.equal(recipients.length, 0);
    assert.deepEqual(undeliverable, ["n9"], "must be marked sent or it retries forever");
  });

  test("an unknown person is treated as undeliverable, not a crash", () => {
    const { recipients, undeliverable } = groupForSending(
      [{ ...note({ id: "n8" }), person_id: "ghost" }],
      people,
    );
    assert.equal(recipients.length, 0);
    assert.deepEqual(undeliverable, ["n8"]);
  });

  test("each person's notifications read oldest first", () => {
    const { recipients } = groupForSending(
      [
        { ...note({ id: "late", created_at: "2026-10-12T12:00:00Z" }), person_id: "p1" },
        { ...note({ id: "early", created_at: "2026-10-12T09:00:00Z" }), person_id: "p1" },
      ],
      people,
    );
    assert.deepEqual(recipients[0].notifications.map((n) => n.id), ["early", "late"]);
  });

  test("nothing pending yields nothing to send", () => {
    const { recipients, undeliverable } = groupForSending([], people);
    assert.equal(recipients.length, 0);
    assert.equal(undeliverable.length, 0);
  });
});
