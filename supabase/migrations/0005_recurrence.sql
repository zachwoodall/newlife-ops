-- Milestone 9: recurring tasks.
--
-- A repeating job is a SERIES (the schedule) that generates dated
-- OCCURRENCES (ordinary rows in tasks). Completing this week's setlist
-- must not erase the fact that next week's is still due, which is only
-- possible if each week is its own row.

create table if not exists task_series (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(btrim(title)) > 0),
  notes      text,
  owner_id   uuid not null references people (id) on delete cascade,
  created_by uuid references people (id) on delete set null,
  cadence    text not null
             check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  starts_on  date not null,
  ends_on    date,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  constraint series_ends_after_start
    check (ends_on is null or ends_on >= starts_on)
);

alter table tasks add column if not exists series_id uuid
  references task_series (id) on delete cascade;
alter table tasks add column if not exists occurrence_date date;

-- One row per series per date, so topping up can never duplicate.
create unique index if not exists tasks_series_occurrence_idx
  on tasks (series_id, occurrence_date)
  where series_id is not null;

create index if not exists series_owner_idx on task_series (owner_id);

-- ------------------------------------------------------------- date math

-- The nth date in a series, always measured from the start date.
-- Stepping one interval at a time would drift: Jan 31 -> Feb 28 -> Mar 28.
-- Measuring from the start gives Jan 31 -> Feb 28 -> Mar 31, which is right.
create or replace function nth_occurrence (start_on date, cadence text, n integer)
returns date
language sql
immutable
as $$
  select case cadence
    when 'weekly'    then start_on + (n * interval '7 days')
    when 'monthly'   then start_on + (n * interval '1 month')
    when 'quarterly' then start_on + (n * interval '3 months')
    when 'yearly'    then start_on + (n * interval '1 year')
  end::date;
$$;

-- Top a series up so it has `horizon` occurrences dated today or later.
-- Runs as the function owner so it can write occurrences, but refuses to
-- act for anyone who does not own or did not create the series.
create or replace function generate_occurrences (p_series uuid, p_horizon integer default 4)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s        task_series%rowtype;
  n        integer := 0;
  d        date;
  made     integer := 0;
  upcoming integer;
begin
  select * into s from task_series where id = p_series and active;
  if not found then
    return 0;
  end if;

  if current_person_id() is distinct from s.owner_id
     and current_person_id() is distinct from s.created_by then
    raise exception 'Not your series';
  end if;

  select count(*) into upcoming
    from tasks
   where series_id = p_series
     and occurrence_date >= current_date;

  while upcoming < p_horizon loop
    d := nth_occurrence(s.starts_on, s.cadence, n);
    exit when d is null;
    exit when s.ends_on is not null and d > s.ends_on;

    if d >= current_date then
      insert into tasks (title, notes, owner_id, created_by, cadence,
                         due_date, series_id, occurrence_date)
      values (s.title, s.notes, s.owner_id, s.created_by, s.cadence,
              d, s.id, d)
      on conflict do nothing;

      if found then
        made := made + 1;
        upcoming := upcoming + 1;
      end if;
    end if;

    n := n + 1;
    -- A long-dormant yearly series should not spin forever.
    exit when n > 600;
  end loop;

  return made;
end;
$$;

-- ------------------------------------------------------------------ RLS

alter table task_series enable row level security;

drop policy if exists "read own series" on task_series;
create policy "read own series" on task_series
  for select to authenticated
  using (owner_id = current_person_id() or created_by = current_person_id());

drop policy if exists "create series downward" on task_series;
create policy "create series downward" on task_series
  for insert to authenticated
  with check (
    created_by = current_person_id()
    and can_assign_task(current_person_id(), owner_id)
  );

drop policy if exists "update own series" on task_series;
create policy "update own series" on task_series
  for update to authenticated
  using (owner_id = current_person_id() or created_by = current_person_id())
  with check (
    owner_id = current_person_id()
    or can_assign_task(current_person_id(), owner_id)
  );

drop policy if exists "delete created series" on task_series;
create policy "delete created series" on task_series
  for delete to authenticated
  using (created_by = current_person_id());
