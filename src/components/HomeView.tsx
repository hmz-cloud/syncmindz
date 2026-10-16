import { useMemo } from 'react';
import { useT } from '../lib/i18n';
import { ringTime, sameDay } from '../lib/time';
import { errorKey } from '../lib/supabase';
import { useToast } from './ui/Toast';
import { ApprovalCard, IncomingCard, SentCard } from './ItemCard';
import type { SyncState } from '../hooks/useSync';
import type { Item } from '../types';

export function HomeView({ sync, userId, simple }: { sync: SyncState; userId: string; simple: boolean }) {
  const { t } = useT();
  const toast = useToast();
  const { items, nameOf, actions, me } = sync;

  const { approvals, upcoming, sent } = useMemo(() => {
    const byRing = (a: Item, b: Item) => +new Date(ringTime(a)) - +new Date(ringTime(b));
    return {
      approvals: items.filter((i) => i.receiver_id === userId && i.sender_id !== userId && i.status === 'pending'),
      upcoming: items.filter((i) => i.receiver_id === userId && ['scheduled', 'snoozed'].includes(i.status)).sort(byRing),
      sent: items
        .filter((i) => i.sender_id === userId && i.receiver_id !== userId && i.status !== 'cancelled')
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    };
  }, [items, userId]);

  // Simple mode: only today + the very next thing. Less to read, less to decide.
  const visibleUpcoming = simple
    ? upcoming.filter((i, idx) => idx === 0 || sameDay(new Date(ringTime(i)), new Date()))
    : upcoming;
  const [next, ...later] = visibleUpcoming;

  const run = (p: Promise<unknown>, okMsg?: string) =>
    p.then(() => okMsg && toast({ text: okMsg })).catch((e) => toast({ text: t(errorKey(e)), tone: 'error' }));

  const cancel = (item: Item) => {
    const prev = item.status;
    run(actions.cancel(item));
    toast({ text: t('item.status.cancelled'), actionLabel: t('item.undo'), onAction: () => void actions.restore(item, prev) });
  };

  return (
    <div className="space-y-8">
      <h1 className="text-[1.7rem] font-bold">{t('home.greeting', { name: me?.display_name ?? '' })}</h1>

      {approvals.length > 0 && (
        <section aria-labelledby="h-approvals" className="space-y-3">
          <h2 id="h-approvals" className="text-[1.2rem] font-bold">{t('home.needsOk')}</h2>
          {approvals.map((i) => (
            <ApprovalCard
              key={i.id} item={i} fromName={nameOf(i.sender_id)}
              onAllow={() => run(actions.approve(i, false), t('send.saved'))}
              onAlways={() => run(actions.approve(i, true), t('send.saved'))}
              onDecline={() => run(actions.decline(i))}
            />
          ))}
        </section>
      )}

      <section aria-labelledby="h-upcoming" className="space-y-3">
        <h2 id="h-upcoming" className="text-[1.2rem] font-bold">{t('home.forYou')}</h2>
        {!next && <p className="rounded-3xl bg-card border-2 border-dashed border-line p-6 text-ink-2 text-[1.1rem]">{t('home.nothing')}</p>}
        {next && (
          <IncomingCard big item={next} fromName={nameOf(next.sender_id)}
            onDone={() => run(actions.markDone(next), t('ring.done') + ' ✓')} />
        )}
        {later.map((i) => (
          <IncomingCard key={i.id} item={i} fromName={nameOf(i.sender_id)} onDone={() => run(actions.markDone(i))} />
        ))}
      </section>

      {(!simple || sent.length > 0) && (
        <section aria-labelledby="h-sent" className="space-y-3">
          <h2 id="h-sent" className="text-[1.2rem] font-bold">{t('home.sentByYou')}</h2>
          {sent.length === 0 && <p className="text-ink-2">{t('home.nothingSent')}</p>}
          {sent.slice(0, simple ? 5 : 30).map((i) => (
            <SentCard key={i.id} item={i} toName={nameOf(i.receiver_id)} onCancel={() => cancel(i)} />
          ))}
        </section>
      )}
    </div>
  );
}
