import { createClient } from "@supabase/supabase-js";
import { buildCalendar, type FeedEvent } from "@/lib/ical";

/**
 * A subscribable calendar feed. Deliberately unauthenticated: calendar apps
 * cannot sign in, so the token in the URL is the credential.
 *
 * This uses a bare anon client rather than the cookie-based one -- there is no
 * session here by design. calendar_feed() is security definer and validates
 * the token itself, returning nothing for an unknown one.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc("calendar_feed", { p_token: token });

  if (error) {
    // Don't leak whether the token simply doesn't exist.
    return new Response("Calendar unavailable", { status: 404 });
  }

  const events: FeedEvent[] = (data ?? []).map(
    (r: {
      task_id: string;
      title: string;
      due_date: string;
      status: string;
      is_owner: boolean;
    }) => ({
      taskId: r.task_id,
      title: r.title,
      dueDate: r.due_date,
      status: r.status,
      isOwner: r.is_owner,
    }),
  );

  const origin = new URL(request.url).origin;

  return new Response(buildCalendar(events, origin), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="church-ops.ics"',
      // Calendar clients poll; let them, but not constantly.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
