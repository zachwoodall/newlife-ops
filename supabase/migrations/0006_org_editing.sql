-- Milestone 5: editing the org chart.
--
-- Who may edit what follows the same shape as task assignment: you can
-- reshape the part of the chart beneath you, and a campus lead can reshape
-- their campus. Nobody can edit their own position or anything above it,
-- so no one can promote themselves.

create or replace function can_manage_position (p_position uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from position_holders ha
      join positions a on a.id = ha.position_id
      join positions b on b.id = p_position
     where ha.person_id = current_person_id()
       and (
         position_is_below(b.id, a.id)
         or (a.campus_lead and b.campus_id = a.campus_id and b.id <> a.id)
       )
  );
$$;

-- True if you may hang a new position under this one.
create or replace function can_add_under (p_parent uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from position_holders ha
     where ha.person_id = current_person_id()
       and ha.position_id = p_parent
  ) or can_manage_position(p_parent);
$$;

-- --------------------------------------------------------- reparenting

-- Deleting a position would otherwise orphan everyone under it, because
-- reports_to_id is ON DELETE SET NULL. Lift the children up to the
-- departing position's own supervisor instead.
create or replace function positions_reparent_children ()
returns trigger
language plpgsql
as $$
begin
  update positions
     set reports_to_id = old.reports_to_id
   where reports_to_id = old.id;
  return old;
end;
$$;

drop trigger if exists positions_reparent on positions;
create trigger positions_reparent
  before delete on positions
  for each row execute function positions_reparent_children ();

-- ---------------------------------------------------------------- RLS

drop policy if exists "edit positions below you" on positions;
create policy "edit positions below you" on positions
  for update to authenticated
  using (can_manage_position(id))
  with check (can_manage_position(id));

drop policy if exists "add positions below you" on positions;
create policy "add positions below you" on positions
  for insert to authenticated
  with check (reports_to_id is not null and can_add_under(reports_to_id));

drop policy if exists "remove positions below you" on positions;
create policy "remove positions below you" on positions
  for delete to authenticated
  using (can_manage_position(id));

-- Staff records: anyone signed in may add a person (a new hire has no
-- position yet, so there is nothing to check against), but editing one is
-- limited to people sitting in a position you manage.
drop policy if exists "add people" on people;
create policy "add people" on people
  for insert to authenticated
  with check (current_person_id() is not null);

drop policy if exists "edit people below you" on people;
create policy "edit people below you" on people
  for update to authenticated
  using (
    exists (
      select 1 from position_holders h
       where h.person_id = people.id
         and can_manage_position(h.position_id)
    )
  )
  with check (
    exists (
      select 1 from position_holders h
       where h.person_id = people.id
         and can_manage_position(h.position_id)
    )
  );

-- Filling and emptying roles you manage.
drop policy if exists "fill positions below you" on position_holders;
create policy "fill positions below you" on position_holders
  for insert to authenticated
  with check (can_manage_position(position_id));

drop policy if exists "empty positions below you" on position_holders;
create policy "empty positions below you" on position_holders
  for delete to authenticated
  using (can_manage_position(position_id));
