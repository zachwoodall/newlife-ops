-- Improvement 6: reactions.
--
-- Acknowledging something currently costs a whole comment or message. "Got
-- it" and "thanks" are worth saying but not worth a notification each, so
-- they add noise to the thing they are responding to.
--
-- A reaction is one person, one emoji, one subject. Deliberately no
-- notification: the entire point is a signal cheap enough not to interrupt.

create table if not exists reactions (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references people (id) on delete cascade,
  -- Exactly one subject, enforced below.
  comment_id   uuid references task_comments (id) on delete cascade,
  reply_id     uuid references announcement_replies (id) on delete cascade,
  announcement_id uuid references announcements (id) on delete cascade,
  emoji        text not null check (length(emoji) between 1 and 8),
  created_at   timestamptz not null default now(),

  constraint reaction_has_exactly_one_subject check (
    (comment_id is not null)::int
    + (reply_id is not null)::int
    + (announcement_id is not null)::int = 1
  )
);

-- One person cannot stack the same emoji on the same thing twice. Partial
-- unique indexes, since the subject columns are nullable.
create unique index if not exists reactions_one_per_comment
  on reactions (person_id, comment_id, emoji) where comment_id is not null;
create unique index if not exists reactions_one_per_reply
  on reactions (person_id, reply_id, emoji) where reply_id is not null;
create unique index if not exists reactions_one_per_announcement
  on reactions (person_id, announcement_id, emoji) where announcement_id is not null;

alter table reactions enable row level security;

-- You can see a reaction when you can see what it is attached to. The
-- existence checks lean on each table's own policies, so visibility follows
-- whatever rule already governs the subject.
drop policy if exists "read reactions" on reactions;
create policy "read reactions" on reactions
  for select to authenticated
  using (
    (comment_id is not null and exists (
      select 1 from task_comments c where c.id = comment_id))
    or (reply_id is not null and exists (
      select 1 from announcement_replies r where r.id = reply_id))
    or (announcement_id is not null and exists (
      select 1 from announcements a where a.id = announcement_id))
  );

drop policy if exists "add own reactions" on reactions;
create policy "add own reactions" on reactions
  for insert to authenticated
  with check (
    person_id = current_person_id()
    and (
      (comment_id is not null and exists (
        select 1 from task_comments c where c.id = comment_id))
      or (reply_id is not null and exists (
        select 1 from announcement_replies r where r.id = reply_id))
      or (announcement_id is not null and exists (
        select 1 from announcements a where a.id = announcement_id))
    )
  );

-- Only ever your own, so a reaction cannot be removed on your behalf.
drop policy if exists "remove own reactions" on reactions;
create policy "remove own reactions" on reactions
  for delete to authenticated
  using (person_id = current_person_id());
