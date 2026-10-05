-- Row Level Security.
--
-- Without this, the anon key — which is embedded in every browser that loads
-- the app — can read and write every staff record. These policies close that:
-- anon gets nothing, signed-in staff can read the org, and writes stay shut
-- until the editable org chart lands in Milestone 5.

alter table campuses         enable row level security;
alter table people           enable row level security;
alter table positions        enable row level security;
alter table position_holders enable row level security;

-- Signed-in staff can read the whole org chart. Everyone needs to see
-- reporting lines to know who they may assign work to.
drop policy if exists "staff read campuses" on campuses;
create policy "staff read campuses" on campuses
  for select to authenticated using (true);

drop policy if exists "staff read people" on people;
create policy "staff read people" on people
  for select to authenticated using (true);

drop policy if exists "staff read positions" on positions;
create policy "staff read positions" on positions
  for select to authenticated using (true);

drop policy if exists "staff read holders" on position_holders;
create policy "staff read holders" on position_holders
  for select to authenticated using (true);

-- No insert/update/delete policies yet, so writes are denied for everyone
-- except the service role, which bypasses RLS. Editing arrives in Milestone 5.
