-- Milestone 13: the weekly to-do board.
--
-- Small recurring reminders, private to each person. Checking an item records
-- the Sunday it belongs to rather than a boolean, so the board resets itself
-- when the week turns — no scheduled job to run, or to miss.

create table if not exists weekly_items (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references people (id) on delete cascade,
  title        text not null check (length(btrim(title)) > 0),
  sort_order   integer not null default 0,
  -- The Sunday (YYYY-MM-DD) of the week this was last checked off; null if never.
  checked_week date,
  created_at   timestamptz not null default now()
);

create index if not exists weekly_items_person_idx
  on weekly_items (person_id, sort_order);

alter table weekly_items enable row level security;

-- A personal list. Nobody else reads it, not even your leader.
drop policy if exists "read own weekly items" on weekly_items;
create policy "read own weekly items" on weekly_items
  for select to authenticated
  using (person_id = current_person_id());

drop policy if exists "add own weekly items" on weekly_items;
create policy "add own weekly items" on weekly_items
  for insert to authenticated
  with check (person_id = current_person_id());

drop policy if exists "change own weekly items" on weekly_items;
create policy "change own weekly items" on weekly_items
  for update to authenticated
  using (person_id = current_person_id())
  with check (person_id = current_person_id());

drop policy if exists "remove own weekly items" on weekly_items;
create policy "remove own weekly items" on weekly_items
  for delete to authenticated
  using (person_id = current_person_id());
