-- Folders for the files area.
--
-- Everything landed in one undifferentiated list, which is fine for a dozen
-- files and useless for training material organised by department.
--
-- A folder carries its own audience, the same way a file does. Putting a file
-- in a department folder does NOT change who can see the file: the file's own
-- department still governs that. Folders organise; they do not grant or
-- revoke. Conflating the two is how people accidentally publish things.

create table if not exists library_folders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  description text,
  -- null means everyone on staff; otherwise one department.
  department  text,
  created_by  uuid references people (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists library_folders_name_idx on library_folders (name);

-- Deleting a folder must not destroy what is in it: the files survive and
-- fall back to the unfiled list.
alter table library_files
  add column if not exists folder_id uuid references library_folders (id) on delete set null;

create index if not exists library_files_folder_idx on library_files (folder_id);

alter table library_folders enable row level security;

drop policy if exists "read library folders" on library_folders;
create policy "read library folders" on library_folders
  for select to authenticated
  using (department is null or department in (select my_departments()));

-- You can create a folder for everyone, or for a department you are actually
-- in -- not one you merely name.
drop policy if exists "create library folders" on library_folders;
create policy "create library folders" on library_folders
  for insert to authenticated
  with check (
    created_by = current_person_id()
    and (department is null or department in (select my_departments()))
  );

drop policy if exists "edit library folders" on library_folders;
create policy "edit library folders" on library_folders
  for update to authenticated
  using (created_by = current_person_id() or is_admin())
  with check (department is null or department in (select my_departments()) or is_admin());

drop policy if exists "remove library folders" on library_folders;
create policy "remove library folders" on library_folders
  for delete to authenticated
  using (created_by = current_person_id() or is_admin());

-- A cover image of your own choosing.
--
-- ImageKit already generates a thumbnail for images and video, but a document
-- gets none, and an auto-generated frame grab is rarely the right cover for a
-- training video. These are kept separate from thumbnail_url rather than
-- overwriting it, so removing a custom cover falls back to the generated one
-- instead of leaving the file with nothing.
alter table library_files
  add column if not exists cover_url text,
  add column if not exists cover_file_id text;
