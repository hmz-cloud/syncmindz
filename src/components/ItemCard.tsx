import { AlarmClock, Bell, Check, Repeat, X, CircleAlert, Clock3, CheckCircle2 } from 'lucide-react';
import { useT } from '../lib/i18n';
import { formatTime, formatWhen, ringTime, sameDay } from '../lib/time';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import type { Item } from '../types';

function KindBadge({ kind }: { kind: Item['kind'] }) {
  const { t } = useT();
  // Icon + word, never colour alone.
  return kind === 'alarm' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-alarm-soft text-alarm px-3 py-0.5 text-[0.9rem] font-semibold">
      <AlarmClock className="w-4 h-4" aria-hidden /> {t('item.alarm')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft text-brand-dark px-3 py-0.5 text-[0.9rem] font-semibold">
      <Bell className="w-4 h-4" aria-hidden /> {t('item.reminder')}
    </span>
  );
}

/** An item that will ring on MY phone. */
export function IncomingCard({ item, fromName, big, onDone }: {
  item: Item; fromName: string; big?: boolean; onDone: () => void;
}) {
  const { t, lang } = useT();
  const own = item.sender_id === item.receiver_id;
  return (
    <article className={`rounded-3xl bg-card border-2 ${big ? 'border-brand p-6' : 'border-line p-5'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={item.kind} />
        {item.repeat !== 'none' && (
          <span className="inline-flex items-center gap-1 text-ink-2 text-[0.9rem]">
            <Repeat className="w-4 h-4" aria-hidden />
            {t(item.repeat === 'daily' ? 'item.repeatDaily' : 'item.repeatWeekly')}
          </span>
        )}
      </div>
      <h3 className={`${big ? 'text-[1.6rem]' : 'text-[1.25rem]'} font-bold mt-3 leading-snug`}>{item.title}</h3>
      {item.note && <p className="mt-1 text-ink-2">{item.note}</p>}
      <p className={`${big ? 'text-[1.3rem]' : 'text-[1.05rem]'} mt-3 font-semibold flex items-center gap-2`}>
        <Clock3 className="w-5 h-5 text-brand" aria-hidden />
        {formatWhen(ringTime(item), lang, t)}
      </p>
      <p className="mt-1 text-ink-2">{own ? t('item.fromYou') : t('item.from', { name: fromName })}</p>
      {big && (
        <Button variant="ok" block className="mt-5" onClick={onDone} icon={<Check className="w-6 h-6" aria-hidden />}>
          {t('item.markDone')}
        </Button>
      )}
    </article>
  );
}

/** An item I sent to someone else — the caregiver's view: did they get it? did they do it? */
export function SentCard({ item, toName, onCancel }: { item: Item; toName: string; onCancel?: () => void }) {
  const { t, lang } = useT();
  const s = item.status;
  // Repeating items roll forward after Done, so show today's confirmation explicitly.
  const doneToday = item.repeat !== 'none' && !!item.done_at && sameDay(new Date(item.done_at), new Date());
  const tone =
    s === 'done' || doneToday ? 'text-ok' : s === 'missed' || s === 'declined' ? 'text-alarm' : s === 'pending' ? 'text-warn' : 'text-ink-2';
  const Icon = s === 'done' || doneToday ? CheckCircle2 : s === 'missed' || s === 'declined' ? CircleAlert : Clock3;
  const statusText = doneToday
    ? t('item.status.doneAt', { name: toName, time: formatTime(new Date(item.done_at!), lang) })
    : t(`item.status.${s}`, { name: toName });
  return (
    <article className="rounded-3xl bg-card border-2 border-line p-5">
      <div className="flex items-start gap-3">
        <Avatar id={item.receiver_id} name={toName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-ink-2 text-[0.95rem]">{t('item.to', { name: toName })}</p>
          <h3 className="text-[1.15rem] font-bold leading-snug">{item.title}</h3>
          <p className="text-[0.98rem] mt-0.5">{formatWhen(ringTime(item), lang, t)}</p>
          <p className={`mt-2 flex items-center gap-1.5 font-semibold ${tone}`}>
            <Icon className="w-5 h-5 shrink-0" aria-hidden />
            {statusText}
          </p>
          {item.reply && <p className="mt-1 text-ink-2">{t('item.replied', { reply: item.reply })}</p>}
        </div>
        {onCancel && ['pending', 'scheduled', 'snoozed'].includes(s) && (
          <button
            type="button"
            onClick={onCancel}
            aria-label={`${t('item.cancel')}: ${item.title}`}
            className="tap min-w-[3.3rem] grid place-items-center rounded-full text-ink-2 hover:bg-alarm-soft hover:text-alarm"
          >
            <X className="w-6 h-6" aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}

/** Someone wants to put something on my phone. Plain question, two clear answers. */
export function ApprovalCard({ item, fromName, onAllow, onAlways, onDecline }: {
  item: Item; fromName: string; onAllow: () => void; onAlways: () => void; onDecline: () => void;
}) {
  const { t, lang } = useT();
  return (
    <article className="rounded-3xl bg-warn-soft border-2 border-warn/40 p-5">
      <div className="flex items-center gap-3">
        <Avatar id={item.sender_id} name={fromName} />
        <p className="font-semibold text-[1.05rem]">{t('approve.ask', { name: fromName })}</p>
      </div>
      <div className="mt-3 rounded-2xl bg-card p-4">
        <KindBadge kind={item.kind} />
        <h3 className="text-[1.25rem] font-bold mt-2">{item.title}</h3>
        {item.note && <p className="text-ink-2">{item.note}</p>}
        <p className="mt-1 font-semibold">{formatWhen(item.due_at, lang, t)}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onDecline}>{t('approve.decline')}</Button>
        <Button onClick={onAllow} icon={<Check className="w-5 h-5" aria-hidden />}>{t('approve.allow')}</Button>
      </div>
      <Button variant="ghost" block className="mt-2" onClick={onAlways}>{t('approve.always', { name: fromName })}</Button>
    </article>
  );
}
