-- 0003: a one-off reminder that the receiver never approved, and whose time passed
-- 30+ minutes ago, becomes "missed" — so the sender sees "Not confirmed — maybe call"
-- instead of "Waiting to accept" forever. (Applied live as 08_unanswered_requests_missed.)
create or replace function public.mark_missed() returns void
language sql security definer set search_path = public as $$
  update public.items set status = 'missed'
   where status in ('pending','scheduled','snoozed') and repeat = 'none'
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
