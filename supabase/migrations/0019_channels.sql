-- Group messaging.
--
-- Direct messages are one to one, so anything involving three people meant
-- repeating yourself. A channel is a room with a membership list: everything
-- said in it is visible to its members and nobody else.
--
-- Membership is always explicit, including for "All staff". That means a new
-- hire has to be added rather than appearing automatically -- the trade for
-- being able to see and control exactly who is in a room.

create table if not exists channels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  description text,
  created_by  uuid references people (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists channel_members (
  channel_id uuid not null references channels (id) on delete cascade,
  person_id  uuid not null references people (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (channel_id, person_id)
);

create table if not exists channel_messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels (id) on delete cascade,
  sender_id  uuid not null references people (id) on delete cascade,
  body       text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists channel_messages_idx
  on channel_messages (channel_id, created_at desc);

-- Where each person has read up to. One row per person per channel, rather
-- than per message, which would grow without bound.
create table if not exists channel_reads (
  channel_id   uuid not null references channels (id) on delete cascade,
  person_id    uuid not null references people (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, person_id)
);

alter table channels enable row level security;
alter table channel_members enable row level security;
alter table channel_messages enable row level security;
alter table channel_reads enable row level security;

/** Is the signed-in person in this channel? */
create or replace function in_channel(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from channel_members m
     where m.channel_id = p_channel and m.person_id = current_person_id()
  );
$$;

/**
 * Who may rename a channel or change its membership: whoever created it, or
 * an administrator. The second is not a convenience -- the seeded All staff
 * channel has no creator, so without it nobody could ever manage it.
 */
create or replace function can_manage_channel(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.created_by = current_person_id() from channels c where c.id = p_channel),
    false
  ) or is_admin();
$$;

grant execute on function in_channel(uuid) to authenticated;
grant execute on function can_manage_channel(uuid) to authenticated;

drop policy if exists "read channels" on channels;
create policy "read channels" on channels
  for select to authenticated
  using (
    -- The creator sees it immediately; without this, creating one fails,
    -- since the membership row does not exist yet when the insert returns.
    created_by = current_person_id()
    or in_channel(id)
    or is_admin()
  );

drop policy if exists "create channels" on channels;
create policy "create channels" on channels
  for insert to authenticated
  with check (created_by = current_person_id());

drop policy if exists "rename channels" on channels;
create policy "rename channels" on channels
  for update to authenticated
  using (can_manage_channel(id))
  with check (can_manage_channel(id));

drop policy if exists "delete channels" on channels;
create policy "delete channels" on channels
  for delete to authenticated
  using (can_manage_channel(id));

drop policy if exists "read members" on channel_members;
create policy "read members" on channel_members
  for select to authenticated
  using (in_channel(channel_id) or can_manage_channel(channel_id));

drop policy if exists "add members" on channel_members;
create policy "add members" on channel_members
  for insert to authenticated
  with check (in_channel(channel_id) or can_manage_channel(channel_id));

-- Leave yourself, or be removed by whoever manages the channel.
drop policy if exists "remove members" on channel_members;
create policy "remove members" on channel_members
  for delete to authenticated
  using (person_id = current_person_id() or can_manage_channel(channel_id));

drop policy if exists "read channel messages" on channel_messages;
create policy "read channel messages" on channel_messages
  for select to authenticated
  using (in_channel(channel_id));

drop policy if exists "post channel messages" on channel_messages;
create policy "post channel messages" on channel_messages
  for insert to authenticated
  with check (sender_id = current_person_id() and in_channel(channel_id));

-- Your own words only.
drop policy if exists "delete own channel messages" on channel_messages;
create policy "delete own channel messages" on channel_messages
  for delete to authenticated
  using (sender_id = current_person_id());

drop policy if exists "own reads" on channel_reads;
create policy "own reads" on channel_reads
  for all to authenticated
  using (person_id = current_person_id())
  with check (person_id = current_person_id());

-- One All staff channel, with everyone on the books put into it. Later
-- arrivals are added by hand, which is the point of a membership list.
insert into channels (name, description)
select 'All staff', 'Everyone on the team.'
 where not exists (select 1 from channels where name = 'All staff');

insert into channel_members (channel_id, person_id)
select c.id, p.id
  from channels c
  cross join people p
 where c.name = 'All staff'
on conflict do nothing;
