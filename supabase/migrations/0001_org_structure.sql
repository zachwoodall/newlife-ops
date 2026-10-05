-- Milestone 3: campuses, people, positions, and the task-assignment rule.
--
-- Positions are separate from people so the schema can hold open roles,
-- positions shared by two people, and people holding roles at both campuses.

-- ---------------------------------------------------------------- tables

create table if not exists campuses (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists people (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,
  full_name     text not null,
  -- Nullable: staff exist in the org chart before they have a login.
  email         text unique,
  -- Set when the person signs up; links this row to Supabase auth.
  auth_user_id  uuid unique,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists positions (
  id             uuid primary key default gen_random_uuid(),
  key            text unique not null,
  title          text not null,
  department     text not null,
  campus_id      uuid not null references campuses (id) on delete restrict,
  -- null = top of the tree, or not yet assigned a supervisor.
  reports_to_id  uuid references positions (id) on delete set null,
  -- Campus leads may assign tasks to anyone at their campus.
  campus_lead    boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint positions_no_self_report
    check (reports_to_id is null or reports_to_id <> id)
);

-- A position with no rows here is an open role.
-- A position with two rows is a shared role.
create table if not exists position_holders (
  position_id  uuid not null references positions (id) on delete cascade,
  person_id    uuid not null references people (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (position_id, person_id)
);

create index if not exists positions_reports_to_idx on positions (reports_to_id);
create index if not exists positions_campus_idx     on positions (campus_id);
create index if not exists holders_person_idx       on position_holders (person_id);

-- ------------------------------------------------------------- functions

-- Is `descendant` anywhere below `ancestor` in the reporting tree?
-- Depth-capped so corrupt data can never hang a query.
create or replace function position_is_below (descendant uuid, ancestor uuid)
returns boolean
language sql
stable
as $$
  with recursive chain (id, depth) as (
    select reports_to_id, 1
      from positions
     where id = descendant
       and reports_to_id is not null
    union all
    select p.reports_to_id, c.depth + 1
      from positions p
      join chain c on p.id = c.id
     where p.reports_to_id is not null
       and c.depth < 50
  )
  select descendant is distinct from ancestor
     and exists (select 1 from chain where id = ancestor);
$$;

-- May `assigner` give a task to `assignee`?
--   1. The assignee holds a position below one of the assigner's positions, or
--   2. The assigner is a campus lead and the assignee holds a position at that
--      same campus. Union Hill directors report to Holly Springs department
--      heads, so without this the campus pastor could not assign to his own staff.
-- Assigning to yourself is allowed. Assigning upward never is.
create or replace function can_assign_task (assigner uuid, assignee uuid)
returns boolean
language sql
stable
as $$
  select case
    when assigner = assignee then true
    else exists (
      select 1
        from position_holders ha
        join positions a on a.id = ha.position_id
        join position_holders hb on hb.person_id = assignee
        join positions b on b.id = hb.position_id
       where ha.person_id = assigner
         and (
           position_is_below(b.id, a.id)
           or (a.campus_lead and b.campus_id = a.campus_id and b.id <> a.id)
         )
    )
  end;
$$;

-- -------------------------------------------------------------- integrity

-- Reject a reporting change that would create a loop, which would otherwise
-- orphan everyone beneath it and break every chart that walks the tree.
create or replace function positions_reject_cycle ()
returns trigger
language plpgsql
as $$
begin
  if new.reports_to_id is not null
     and position_is_below(new.reports_to_id, new.id) then
    raise exception
      'Cycle: % cannot report to %, which is already below it',
      new.key, (select key from positions where id = new.reports_to_id);
  end if;
  return new;
end;
$$;

drop trigger if exists positions_cycle_guard on positions;
create trigger positions_cycle_guard
  before insert or update of reports_to_id on positions
  for each row execute function positions_reject_cycle ();
