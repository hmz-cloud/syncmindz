import { useState } from 'react';
import { Copy, Send, Share2, UserPlus, ChevronDown, Trash2 } from 'lucide-react';
import { Share } from '@capacitor/share';
import { useT } from '../lib/i18n';
import { errorKey } from '../lib/supabase';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import type { SyncState } from '../hooks/useSync';
import type { TrustLevel } from '../types';

export function PeopleView({ sync, userId, onRemind }: { sync: SyncState; userId: string; onRemind: (id: string) => void }) {
  const { t } = useT();
  const toast = useToast();
  const { me, people, connections, profiles, actions, ruleFor } = sync;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const incoming = connections.filter((c) => c.status === 'pending' && c.addressee_id === userId);
  const outgoing = connections.filter((c) => c.status === 'pending' && c.requester_id === userId);
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.display_name || '…';

  const shareCode = async () => {
    const text = t('people.shareText', { code: me?.invite_code ?? '' });
    try {
      await Share.share({ text });
    } catch {
      await navigator.clipboard?.writeText(me?.invite_code ?? '');
      toast({ text: t('common.copied') });
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await actions.requestConnection(code);
      setCode('');
      toast({ text: t('people.requested') });
    } catch (err) {
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  // Every action: show success or the error, and re-sync from the server on failure.
  const [acting, setActing] = useState(false);
  const guard = (p: Promise<unknown>, ok?: string) => {
    setActing(true);
    return p.then(() => { if (ok) toast({ text: ok }); })
      .catch((e) => { toast({ text: t(errorKey(e)), tone: 'error' }); void actions.reload(); })
      .finally(() => setActing(false));
  };
  const setLevel = (id: string, level: TrustLevel) => guard(actions.setRule(id, { level }), t('people.saved'));

  return (
    <div className="space-y-8">
      <h1 className="text-[1.7rem] font-bold">{t('nav.people')}</h1>

      {incoming.map((c) => (
        <div key={c.id} className="rounded-3xl bg-warn-soft border-2 border-warn/40 p-5">
          <div className="flex items-center gap-3">
            <Avatar id={c.requester_id} name={nameOf(c.requester_id)} />
            <p className="font-semibold text-[1.1rem]">{t('people.incoming', { name: nameOf(c.requester_id) })}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button variant="secondary" disabled={acting} onClick={() => guard(actions.respondConnection(c.id, false))}>{t('people.decline')}</Button>
            <Button disabled={acting} onClick={() => guard(actions.respondConnection(c.id, true), t('people.saved'))}>{t('people.accept')}</Button>
          </div>
        </div>
      ))}

      <section aria-labelledby="h-list" className="space-y-3">
        <h2 id="h-list" className="text-[1.2rem] font-bold">{t('people.list')}</h2>
        {people.length === 0 && <p className="rounded-3xl bg-card border-2 border-dashed border-line p-6 text-ink-2">{t('people.empty')}</p>}
        {people.map((p) => {
          const rule = ruleFor(userId, p.id);
          const expanded = open === p.id;
          return (
            <article key={p.id} className="rounded-3xl bg-card border-2 border-line">
              <div className="flex items-center gap-3 p-4">
                <Avatar id={p.id} name={p.display_name} />
                <p className="flex-1 text-[1.15rem] font-semibold">{p.display_name}</p>
                <button type="button" onClick={() => onRemind(p.id)} aria-label={`${t('people.remind')}: ${p.display_name}`}
                  className="tap min-w-[3.3rem] grid place-items-center rounded-full bg-brand text-white">
                  <Send className="w-5 h-5 rtl:-scale-x-100" aria-hidden />
                </button>
                <button type="button" onClick={() => setOpen(expanded ? null : p.id)} aria-expanded={expanded}
                  aria-controls={`trust-${p.id}`} aria-label={t('people.trustTitle', { name: p.display_name })}
                  className="tap min-w-[3.3rem] grid place-items-center rounded-full border-2 border-line">
                  <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                </button>
              </div>
              {expanded && rule && (
                <div id={`trust-${p.id}`} className="border-t-2 border-line p-4 space-y-3">
                  <fieldset>
                    <legend className="font-bold mb-2">{t('people.trustTitle', { name: p.display_name })}</legend>
                    {(['auto', 'ask', 'blocked'] as const).map((lvl) => (
                      <label key={lvl} className="tap flex items-center gap-3 rounded-2xl px-3 hover:bg-paper cursor-pointer">
                        <input type="radio" name={`lvl-${p.id}`} checked={rule.level === lvl} onChange={() => setLevel(p.id, lvl)}
                          className="w-6 h-6 accent-brand" />
                        <span>{t(lvl === 'auto' ? 'people.trustAuto' : lvl === 'ask' ? 'people.trustAsk' : 'people.trustBlocked')}</span>
                      </label>
                    ))}
                  </fieldset>
                  {rule.level !== 'blocked' && (
                    <label className="tap flex items-center gap-3 rounded-2xl px-3 hover:bg-paper cursor-pointer">
                      <input type="checkbox" checked={rule.allow_alarms}
                        onChange={(e) => guard(actions.setRule(p.id, { allow_alarms: e.target.checked }), t('people.saved'))}
                        className="w-6 h-6 accent-brand" />
                      <span>{t('people.allowAlarms')}</span>
                    </label>
                  )}
                  <Button variant="danger" block icon={<Trash2 className="w-5 h-5" aria-hidden />}
                    onClick={() => { if (confirm(t('people.removeConfirm', { name: p.display_name }))) void guard(actions.removePerson(p.id)); }}>
                    {t('people.remove', { name: p.display_name })}
                  </Button>
                </div>
              )}
            </article>
          );
        })}
        {outgoing.map((c) => (
          <div key={c.id} className="rounded-3xl border-2 border-dashed border-line p-4 flex items-center gap-3 text-ink-2">
            <Avatar id={c.addressee_id} name={nameOf(c.addressee_id)} size="sm" />
            <span className="font-semibold text-ink">{nameOf(c.addressee_id)}</span>
            <span>· {t('people.waiting')}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="h-code" className="rounded-3xl bg-brand-soft p-5 space-y-3">
        <h2 id="h-code" className="text-[1.2rem] font-bold">{t('people.myCode')}</h2>
        <p className="text-ink-2">{t('people.myCodeHint')}</p>
        <p className="text-[2.4rem] font-bold tracking-[0.25em] text-brand-dark text-center ltr-nums">
          <span aria-hidden>{me?.invite_code}</span>
          <span className="sr-only">{(me?.invite_code ?? '').split('').join(' ')}</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" icon={<Copy className="w-5 h-5" aria-hidden />}
            onClick={() => { void navigator.clipboard?.writeText(me?.invite_code ?? ''); toast({ text: t('common.copied') }); }}>
            {t('common.copy')}
          </Button>
          <Button icon={<Share2 className="w-5 h-5" aria-hidden />} onClick={shareCode}>{t('people.share')}</Button>
        </div>
      </section>

      <section aria-labelledby="h-add" className="space-y-3">
        <h2 id="h-add" className="text-[1.2rem] font-bold">{t('people.addTitle')}</h2>
        <form onSubmit={add} className="space-y-3">
          <label htmlFor="code" className="block text-ink-2">{t('people.addHint')}</label>
          <input id="code" inputMode="numeric" pattern="[0-9]*" maxLength={6} dir="ltr" value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="tap w-full rounded-2xl border-2 border-field bg-card px-4 text-center text-[1.6rem] tracking-[0.4em] font-bold focus:border-brand outline-none ltr-nums" />
          <Button type="submit" block disabled={busy || code.length !== 6} icon={<UserPlus className="w-5 h-5" aria-hidden />}>
            {t('people.add')}
          </Button>
          {error && <p role="alert" className="rounded-2xl bg-alarm-soft text-alarm px-4 py-3 font-semibold">{error}</p>}
        </form>
      </section>
    </div>
  );
}
