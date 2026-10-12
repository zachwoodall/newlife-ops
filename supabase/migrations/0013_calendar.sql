-- Improvement 4: a calendar, and a feed other calendar apps can subscribe to.
--
-- Church work is relentlessly date-driven, but due dates were only ever
-- visible as text on a list.
--
-- The subscription feed is the delicate part. Calendar apps cannot sign in,
-- so the URL itself has to carry the authority -- anyone holding it can read
-- that person's task titles and dates. That means:
--   * the token lives in its own table, NOT on `people`, which every signed-in
--     user can read in full;
--   * you can only see your own token;
--   * it can be regenerated, which instantly invalidates the old URL.

create table if not exists calendar_tokens (
  person_id  uuid primary key references people (id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table calendar_tokens enable row level security;

drop policy if exists "read own calendar token" on calendar_tokens;
create policy "read own calendar token" on calendar_tokens
  for select to authenticated
  using (person_id = current_person_id());

drop policy if exists "create own calendar token" on calendar_tokens;
create policy "create own calendar token" on calendar_tokens
  for insert to authenticated
  with check (person_id = current_person_id());

-- Regenerating is an update to your own row.
drop policy if exists "rotate own calendar token" on calendar_tokens;
create policy "rotate own calendar token" on calendar_tokens
  for update to authenticated
  using (person_id = current_person_id())
  with check (person_id = current_person_id());

drop policy if exists "revoke own calendar token" on calendar_tokens;
create policy "revoke own calendar token" on calendar_tokens
  for delete to authenticated
  using (person_id = current_person_id());

/**
 * The dated work behind one feed token.
 *
 * Security definer so an unauthenticated calendar app can read it, but the
 * token is the only way in and it only ever yields that one person's tasks.
 * Returns nothing for an unknown token rather than erroring, so a wrong URL
 * looks like an empty calendar rather than confirming which tokens exist.
 */
create or replace function calendar_feed(p_token uuid)
returns table (
  task_id    uuid,
  title      text,
  due_date   date,
  status     text,
  is_owner   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.title,
    t.due_date,
    t.status,
    (t.owner_id = ct.person_id) as is_owner
  from calendar_tokens ct
  join tasks t
    on t.due_date is not null
   and (
     t.owner_id = ct.person_id
     or exists (
       select 1 from task_assignees ta
       where ta.task_id = t.id and ta.person_id = ct.person_id
     )
   )
  where ct.token = p_token
  order by t.due_date;
$$;

-- Calendar apps arrive unauthenticated.
grant execute on function calendar_feed(uuid) to anon, authenticated;
