-- Milestone 8: the project board behind each task.
--
-- Adds the checklist of sub-items, and tightens co-assignment so that tagging
-- a helper obeys the same downward-only rule as owning a task. Tagging someone
-- is handing them work, so it should not be a way around the org chart.

create table if not exists task_checklist (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks (id) on delete cascade,
  label      text not null check (length(btrim(label)) > 0),
  done       boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists checklist_task_idx on task_checklist (task_id, sort_order);

alter table task_checklist enable row level security;

-- Anyone who can see the task can see and tick its checklist. Helpers tagged
-- onto a task need to work it, not just read it.
drop policy if exists "read checklist" on task_checklist;
create policy "read checklist" on task_checklist
  for select to authenticated
  using (can_see_task(task_id));

drop policy if exists "tick checklist" on task_checklist;
create policy "tick checklist" on task_checklist
  for update to authenticated
  using (can_see_task(task_id))
  with check (can_see_task(task_id));

-- Adding and removing items stays with the owner or creator.
drop policy if exists "add checklist" on task_checklist;
create policy "add checklist" on task_checklist
  for insert to authenticated
  with check (can_manage_task(task_id));

drop policy if exists "remove checklist" on task_checklist;
create policy "remove checklist" on task_checklist
  for delete to authenticated
  using (can_manage_task(task_id));

-- Co-assignment now has to clear the org chart as well.
drop policy if exists "manage assignees" on task_assignees;
create policy "manage assignees" on task_assignees
  for all to authenticated
  using (can_manage_task(task_id))
  with check (
    can_manage_task(task_id)
    and can_assign_task(current_person_id(), person_id)
  );
