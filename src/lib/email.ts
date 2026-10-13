/**
 * Turning notifications into an email.
 *
 * One message per person per run rather than one per notification: being
 * tagged on three tasks at once should not mean three emails. The formatting
 * lives here, separate from sending, so it can be tested without a network.
 */

export type PendingNotification = {
  id: string;
  kind: string;
  summary: string;
  url: string;
  created_at: string;
};

export type Recipient = {
  personId: string;
  email: string;
  name: string;
  notifications: PendingNotification[];
};

/** Anything interpolated into the HTML body has to be escaped. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function subjectFor(r: Recipient): string {
  const n = r.notifications.length;
  if (n === 1) return r.notifications[0].summary;
  return `${n} updates in Church Ops`;
}

/**
 * The plain-text body. Sent alongside the HTML so the mail still reads
 * properly in clients that refuse HTML.
 */
export function textBody(r: Recipient, baseUrl: string): string {
  const lines = [`Hello ${r.name},`, ""];
  for (const n of r.notifications) {
    lines.push(`- ${n.summary}`);
    lines.push(`  ${baseUrl}${n.url}`);
  }
  lines.push("", `Open Church Ops: ${baseUrl}`);
  return lines.join("\n");
}

export function htmlBody(r: Recipient, baseUrl: string): string {
  const items = r.notifications
    .map(
      (n) =>
        `<li style="margin:0 0 12px"><a href="${escapeHtml(baseUrl + n.url)}" ` +
        `style="color:#1d4ed8;text-decoration:none">${escapeHtml(n.summary)}</a></li>`,
    )
    .join("");

  return [
    `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;color:#171717">`,
    `<p>Hello ${escapeHtml(r.name)},</p>`,
    `<ul style="padding-left:18px">${items}</ul>`,
    `<p style="color:#737373;font-size:13px">`,
    `<a href="${escapeHtml(baseUrl)}" style="color:#1d4ed8">Open Church Ops</a>`,
    `</p></div>`,
  ].join("");
}

/**
 * Group pending notifications by person, dropping anyone without an address.
 * Someone with no email cannot be written to, and their notifications must
 * still be marked sent or the sender retries them forever.
 */
export function groupForSending(
  rows: (PendingNotification & { person_id: string })[],
  people: Map<string, { email: string | null; name: string }>,
): { recipients: Recipient[]; undeliverable: string[] } {
  const byPerson = new Map<string, PendingNotification[]>();
  for (const row of rows) {
    const list = byPerson.get(row.person_id) ?? [];
    list.push(row);
    byPerson.set(row.person_id, list);
  }

  const recipients: Recipient[] = [];
  const undeliverable: string[] = [];

  for (const [personId, notifications] of byPerson) {
    const person = people.get(personId);
    if (!person?.email) {
      undeliverable.push(...notifications.map((n) => n.id));
      continue;
    }
    recipients.push({
      personId,
      email: person.email,
      name: person.name,
      notifications: notifications.sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    });
  }

  return { recipients, undeliverable };
}
