-- Managing who can sign in.
--
-- Two distinct ideas that are easy to confuse, and dangerous to:
--
--   Removing a PERSON deletes their row, and cascades to their tasks,
--   comments, messages and files. That is for someone added by mistake.
--
--   Revoking ACCESS deletes their login and leaves everything else standing,
--   so the work they did and the conversations they were part of survive.
--   That is what you want when someone leaves.
--
-- This migration is only about the second. Nothing here deletes a person.

alter table people
  add column if not exists is_admin boolean not null default false;

-- Whoever is already signed in and linked becomes the first administrator;
-- without this nobody could grant it to anyone.
update people
   set is_admin = true
 where auth_user_id is not null
   and not exists (select 1 from people where is_admin);

/** Is the signed-in person an administrator? */
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from people p where p.id = current_person_id()),
    false
  );
$$;

grant execute on function is_admin() to authenticated;

-- Administrators may set an address or deactivate anyone. The existing
-- "edit people below you" policy still applies to everyone else, so this
-- adds a capability rather than widening the ordinary rule.
drop policy if exists "admins manage people" on people;
create policy "admins manage people" on people
  for update to authenticated
  using (is_admin())
  with check (is_admin());

/**
 * Guard against locking everyone out: the last administrator cannot be
 * demoted. Enforced here rather than in the UI, so it holds however the
 * change arrives.
 */
create or replace function prevent_last_admin_removal()
returns trigger
language plpgsql
as $$
begin
  if old.is_admin and not new.is_admin then
    if (select count(*) from people where is_admin) <= 1 then
      raise exception 'There must always be at least one administrator';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists keep_one_admin on people;
create trigger keep_one_admin
  before update on people
  for each row execute function prevent_last_admin_removal();
