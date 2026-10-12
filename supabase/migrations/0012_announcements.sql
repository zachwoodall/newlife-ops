-- Improvement 3: announcements.
--
-- Messages are strictly one to one, so telling the whole staff anything meant
-- fourteen separate conversations, and nobody could see that everyone else had
-- been told.
--
-- An announcement is posted once, to everyone or to one department, and
-- carries its replies with it. Posting is open to anyone on staff: tasks flow
-- downward, but information does not, and messages already work in either
-- direction.

create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references people (id) on delete cascade,
  title      text not null check (length(btrim(title)) > 0),
  body       text not null check (length(btrim(body)) > 0),
  -- Either everyone, or one department by name.
  audience   text not null default 'all' check (audience in ('all', 'department')),
  department text,
  created_at timestamptz not null default now(),
  -- A department post must say which; an all-staff post must not.
  constraint announcement_audience_matches_department check (
    (audience = 'all' and department is null)
    or (audience = 'department' and department is not null)
  )
);

create index if not exists announcements_recent_idx
  on announcements (created_at desc);

create table if not exists announcement_replies (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements (id) on delete cascade,
  author_id       uuid not null references people (id) on delete cascade,
  body            text not null check (length(btrim(body)) > 0),
  created_at      timestamptz not null default now()
);

create index if not exists announcement_replies_idx
  on announcement_replies (announcement_id, created_at);

alter table announcements enable row level security;
alter table announcement_replies enable row level security;

/** The departments a person currently holds a position in. */
create or replace function my_departments()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.department
  from position_holders ph
  join positions p on p.id = ph.position_id
  where ph.person_id = current_person_id()
    and p.department is not null;
$$;

drop policy if exists "read announcements" on announcements;
create policy "read announcements" on announcements
  for select to authenticated
  using (
    audience = 'all'
    or department in (select my_departments())
  );

drop policy if exists "post announcements" on announcements;
create policy "post announcements" on announcements
  for insert to authenticated
  with check (author_id = current_person_id());

-- Only the author edits or withdraws their own announcement.
drop policy if exists "edit own announcements" on announcements;
create policy "edit own announcements" on announcements
  for update to authenticated
  using (author_id = current_person_id())
  with check (author_id = current_person_id());

drop policy if exists "withdraw own announcements" on announcements;
create policy "withdraw own announcements" on announcements
  for delete to authenticated
  using (author_id = current_person_id());

-- Replies are visible to, and open to, whoever can see the announcement.
drop policy if exists "read replies" on announcement_replies;
create policy "read replies" on announcement_replies
  for select to authenticated
  using (
    exists (select 1 from announcements a where a.id = announcement_id)
  );

drop policy if exists "post replies" on announcement_replies;
create policy "post replies" on announcement_replies
  for insert to authenticated
  with check (
    author_id = current_person_id()
    and exists (select 1 from announcements a where a.id = announcement_id)
  );

-- Your own reply, or the announcement author clearing their thread.
drop policy if exists "remove replies" on announcement_replies;
create policy "remove replies" on announcement_replies
  for delete to authenticated
  using (
    author_id = current_person_id()
    or exists (
      select 1 from announcements a
      where a.id = announcement_id and a.author_id = current_person_id()
    )
  );

-- An announcement is only useful if people learn about it.
create or replace function notify_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text;
begin
  select full_name into v_author from people where id = new.author_id;

  insert into notifications (person_id, kind, actor_id, summary, url)
  select
    pe.id,
    'announcement',
    new.author_id,
    coalesce(v_author, 'Someone') || ' posted: ' || new.title,
    '/announcements/' || new.id
  from people pe
  where pe.id is distinct from new.author_id
    and (
      new.audience = 'all'
      or exists (
        select 1
        from position_holders ph
        join positions po on po.id = ph.position_id
        where ph.person_id = pe.id and po.department = new.department
      )
    );

  return new;
end;
$$;

drop trigger if exists announcement_notifies on announcements;
create trigger announcement_notifies
  after insert on announcements
  for each row execute function notify_announcement();

-- 0011 shipped before announcements existed, so widen its kind check for
-- databases where that migration has already been applied.
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('assigned', 'comment', 'message', 'announcement'));
