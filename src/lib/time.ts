import type { Lang } from '../types';

const loc = (lang: Lang) => (lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB');

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatTime(d: Date, lang: Lang) {
  return d.toLocaleTimeString(loc(lang), { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "Today 8:00 PM", "Tomorrow 8:00 AM", or "Mon 14 Oct, 8:00 AM" — always explicit, never relative-only. */
export function formatWhen(iso: string, lang: Lang, t: (k: string) => string) {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = formatTime(d, lang);
  if (sameDay(d, now)) return `${t('common.today')} ${time}`;
  if (sameDay(d, tomorrow)) return `${t('common.tomorrow')} ${time}`;
  const day = d.toLocaleDateString(loc(lang), { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day}${lang === 'ar' ? '، ' : ', '}${time}`;
}

export function ringTime(item: { due_at: string; snooze_until: string | null; status: string }) {
  return item.status === 'snoozed' && item.snooze_until ? item.snooze_until : item.due_at;
}

/** Next occurrence after `from` for repeating items. */
export function nextOccurrence(iso: string, repeat: 'daily' | 'weekly', from = new Date()) {
  const d = new Date(iso);
  const step = repeat === 'daily' ? 1 : 7;
  while (d <= from) d.setDate(d.getDate() + step);
  return d.toISOString();
}

export function toDateInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function toTimeInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
