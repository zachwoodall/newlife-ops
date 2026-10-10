-- Milestone 11: one-to-one messages.
--
-- Unlike tasks, messages ignore the org chart entirely: anyone on staff may
-- write to anyone. A thread is simply every message between two people.

create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references people (id) on delete cascade,
  recipient_id uuid not null references people (id) on delete cascade,
  body         text not null check (length(btrim(body)) > 0),
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  constraint messages_not_self check (sender_id <> recipient_id)
);

create index if not exists messages_recipient_idx
  on messages (recipient_id, created_at desc);
create index if not exists messages_sender_idx
  on messages (sender_id, created_at desc);
create index if not exists messages_unread_idx
  on messages (recipient_id) where read_at is null;

-- A recipient may mark a message read. Nothing else about it may change —
-- without this, the same policy would let someone rewrite what they were
-- sent and then point at it.
create or replace function messages_only_read_at_changes ()
returns trigger
language plpgsql
as $$
begin
  if new.sender_id    is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.body         is distinct from old.body
     or new.created_at   is distinct from old.created_at then
    raise exception 'Only read_at may be changed on a message';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_immutable on messages;
create trigger messages_immutable
  before update on messages
  for each row execute function messages_only_read_at_changes ();

alter table messages enable row level security;

-- Both sides of a conversation can read it. Nobody else can.
drop policy if exists "read own messages" on messages;
create policy "read own messages" on messages
  for select to authenticated
  using (
    sender_id = current_person_id() or recipient_id = current_person_id()
  );

-- You may only send as yourself. No org chart check: messages go anywhere.
drop policy if exists "send as yourself" on messages;
create policy "send as yourself" on messages
  for insert to authenticated
  with check (sender_id = current_person_id());

-- Only the recipient marks a message read; the trigger above limits it to
-- read_at.
drop policy if exists "recipient marks read" on messages;
create policy "recipient marks read" on messages
  for update to authenticated
  using (recipient_id = current_person_id())
  with check (recipient_id = current_person_id());

-- You may unsend something you wrote.
drop policy if exists "delete own sent" on messages;
create policy "delete own sent" on messages
  for delete to authenticated
  using (sender_id = current_person_id());
