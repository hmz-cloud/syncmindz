-- SYNCMINDZ initial schema
-- Trust is enforced HERE, on the server. The client can never decide on its own
-- that an alarm is "auto-accepted" on someone else's phone.

create extension if not exists pgcrypto;

-- ───────────────────────── Profiles ─────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 60),
  avatar_color  text not null default '#0f766e',
  language      text not null default 'ar' check (language in ('ar','en')),
  simple_mode   boolean not null default false,
  text_scale    text not null default 'large' check (text_scale in ('normal','large','xlarge')),
  invite_code   text unique not null,
  created_at    timestamptz not null default now()
);

create or replace function public.gen_invite_code() returns text
language plpgsql as $$
declare c text;
begin
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.profiles where invite_code = c);
  end loop;
  return c;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, invite_code) values (new.id, public.gen_invite_code());
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Connections ─────────────────────────
-- A connection must be accepted by BOTH people. Knowing a code is not enough.
create table public.connections (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles on delete cascade,
  addressee_id  uuid not null references public.profiles on delete cascade,
  status        text not null default 'pending' check (status in ('pending','accepted')),
  ended_at      timestamptz,   -- set when declined or removed (rows are never deleted)
  created_at    timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index connections_pair_uidx
  on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create or replace function public.are_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a = b or exists (
    select 1 from public.connections
    where status = 'accepted' and ended_at is null
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

-- ───────────────────────── Trust rules ─────────────────────────
-- owner_id = the person whose phone rings. Only they can change their rules.
create table public.trust_rules (
  owner_id     uuid not null references public.profiles on delete cascade,
  sender_id    uuid not null references public.profiles on delete cascade,
  level        text not null default 'ask' check (level in ('auto','ask','blocked')),
  allow_alarms boolean not null default true,  -- loud alarms (vs. gentle reminders only)
  updated_at   timestamptz not null default now(),
  primary key (owner_id, sender_id)
);

-- ───────────────────────── Items ─────────────────────────
create table public.items (
  id             uuid primary key default gen_random_uuid(),
  sender_id      uuid not null default auth.uid() references public.profiles on delete cascade,
  receiver_id    uuid not null references public.profiles on delete cascade,
  kind           text not null check (kind in ('alarm','reminder')),
  title          text not null check (char_length(title) between 1 and 120),
  note           text check (char_length(note) <= 300),
  due_at         timestamptz not null,
  repeat         text not null default 'none' check (repeat in ('none','daily','weekly')),
  status         text not null default 'pending'
                 check (status in ('pending','scheduled','snoozed','done','declined','missed','cancelled')),
  snooze_until   timestamptz,
  reply          text check (char_length(reply) <= 200),
  done_at        timestamptz,
  notified_at    timestamptz,   -- "new item" push sent
  due_pushed_at  timestamptz,   -- backup push at ring time sent
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index items_receiver_idx on public.items (receiver_id, status, due_at);
create index items_sender_idx   on public.items (sender_id, created_at desc);

-- Decide status on the server from the RECEIVER's rules.
create or replace function public.items_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.trust_rules;
begin
  if new.sender_id <> auth.uid() then
    raise exception 'sender must be the signed-in user';
  end if;
  if not public.are_connected(new.sender_id, new.receiver_id) then
    raise exception 'not_connected';
  end if;

  if new.sender_id = new.receiver_id then
    new.status := 'scheduled';
    return new;
  end if;

  select * into r from public.trust_rules
   where owner_id = new.receiver_id and sender_id = new.sender_id;

  if r.level = 'blocked' then
    raise exception 'blocked';
  elsif r.level = 'auto' and (new.kind = 'reminder' or r.allow_alarms) then
    new.status := 'scheduled';
  else
    new.status := 'pending';
  end if;
  new.notified_at := null; new.due_pushed_at := null;
  return new;
end $$;
create trigger items_bi before insert on public.items
  for each row execute function public.items_before_insert();

-- Each side may only change "their" fields.
create or replace function public.items_before_update() returns trigger
language plpgsql set search_path = public as $$
declare me uuid := auth.uid();
begin
  new.updated_at := now();
  if me is null then return new; end if;            -- service role (cron / functions)

  if me = old.receiver_id and me <> old.sender_id then
    if new.title is distinct from old.title or new.note is distinct from old.note
       or new.kind is distinct from old.kind or new.receiver_id is distinct from old.receiver_id
       or new.sender_id is distinct from old.sender_id then
      raise exception 'receiver cannot edit content';
    end if;
    if new.status not in ('scheduled','snoozed','done','declined','missed') then
      raise exception 'invalid status for receiver';
    end if;
    if old.status = 'pending' and new.status = 'scheduled' then null; end if;
  elsif me = old.sender_id and me <> old.receiver_id then
    if new.reply is distinct from old.reply or new.done_at is distinct from old.done_at
       or new.snooze_until is distinct from old.snooze_until then
      raise exception 'sender cannot answer for receiver';
    end if;
    if new.status not in (old.status, 'cancelled') then
      raise exception 'sender can only cancel';
    end if;
    -- editing time/content of an accepted item sends it back for approval unless trusted
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
create trigger items_bu before update on public.items
  for each row execute function public.items_before_update();

-- ───────────────────────── Activity (who did what, when) ─────────────────────────
create table public.item_events (
  id         bigint generated always as identity primary key,
  item_id    uuid not null references public.items on delete cascade,
  actor_id   uuid references public.profiles on delete set null,
  event      text not null,
  created_at timestamptz not null default now()
);

create or replace function public.items_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.item_events (item_id, actor_id, event) values (new.id, new.sender_id, 'created:' || new.status);
  elsif new.status is distinct from old.status then
    insert into public.item_events (item_id, actor_id, event) values (new.id, auth.uid(), new.status);
  end if;
  return null;
end $$;
create trigger items_ai after insert or update on public.items
  for each row execute function public.items_log();

-- ───────────────────────── Push tokens ─────────────────────────
create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  platform   text not null check (platform in ('android','ios','web')),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── RPCs ─────────────────────────
create or replace function public.request_connection(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare target uuid; c public.connections;
begin
  select id into target from public.profiles where invite_code = regexp_replace(code, '\D', '', 'g');
  if target is null then raise exception 'code_not_found'; end if;
  if target = auth.uid() then raise exception 'own_code'; end if;
  select * into c from public.connections
   where least(requester_id, addressee_id) = least(auth.uid(), target)
     and greatest(requester_id, addressee_id) = greatest(auth.uid(), target);
  if c.id is null then
    insert into public.connections (requester_id, addressee_id) values (auth.uid(), target)
    returning * into c;
  elsif c.ended_at is not null then
    update public.connections
       set requester_id = auth.uid(), addressee_id = target, status = 'pending', ended_at = null, created_at = now()
     where id = c.id returning * into c;
  end if;
  return c.id;
end $$;

create or replace function public.respond_connection(cid uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c public.connections;
begin
  select * into c from public.connections
   where id = cid and addressee_id = auth.uid() and status = 'pending' and ended_at is null;
  if c.id is null then raise exception 'not_found'; end if;
  if not accept then
    update public.connections set ended_at = now() where id = cid;
    return;
  end if;
  update public.connections set status = 'accepted' where id = cid;
  -- Safe default both ways: "ask me first" (also resets trust if people reconnect).
  insert into public.trust_rules (owner_id, sender_id) values (c.requester_id, c.addressee_id)
    on conflict (owner_id, sender_id) do update set level = 'ask', allow_alarms = true, updated_at = now();
  insert into public.trust_rules (owner_id, sender_id) values (c.addressee_id, c.requester_id)
    on conflict (owner_id, sender_id) do update set level = 'ask', allow_alarms = true, updated_at = now();
end $$;

create or replace function public.remove_connection(other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.connections set ended_at = now()
   where ended_at is null
     and ((requester_id = auth.uid() and addressee_id = other)
       or (requester_id = other and addressee_id = auth.uid()));
  update public.items set status = 'cancelled'
   where status in ('pending','scheduled','snoozed')
     and ((sender_id = auth.uid() and receiver_id = other) or (sender_id = other and receiver_id = auth.uid()));
end $$;

-- Marks one-off items as missed if nobody pressed "Done" 30 min after ring time.
create or replace function public.mark_missed() returns void
language sql security definer set search_path = public as $$
  update public.items set status = 'missed'
   where status in ('scheduled','snoozed') and repeat = 'none'
     and coalesce(snooze_until, due_at) < now() - interval '30 minutes';
$$;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles    enable row level security;
alter table public.connections enable row level security;
alter table public.trust_rules enable row level security;
alter table public.items       enable row level security;
alter table public.item_events enable row level security;
alter table public.push_tokens enable row level security;

create policy "see self and people I'm linked with" on public.profiles for select
  using (id = auth.uid() or exists (
    select 1 from public.connections c
     where c.ended_at is null
       and ((c.requester_id = auth.uid() and c.addressee_id = profiles.id)
         or (c.addressee_id = auth.uid() and c.requester_id = profiles.id))));
create policy "edit own profile" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "see my connections" on public.connections for select
  using (auth.uid() in (requester_id, addressee_id));

create policy "see rules about me" on public.trust_rules for select
  using (auth.uid() in (owner_id, sender_id));
create policy "only owner edits rules" on public.trust_rules for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "see my items" on public.items for select
  using (auth.uid() in (sender_id, receiver_id));
create policy "send items" on public.items for insert
  with check (sender_id = auth.uid());
create policy "update my items" on public.items for update
  using (auth.uid() in (sender_id, receiver_id));

create policy "see events of my items" on public.item_events for select
  using (exists (select 1 from public.items i where i.id = item_id and auth.uid() in (i.sender_id, i.receiver_id)));

create policy "manage own tokens" on public.push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Users may edit only these profile columns (never id or invite_code).
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar_color, language, simple_mode, text_scale) on public.profiles to authenticated;

-- Internal helpers are not callable from the app.
revoke execute on function public.mark_missed() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.gen_invite_code() from public, anon, authenticated;
revoke execute on function public.request_connection(text) from anon;
revoke execute on function public.items_before_insert() from public, anon, authenticated;
revoke execute on function public.items_before_update() from public, anon, authenticated;
revoke execute on function public.items_log() from public, anon, authenticated;
revoke execute on function public.are_connected(uuid, uuid) from public, anon, authenticated;
create index connections_requester_idx on public.connections (requester_id);
create index connections_addressee_idx on public.connections (addressee_id);
revoke execute on function public.respond_connection(uuid, boolean) from anon;
revoke execute on function public.remove_connection(uuid) from anon;

-- ───────────────────────── Realtime ─────────────────────────
alter publication supabase_realtime add table public.items, public.connections, public.trust_rules;

-- ───────────────────────── Scheduled jobs ─────────────────────────
create extension if not exists pg_cron;
select cron.schedule('mark-missed', '* * * * *', $$select public.mark_missed()$$);
-- Push dispatch (after FCM is configured, needs pg_net):
-- select cron.schedule('dispatch-push', '* * * * *', $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/dispatch',
--     headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
--   )$$);
