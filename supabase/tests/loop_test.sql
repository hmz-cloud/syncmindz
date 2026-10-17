-- Full send → accept → ring → Done loop as two real signed-in users.
-- Everything runs in one transaction and ends with a raised exception, so nothing is ever kept.
-- Run with the Supabase SQL tool; the error message IS the result list. Last run 2026-10-17: 11/11 PASS.
begin;
create temp table r(n serial, step text, ok boolean, info text);
grant all on r to authenticated; grant usage on sequence r_n_seq to authenticated;

insert into auth.users (id, instance_id, aud, role, email) values
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amina.test@example.invalid'),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','hassan.test@example.invalid');
insert into r(step,ok,info) select 'profiles auto-created', count(*)=2, count(*)::text from public.profiles
 where id in ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000b2');
create temp table codes as select id, invite_code from public.profiles;
grant select on codes to authenticated;

-- Hassan (B) signs in, names himself (English), asks to connect using Amina's code
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}',true);
update public.profiles set display_name='Hassan', language='en' where id=auth.uid();
select public.request_connection((select invite_code from codes where id='00000000-0000-4000-8000-0000000000a1'));
do $$ begin
  insert into public.items(receiver_id,kind,title,due_at) values ('00000000-0000-4000-8000-0000000000a1','reminder','x',now()+interval '1 hour');
  insert into r(step,ok,info) values ('B blocked before acceptance', false, 'insert succeeded');
exception when others then insert into r(step,ok,info) values ('B blocked before acceptance', sqlerrm like '%not_connected%', sqlerrm); end $$;

-- Amina (A) signs in (Arabic), sees the request, accepts
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}',true);
update public.profiles set display_name='أمينة' where id=auth.uid();
insert into r(step,ok,info) select 'A sees pending request', count(*)=1, count(*)::text from public.connections where status='pending' and addressee_id=auth.uid();
select public.respond_connection((select id from public.connections where addressee_id=auth.uid()), true);
insert into r(step,ok,info) select 'A default rule = ask', bool_and(level='ask'), string_agg(level||'/'||allow_alarms,',') from public.trust_rules where owner_id=auth.uid();

-- B sends a daily medicine reminder → must wait for A's OK
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}',true);
insert into public.items(receiver_id,kind,title,due_at,repeat) values ('00000000-0000-4000-8000-0000000000a1','reminder','خذي الدواء',now()+interval '2 minutes','daily');
insert into public.items(receiver_id,kind,title,due_at) values ('00000000-0000-4000-8000-0000000000a1','alarm','Call me',now()+interval '1 minute');
insert into r(step,ok,info) select 'B items arrive as pending', bool_and(status='pending'), string_agg(status,',') from public.items where sender_id=auth.uid();

-- A allows both; A cannot edit content; A presses Done with a reply on the alarm
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}',true);
update public.items set status='scheduled' where receiver_id=auth.uid();
insert into r(step,ok,info) select 'A approved → scheduled', bool_and(status='scheduled'), string_agg(status,',') from public.items where receiver_id=auth.uid();
do $$ begin
  update public.items set title='hacked' where receiver_id=auth.uid() and kind='alarm';
  insert into r(step,ok,info) values ('A cannot edit title', false, 'update succeeded');
exception when others then insert into r(step,ok,info) values ('A cannot edit title', true, sqlerrm); end $$;
update public.items set status='done', reply='تم، شكرًا', done_at=now() where receiver_id=auth.uid() and kind='alarm';

-- B sees Done + reply; B cannot fake Done on the other one
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}',true);
insert into r(step,ok,info) select 'B sees Done + reply', status='done' and reply='تم، شكرًا', status||' / '||coalesce(reply,'-') from public.items where kind='alarm';
do $$ begin
  update public.items set status='done', done_at=now() where kind='reminder';
  insert into r(step,ok,info) values ('B cannot fake Done', false, 'update succeeded');
exception when others then insert into r(step,ok,info) values ('B cannot fake Done', true, sqlerrm); end $$;

-- New missed rule (migration 0003): a one-off request never answered → "missed" so the sender isn't left waiting.
-- (The function body below mirrors 0003 so the test also works before it is applied.)
insert into public.items(receiver_id,kind,title,due_at) values ('00000000-0000-4000-8000-0000000000a1','reminder','stale request',now()+interval '1 minute');
reset role;
select set_config('request.jwt.claims','',true);  -- act as the cron job (no signed-in user)
create or replace function public.mark_missed() returns void
language sql security definer set search_path = public as $f$
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
$f$;
update public.items set due_at = now() - interval '45 minutes' where title='stale request';
select public.mark_missed();
insert into r(step,ok,info) select 'stale pending one-off → missed', status='missed', status from public.items where title='stale request';
insert into r(step,ok,info) select 'other items untouched', bool_and(status in ('scheduled','done')), string_agg(title||'='||status,',') from public.items where title<>'stale request';

do $$ begin raise exception E'RESULTS (rolled back):\n%', (select string_agg(n||'. '||case when ok then 'PASS' else 'FAIL' end||' — '||step||' ['||coalesce(info,'')||']', E'\n' order by n) from r); end $$;
