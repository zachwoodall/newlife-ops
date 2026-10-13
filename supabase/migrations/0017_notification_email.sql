-- Email delivery for notifications.
--
-- Notifications already exist; this only records whether one has been emailed,
-- so the sender can find what is outstanding and never send it twice.
--
-- Deliberately a column on notifications rather than a separate queue: the
-- notification IS the queue entry, and a second table would be able to drift
-- out of step with it.

alter table notifications
  add column if not exists emailed_at timestamptz;

-- The sender's query: unsent, oldest first.
create index if not exists notifications_unsent_idx
  on notifications (emailed_at, created_at)
  where emailed_at is null;
