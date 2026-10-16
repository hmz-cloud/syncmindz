import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';
import { ringTime } from './time';
import type { Item } from '../types';

export const isNative = Capacitor.isNativePlatform();

/** Stable numeric id for the OS (Android needs a 32-bit int). */
function numId(uuid: string) {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) h = (Math.imul(31, h) + uuid.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

export async function setupNative(onOpenItem: (itemId: string, action: string) => void) {
  if (!isNative) return;

  await LocalNotifications.createChannel({
    id: 'alarms', name: 'Alarms', description: 'Loud alarms from your people',
    importance: 5, visibility: 1, sound: 'alarm.wav', vibration: true,
  });
  await LocalNotifications.createChannel({
    id: 'reminders', name: 'Reminders', description: 'Gentle reminders',
    importance: 4, visibility: 1, vibration: true,
  });
  await LocalNotifications.registerActionTypes({
    types: [{
      id: 'RING',
      actions: [
        { id: 'DONE', title: 'تم / Done', foreground: true },
        { id: 'SNOOZE', title: '١٠ د / 10 min', foreground: false },
      ],
    }],
  });

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
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
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
  const now = Date.now();
  const toSchedule = myItems
    .filter((i) => (i.status === 'scheduled' || i.status === 'snoozed') && new Date(ringTime(i)).getTime() > now)
    .slice(0, 60); // iOS keeps at most 64 pending
  if (!toSchedule.length) return;

  await LocalNotifications.schedule({
    notifications: toSchedule.map((i) => {
      const from = i.sender_id === i.receiver_id ? '' : `${senderName(i.sender_id)} · `;
      return {
        id: numId(i.id),
        title: i.title,
        body: from + (i.note ?? ''),
        schedule: { at: new Date(ringTime(i)), allowWhileIdle: true },
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

/** Web fallback: only works while the page is open. */
export function webNotify(title: string, body: string) {
  if (isNative || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, requireInteraction: true }); } catch { /* ignore */ }
}
