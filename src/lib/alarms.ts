import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';
import { nextOccurrence, ringTime } from './time';
import type { Item } from '../types';

export const isNative = Capacitor.isNativePlatform();

/** Stable numeric id for the OS (Android needs a 32-bit int). */
export function numId(uuid: string) {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) h = (Math.imul(31, h) + uuid.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

const NATIVE_TEXT = {
  ar: { alarms: 'المنبّهات', alarmsDesc: 'منبّهات عالية من أهلك', reminders: 'التذكيرات', remindersDesc: 'تذكيرات هادئة', done: 'تم', snooze: 'ذكّرني بعد ١٠ دقائق' },
  en: { alarms: 'Alarms', alarmsDesc: 'Loud alarms from your people', reminders: 'Reminders', remindersDesc: 'Gentle reminders', done: 'Done', snooze: 'Remind me in 10 minutes' },
};

/** Channel names and lock-screen button text in the user's language. Safe to call again when the
 * language changes: Android updates a channel's name/description when it is re-created with the same id. */
export async function setNativeLanguage(lang: 'ar' | 'en') {
  if (!isNative) return;
  const tx = NATIVE_TEXT[lang];
  await LocalNotifications.createChannel({
    id: 'alarms', name: tx.alarms, description: tx.alarmsDesc,
    importance: 5, visibility: 1, sound: 'alarm.wav', vibration: true,
  });
  await LocalNotifications.createChannel({
    id: 'reminders', name: tx.reminders, description: tx.remindersDesc,
    importance: 4, visibility: 1, vibration: true,
  });
  await LocalNotifications.registerActionTypes({
    types: [{
      id: 'RING',
      actions: [
        { id: 'DONE', title: tx.done, foreground: true },
        { id: 'SNOOZE', title: tx.snooze, foreground: false },
      ],
    }],
  });
}

export async function setupNative(onOpenItem: (itemId: string, action: string) => void, lang: 'ar' | 'en' = 'ar') {
  if (!isNative) return;
  await setNativeLanguage(lang);
  // Refresh the push token on every launch (it can change), if permission was already given.
  try {
    if ((await PushNotifications.checkPermissions()).receive === 'granted') await PushNotifications.register();
  } catch { /* push not configured yet */ }

  LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const itemId = e.notification.extra?.itemId as string | undefined;
    if (itemId) onOpenItem(itemId, e.actionId);
  });
  PushNotifications.addListener('pushNotificationActionPerformed', (e) => {
    const itemId = e.notification.data?.itemId as string | undefined;
    if (itemId) onOpenItem(itemId, 'tap');
  });
  PushNotifications.addListener('registration', async (tok) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from('push_tokens').upsert({
      token: tok.value, user_id: data.user.id, platform: Capacitor.getPlatform() as 'android' | 'ios',
      updated_at: new Date().toISOString(),
    });
  });
}

export type PermState = 'granted' | 'denied' | 'prompt';

export async function checkPermission(): Promise<PermState> {
  if (isNative) {
    const p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') return p.display === 'denied' ? 'denied' : 'prompt';
    // Android 14+ blocks exact alarms by default — without it alarms can fire late.
    if (Capacitor.getPlatform() === 'android') {
      const exact = await LocalNotifications.checkExactNotificationSetting();
      if (exact.exact_alarm !== 'granted') return 'denied';
    }
    return 'granted';
  }
  if (!('Notification' in window)) return 'denied';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

export async function requestPermission(): Promise<PermState> {
  if (isNative) {
    const p = await LocalNotifications.requestPermissions();
    await PushNotifications.requestPermissions();
    await PushNotifications.register();
    if (Capacitor.getPlatform() === 'android') {
      const exact = await LocalNotifications.checkExactNotificationSetting();
      if (exact.exact_alarm !== 'granted') await LocalNotifications.changeExactNotificationSetting();
    }
    return p.display === 'granted' ? 'granted' : 'denied';
  }
  if (!('Notification' in window)) return 'denied';
  const r = await Notification.requestPermission();
  return r === 'default' ? 'prompt' : r;
}

/**
 * Mirrors "my upcoming items" into the phone's own alarm scheduler, so they ring
 * even if the app is closed and the phone is offline. Called after every sync.
 */
export async function syncLocalAlarms(myItems: Item[], senderName: (id: string) => string) {
  if (!isNative) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  // Clear alarms already shown in the tray for items that are no longer live (Done, cancelled…).
  const live = myItems.filter((i) => i.status === 'scheduled' || i.status === 'snoozed');
  const liveIds = new Set(live.map((i) => numId(i.id)));
  const delivered = await LocalNotifications.getDeliveredNotifications();
  const stale = delivered.notifications.filter((n) => !liveIds.has(n.id));
  if (stale.length) await LocalNotifications.removeDeliveredNotifications({ notifications: stale });

  const now = Date.now();
  // Repeating items whose time passed get their next occurrence (backstop for the server job).
  const nextRing = (i: Item) => {
    const at = ringTime(i);
    return i.repeat !== 'none' && new Date(at).getTime() <= now ? nextOccurrence(i.due_at, i.repeat) : at;
  };
  const toSchedule = live
    .filter((i) => new Date(nextRing(i)).getTime() > now)
    .slice(0, 60); // iOS keeps at most 64 pending
  if (!toSchedule.length) return;

  await LocalNotifications.schedule({
    notifications: toSchedule.map((i) => {
      const from = i.sender_id === i.receiver_id ? '' : `${senderName(i.sender_id)} · `;
      return {
        id: numId(i.id),
        title: i.title,
        body: from + (i.note ?? ''),
        schedule: { at: new Date(nextRing(i)), allowWhileIdle: true },
        channelId: i.kind === 'alarm' ? 'alarms' : 'reminders',
        sound: i.kind === 'alarm' ? 'alarm.wav' : undefined,
        actionTypeId: 'RING',
        ongoing: i.kind === 'alarm',
        autoCancel: i.kind !== 'alarm',
        extra: { itemId: i.id },
      };
    }),
  });
}

/** Silence the OS notification for an item while the in-app ringing screen is showing (no double sound). */
export async function silenceNative(itemId: string) {
  if (!isNative) return;
  const id = numId(itemId);
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
    await LocalNotifications.removeDeliveredNotifications({ notifications: [{ id, title: '', body: '' }] });
  } catch { /* ignore */ }
}

/** Web fallback: only works while the page is open. */
export function webNotify(title: string, body: string) {
  if (isNative || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, requireInteraction: true }); } catch { /* ignore */ }
}
