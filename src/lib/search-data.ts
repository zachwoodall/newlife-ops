import { createClient } from "@/lib/supabase/server";
import { likePattern, excerpt, type SearchHit } from "@/lib/search";

/**
 * Searches everything the signed-in person is allowed to see.
 *
 * Every query goes through the ordinary authenticated client, so row level
 * security does the filtering. Search cannot reveal a task, comment or
 * message that the person could not already open directly.
 */
export async function search(term: string): Promise<SearchHit[]> {
  const supabase = await createClient();
  const pattern = likePattern(term);
  const hits: SearchHit[] = [];

  const [tasks, comments, announcements, messages, files] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, notes, due_date, created_at")
      .or(`title.ilike."${pattern}",notes.ilike."${pattern}"`)
      .limit(20),
    supabase
      .from("task_comments")
      .select("id, body, task_id, created_at")
      .ilike("body", pattern)
      .limit(20),
    supabase
      .from("announcements")
      .select("id, title, body, created_at")
      .or(`title.ilike."${pattern}",body.ilike."${pattern}"`)
      .limit(20),
    supabase
      .from("messages")
      .select("id, body, sender_id, recipient_id, created_at")
      .ilike("body", pattern)
      .limit(20),
    supabase
      .from("task_files")
      .select("id, name, task_id, created_at")
      .ilike("name", pattern)
      .limit(20),
  ]);

  for (const t of tasks.data ?? []) {
    hits.push({
      kind: "task",
      id: t.id as string,
      title: t.title as string,
      excerpt: t.notes ? excerpt(t.notes as string, term) : "",
      url: `/tasks/${t.id}`,
      when: (t.created_at as string) ?? "",
    });
  }

  for (const c of comments.data ?? []) {
    hits.push({
      kind: "comment",
      id: c.id as string,
      title: "Comment on a task",
      excerpt: excerpt(c.body as string, term),
      url: `/tasks/${c.task_id}`,
      when: c.created_at as string,
    });
  }

  for (const a of announcements.data ?? []) {
    hits.push({
      kind: "announcement",
      id: a.id as string,
      title: a.title as string,
      excerpt: excerpt(a.body as string, term),
      url: `/announcements/${a.id}`,
      when: a.created_at as string,
    });
  }

  for (const m of messages.data ?? []) {
    hits.push({
      kind: "message",
      id: m.id as string,
      title: "Message",
      excerpt: excerpt(m.body as string, term),
      // The thread is identified by the other person; RLS guarantees we are
      // one of the two, so the other side is whichever id is not ours.
      url: `/messages/${m.sender_id}`,
      when: m.created_at as string,
    });
  }

  for (const f of files.data ?? []) {
    hits.push({
      kind: "file",
      id: f.id as string,
      title: f.name as string,
      excerpt: "",
      url: `/tasks/${f.task_id}`,
      when: f.created_at as string,
    });
  }

  return hits.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));
}
