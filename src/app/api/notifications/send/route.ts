import { createClient } from "@supabase/supabase-js";
import {
  groupForSending,
  subjectFor,
  textBody,
  htmlBody,
  type PendingNotification,
} from "@/lib/email";

/**
 * Sends pending notifications as email, one message per person per run.
 *
 * Invoked on a schedule by Vercel Cron, not by anyone signed in. It needs to
 * read notifications belonging to everyone, which no user session can do, so
 * it uses the service role key -- the one place in this app that key is used,
 * and only ever server-side in this route.
 *
 * Two guards, because that key bypasses every permission rule:
 *   * the request must carry the cron secret;
 *   * the route refuses to run at all if either secret is unset, rather than
 *     silently becoming an open endpoint.
 */

const BATCH = 100;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;

  if (!cronSecret || !serviceKey) {
    return Response.json(
      { error: "Email sending is not configured." },
      { status: 503 },
    );
  }

  // Vercel Cron sends this header; nothing else should reach here.
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  if (!resendKey || !from) {
    return Response.json(
      { error: "RESEND_API_KEY or NOTIFICATION_FROM_EMAIL is unset." },
      { status: 503 },
    );
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: pending, error } = await admin
    .from("notifications")
    .select("id, person_id, kind, summary, url, created_at")
    .is("emailed_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!pending?.length) return Response.json({ sent: 0, recipients: 0 });

  const { data: people } = await admin.from("people").select("id, full_name, email");
  const byId = new Map(
    (people ?? []).map((p) => [
      p.id as string,
      { email: (p.email as string | null) ?? null, name: (p.full_name as string) ?? "there" },
    ]),
  );

  const { recipients, undeliverable } = groupForSending(
    pending as (PendingNotification & { person_id: string })[],
    byId,
  );

  const baseUrl = new URL(request.url).origin;
  const sentIds: string[] = [];
  const failures: string[] = [];

  for (const r of recipients) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [r.email],
          subject: subjectFor(r),
          text: textBody(r, baseUrl),
          html: htmlBody(r, baseUrl),
        }),
      });

      if (res.ok) {
        sentIds.push(...r.notifications.map((n) => n.id));
      } else {
        // Leave them unsent so the next run retries.
        const body = await res.text();
        failures.push(`${r.email}: ${res.status} ${body.slice(0, 120)}`);
      }
    } catch (err) {
      failures.push(`${r.email}: ${err instanceof Error ? err.message : "network error"}`);
    }
  }

  // Undeliverable rows are marked too -- they can never succeed, and leaving
  // them would make every future run retry them forever.
  const toMark = [...sentIds, ...undeliverable];
  if (toMark.length) {
    await admin
      .from("notifications")
      .update({ emailed_at: new Date().toISOString() })
      .in("id", toMark);
  }

  return Response.json({
    sent: sentIds.length,
    recipients: recipients.length,
    skippedNoAddress: undeliverable.length,
    failures,
  });
}
