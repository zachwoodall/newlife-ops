-- Improvement 1: discussion on a task.
--
-- The board already has `notes`, which is a shared description anyone can
-- overwrite. That is the wrong shape for a conversation: two people editing it
-- lose each other's thinking, and anything resembling back-and-forth ends up
-- in private messages, detached from the work it is about.
--
-- A comment is attributed, ordered, and never silently overwritten.

create table if not exists task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks (id) on delete cascade,
  author_id  uuid not null references people (id) on delete cascade,
  body       text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);

create index if not exists task_comments_task_idx
  on task_comments (task_id, created_at);

alter table task_comments enable row level security;

-- Anyone who can see the task can follow and join its discussion. Tagged
-- helpers need to ask questions about the thing they were asked to do.
drop policy if exists "read task comments" on task_comments;
create policy "read task comments" on task_comments
  for select to authenticated
  using (can_see_task(task_id));

drop policy if exists "add task comments" on task_comments;
create policy "add task comments" on task_comments
  for insert to authenticated
  with check (can_see_task(task_id) and author_id = current_person_id());

-- You may edit only your own words. Nobody edits someone else's comment,
-- including the task owner -- an altered quote is worse than no record.
drop policy if exists "edit own comments" on task_comments;
create policy "edit own comments" on task_comments
  for update to authenticated
  using (author_id = current_person_id())
  with check (author_id = current_person_id());

-- Delete your own; the task owner may also clear a comment off their board.
drop policy if exists "remove comments" on task_comments;
create policy "remove comments" on task_comments
  for delete to authenticated
  using (author_id = current_person_id() or can_manage_task(task_id));
