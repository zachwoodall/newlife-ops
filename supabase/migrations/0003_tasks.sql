-- Milestone 6: tasks, co-assignees, and the permission rules around them.

-- Who is signed in, as a row in `people`.
-- Matched on the email in the JWT, which is how a login is tied to a person.
create or replace function current_person_id ()
returns uuid
language sql
stable
as $$
  select p.id
    from people p
   where p.email is not null
     and lower(p.email) = lower(
       coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
         ''
       )
     )
   limit 1;
$$;

create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(btrim(title)) > 0),
  notes        text,
  -- The person responsible. Tasks always have exactly one owner.
  owner_id     uuid not null references people (id) on delete cascade,
  created_by   uuid references people (id) on delete set null,
  campus_id    uuid references campuses (id) on delete set null,
  -- 'once' is a one-off; the rest recur. Recurrence itself lands in M9.
  cadence      text not null default 'once'
               check (cadence in ('once', 'weekly', 'monthly', 'quarterly', 'yearly')),
  -- 'project' opens a full board; 'todo' is a weekly checklist item (M13).
  kind         text not null default 'project'
               check (kind in ('project', 'todo')),
  status       text not null default 'open'
               check (status in ('open', 'in_progress', 'done')),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  -- Keep completed_at honest: set when done, cleared when not.
  constraint tasks_completed_matches_status
    check ((status = 'done') = (completed_at is not null))
);

-- Helpers tagged onto a task, with what they are doing on it.
create table if not exists task_assignees (
  task_id    uuid not null references tasks (id) on delete cascade,
  person_id  uuid not null references people (id) on delete cascade,
  role_label text,
  created_at timestamptz not null default now(),
  primary key (task_id, person_id)
);

create index if not exists tasks_owner_idx    on tasks (owner_id);
create index if not exists tasks_due_idx      on tasks (due_date);
create index if not exists tasks_status_idx   on tasks (status);
create index if not exists assignees_person_idx on task_assignees (person_id);

-- ------------------------------------------------------------------ RLS

-- These three run as the function owner, which bypasses RLS inside them.
-- That is deliberate: the tasks policy needs to look at task_assignees and
-- the task_assignees policy needs to look at tasks, and without the bypass
-- those two policies call each other forever (Postgres error 42P17).

create or replace function is_task_assignee (t uuid, p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from task_assignees ta
     where ta.task_id = t and ta.person_id = p
  );
$$;

create or replace function can_see_task (t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from tasks x
     where x.id = t
       and (
         x.owner_id = current_person_id()
         or x.created_by = current_person_id()
         or is_task_assignee(x.id, current_person_id())
       )
  );
$$;

create or replace function can_manage_task (t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from tasks x
     where x.id = t
       and (x.owner_id = current_person_id() or x.created_by = current_person_id())
  );
$$;

alter table tasks          enable row level security;
alter table task_assignees enable row level security;

-- You see a task if you own it, created it, or were tagged onto it.
drop policy if exists "read own tasks" on tasks;
create policy "read own tasks" on tasks
  for select to authenticated
  using (
    owner_id = current_person_id()
    or created_by = current_person_id()
    or is_task_assignee(id, current_person_id())
  );

-- You may only create a task for someone you are allowed to assign to.
-- This is the downward-only rule, enforced where it cannot be bypassed.
drop policy if exists "create tasks downward" on tasks;
create policy "create tasks downward" on tasks
  for insert to authenticated
  with check (
    created_by = current_person_id()
    and can_assign_task(current_person_id(), owner_id)
  );

-- Owner or creator may edit; reassignment still has to obey the rule.
drop policy if exists "update own tasks" on tasks;
create policy "update own tasks" on tasks
  for update to authenticated
  using (
    owner_id = current_person_id() or created_by = current_person_id()
  )
  with check (
    owner_id = current_person_id()
    or can_assign_task(current_person_id(), owner_id)
  );

drop policy if exists "delete created tasks" on tasks;
create policy "delete created tasks" on tasks
  for delete to authenticated
  using (created_by = current_person_id());

-- Co-assignees are visible to anyone who can see the task.
drop policy if exists "read assignees" on task_assignees;
create policy "read assignees" on task_assignees
  for select to authenticated
  using (can_see_task(task_id));

-- Only the owner or creator may tag helpers onto a task.
drop policy if exists "manage assignees" on task_assignees;
create policy "manage assignees" on task_assignees
  for all to authenticated
  using (can_manage_task(task_id))
  with check (can_manage_task(task_id));
