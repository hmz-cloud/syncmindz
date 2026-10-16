// Runs every minute (pg_cron). Sends two kinds of push via Firebase Cloud Messaging:
//  1. "new"  – a new item reached someone's phone (or needs their OK). Opening it
//              makes the app sync and arm the alarm locally.
//  2. "due"  – backup ring at the due time, in case the phone never synced.
// Secrets: FCM_SERVICE_ACCOUNT (JSON), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleAuth } from 'npm:google-auth-library@9';

const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '{}');
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const auth = new GoogleAuth({ credentials: sa, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });

const T = {
  ar: {
    newAlarm: (n: string) => `${n} ضبط لك منبّهًا`,
    newReminder: (n: string) => `${n} أرسل لك تذكيرًا`,
    needsOk: (n: string) => `${n} يطلب موافقتك على تذكير`,
    due: 'حان الوقت',
  },
  en: {
    newAlarm: (n: string) => `${n} set an alarm for you`,
    newReminder: (n: string) => `${n} sent you a reminder`,
    needsOk: (n: string) => `${n} is asking to add a reminder`,
    due: "It's time",
  },
};

async function send(token: string, title: string, body: string, data: Record<string, string>, urgent: boolean) {
  const client = await auth.getClient();
  const { token: access } = await client.getAccessToken();
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: { channel_id: urgent ? 'alarms' : 'reminders', sound: urgent ? 'alarm' : 'default' },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { sound: urgent ? 'alarm.caf' : 'default', 'interruption-level': urgent ? 'time-sensitive' : 'active' } },
        },
      },
    }),
  });
  if (res.status === 404 || res.status === 400) {
    await db.from('push_tokens').delete().eq('token', token); // stale token
  }
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('forbidden', { status: 403 });
  }
  const now = new Date().toISOString();

  const { data: fresh } = await db.from('items')
    .select('id, kind, title, status, receiver_id, sender_id, sender:profiles!items_sender_id_fkey(display_name), receiver:profiles!items_receiver_id_fkey(language)')
    .is('notified_at', null).in('status', ['pending', 'scheduled']).limit(200);

  const { data: due } = await db.from('items')
    .select('id, kind, title, receiver_id, snooze_until, due_at, receiver:profiles!items_receiver_id_fkey(language)')
    .is('due_pushed_at', null).in('status', ['scheduled', 'snoozed']).lte('due_at', now).limit(200);
  // (snoozed items reset due_pushed_at on the client, so they get a fresh backup push)

  let sent = 0;
  for (const it of fresh ?? []) {
    if (it.sender_id === it.receiver_id) {
      await db.from('items').update({ notified_at: now }).eq('id', it.id);
      continue;
    }
    // deno-lint-ignore no-explicit-any
    const lang = ((it as any).receiver?.language ?? 'ar') as 'ar' | 'en';
    // deno-lint-ignore no-explicit-any
    const name = (it as any).sender?.display_name || '…';
    const title = it.status === 'pending' ? T[lang].needsOk(name)
      : it.kind === 'alarm' ? T[lang].newAlarm(name) : T[lang].newReminder(name);
    const { data: toks } = await db.from('push_tokens').select('token').eq('user_id', it.receiver_id);
    for (const t of toks ?? []) if (await send(t.token, title, it.title, { itemId: it.id, type: 'new' }, false)) sent++;
    await db.from('items').update({ notified_at: now }).eq('id', it.id);
  }

  for (const it of due ?? []) {
    const ringAt = it.snooze_until ?? it.due_at;
    if (ringAt > now) continue;
    // deno-lint-ignore no-explicit-any
    const lang = ((it as any).receiver?.language ?? 'ar') as 'ar' | 'en';
    const { data: toks } = await db.from('push_tokens').select('token').eq('user_id', it.receiver_id);
    for (const t of toks ?? []) if (await send(t.token, `⏰ ${T[lang].due}`, it.title, { itemId: it.id, type: 'due' }, it.kind === 'alarm')) sent++;
    await db.from('items').update({ due_pushed_at: now }).eq('id', it.id);
  }

  return Response.json({ sent });
});
