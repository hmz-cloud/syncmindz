-- Applied to production 2026-10-16.
-- 1) Missed one-off items -> 'missed'; missed repeating items roll forward to next occurrence.
create or replace function public.mark_missed() returns void
language sql security definer set search_path = public as $$
  update public.items set status = 'missed'
   where status in ('scheduled','snoozed') and repeat = 'none'
     and coalesce(snooze_until, due_at) < now() - interval '30 minutes';
  update public.items
     set due_at = due_at + (case repeat when 'daily' then interval '1 day' else interval '7 days' end)
                 * ceil(extract(epoch from (now() - due_at))
                        / extract(epoch from (case repeat when 'daily' then interval '1 day' else interval '7 days' end))),
         status = 'scheduled', snooze_until = null, due_pushed_at = null
   where status in ('scheduled','snoozed') and repeat <> 'none'
     and coalesce(snooze_until, due_at) < now() - interval '30 minutes';
$$;
revoke execute on function public.mark_missed() from public, anon, authenticated;

-- 2) Sender may undo a cancel while still connected.
create or replace function public.items_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  new.updated_at := now();
  if me is null then return new; end if;
  if me = old.receiver_id and me <> old.sender_id then
    if new.title is distinct from old.title or new.note is distinct from old.note
       or new.kind is distinct from old.kind or new.receiver_id is distinct from old.receiver_id
       or new.sender_id is distinct from old.sender_id then
      raise exception 'receiver cannot edit content';
    end if;
    if new.status not in ('scheduled','snoozed','done','declined','missed') then
      raise exception 'invalid status for receiver';
    end if;
  elsif me = old.sender_id and me <> old.receiver_id then
    if new.reply is distinct from old.reply or new.done_at is distinct from old.done_at
       or new.snooze_until is distinct from old.snooze_until then
      raise exception 'sender cannot answer for receiver';
    end if;
    if new.status not in (old.status, 'cancelled')
       and not (old.status = 'cancelled' and new.status in ('pending','scheduled','snoozed')
                and public.are_connected(old.sender_id, old.receiver_id)) then
      raise exception 'sender can only cancel';
    end if;
    if (new.due_at is distinct from old.due_at or new.title is distinct from old.title
        or new.kind is distinct from old.kind) and new.status <> 'cancelled' then
      new.status := case when exists (
        select 1 from public.trust_rules
         where owner_id = old.receiver_id and sender_id = old.sender_id and level = 'auto'
           and (new.kind = 'reminder' or allow_alarms)) then 'scheduled' else 'pending' end;
      new.notified_at := null; new.due_pushed_at := null;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.items_before_update() from public, anon, authenticated;
