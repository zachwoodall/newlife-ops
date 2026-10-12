-- Improvement 7: a files area that is not attached to a task.
--
-- Uploads could only live on a task board, which is wrong for the things that
-- are not about one piece of work: logos, stage plots, policies, the W-9.
-- They either got attached to an unrelated task or lived in someone's email.
--
-- Same storage and permissions model as task files, with the audience rule
-- borrowed from announcements: everyone, or one department.

create table if not exists library_files (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(btrim(name)) > 0),
  description      text,
  imagekit_file_id text not null,
  url              text not null,
  thumbnail_url    text,
  kind             text not null default 'document'
                   check (kind in ('image', 'video', 'document')),
  size_bytes       bigint,
  -- null means everyone on staff; otherwise one department.
  department       text,
  uploaded_by      uuid references people (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists library_files_recent_idx
  on library_files (created_at desc);

alter table library_files enable row level security;

drop policy if exists "read library files" on library_files;
create policy "read library files" on library_files
  for select to authenticated
  using (
    department is null
    or department in (select my_departments())
  );

-- Anyone on staff can contribute, to everyone or to a department they are
-- actually in -- not one they merely name.
drop policy if exists "add library files" on library_files;
create policy "add library files" on library_files
  for insert to authenticated
  with check (
    uploaded_by = current_person_id()
    and (department is null or department in (select my_departments()))
  );

drop policy if exists "edit own library files" on library_files;
create policy "edit own library files" on library_files
  for update to authenticated
  using (uploaded_by = current_person_id())
  with check (uploaded_by = current_person_id());

drop policy if exists "remove own library files" on library_files;
create policy "remove own library files" on library_files
  for delete to authenticated
  using (uploaded_by = current_person_id());
