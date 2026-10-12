-- Improvement 8: automatic check-ins.
--
-- A recurring question -- "What are you preaching on Sunday?" -- asked on a
-- schedule, with everyone's answers collected in one place instead of a
-- meeting or fourteen separate messages.
--
-- Nothing is scheduled. An answer records the period it belongs to, and the
-- page asks for the current period, so a new week or month simply stops
-- matching and the question is open again. The same approach as the weekly
-- board: no job to run, none to miss, and past answers are kept.

create table if not exists checkins (
  id         uuid primary key default gen_random_uuid(),
  question   text not null check (length(btrim(question)) > 0),
  cadence    text not null default 'weekly' check (cadence in ('weekly', 'monthly')),
  -- null means everyone on staff; otherwise one department.
  department text,
  created_by uuid references people (id) on delete set null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists checkin_answers (
  id         uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references checkins (id) on delete cascade,
  person_id  uuid not null references people (id) on delete cascade,
  -- Which week or month this answers, as the first day of that period.
  period     date not null,
  body       text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  -- One answer per person per question per period; answering again edits it.
  unique (checkin_id, person_id, period)
);

create index if not exists checkin_answers_period_idx
  on checkin_answers (checkin_id, period, created_at);

alter table checkins enable row level security;
alter table checkin_answers enable row level security;

drop policy if exists "read checkins" on checkins;
create policy "read checkins" on checkins
  for select to authenticated
  using (department is null or department in (select my_departments()));

-- Anyone can start a check-in, for everyone or a department they are in.
drop policy if exists "create checkins" on checkins;
create policy "create checkins" on checkins
  for insert to authenticated
  with check (
    created_by = current_person_id()
    and (department is null or department in (select my_departments()))
  );

drop policy if exists "edit own checkins" on checkins;
create policy "edit own checkins" on checkins
  for update to authenticated
  using (created_by = current_person_id())
  with check (created_by = current_person_id());

drop policy if exists "remove own checkins" on checkins;
create policy "remove own checkins" on checkins
  for delete to authenticated
  using (created_by = current_person_id());

-- Answers are visible to everyone who can see the question. That is the
-- point: the whole staff reads each other's answers instead of meeting.
drop policy if exists "read answers" on checkin_answers;
create policy "read answers" on checkin_answers
  for select to authenticated
  using (exists (select 1 from checkins c where c.id = checkin_id));

drop policy if exists "answer checkins" on checkin_answers;
create policy "answer checkins" on checkin_answers
  for insert to authenticated
  with check (
    person_id = current_person_id()
    and exists (select 1 from checkins c where c.id = checkin_id)
  );

-- You can revise your own answer, never anyone else's.
drop policy if exists "revise own answer" on checkin_answers;
create policy "revise own answer" on checkin_answers
  for update to authenticated
  using (person_id = current_person_id())
  with check (person_id = current_person_id());

drop policy if exists "withdraw own answer" on checkin_answers;
create policy "withdraw own answer" on checkin_answers
  for delete to authenticated
  using (person_id = current_person_id());
