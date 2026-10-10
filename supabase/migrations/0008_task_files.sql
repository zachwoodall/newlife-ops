-- Milestone 12: files attached to a task's project board.
--
-- The bytes live in ImageKit; this table is the record of what is attached
-- to which task, so permissions follow the task rather than the CDN.

create table if not exists task_files (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references tasks (id) on delete cascade,
  -- ImageKit's own id, needed to delete the file from storage later.
  imagekit_file_id text not null,
  name             text not null,
  url              text not null,
  thumbnail_url    text,
  kind             text not null default 'document'
                   check (kind in ('image', 'video', 'document')),
  size_bytes       bigint,
  uploaded_by      uuid references people (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists task_files_task_idx on task_files (task_id, created_at);

alter table task_files enable row level security;

-- Anyone who can see the task can see and add its files. Tagged helpers
-- need to attach the thing they were asked to produce.
drop policy if exists "read task files" on task_files;
create policy "read task files" on task_files
  for select to authenticated
  using (can_see_task(task_id));

drop policy if exists "add task files" on task_files;
create policy "add task files" on task_files
  for insert to authenticated
  with check (can_see_task(task_id) and uploaded_by = current_person_id());

-- Remove your own upload, or anything on a task you own or created.
drop policy if exists "remove task files" on task_files;
create policy "remove task files" on task_files
  for delete to authenticated
  using (uploaded_by = current_person_id() or can_manage_task(task_id));
