import { useMemo, useState } from 'react';
import { AlarmClock, Bell, Check, ChevronLeft, ChevronRight, ShieldCheck, Hourglass } from 'lucide-react';
import { makeT, useT } from '../lib/i18n';
import { formatWhen, toDateInput, toTimeInput } from '../lib/time';
import { errorKey } from '../lib/supabase';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import { useToast } from './ui/Toast';
import type { SyncState } from '../hooks/useSync';
import type { ItemKind, Repeat } from '../types';

type Preset = 'in1' | 'in15' | 'tonight' | 'tomorrow' | 'in1h' | 'custom';

function presetDate(p: Exclude<Preset, 'custom'>) {
  const d = new Date();
  if (p === 'in1') d.setMinutes(d.getMinutes() + 1);
  if (p === 'in15') d.setMinutes(d.getMinutes() + 15, 0, 0);
  if (p === 'in1h') d.setHours(d.getHours() + 1, d.getMinutes(), 0, 0);
  if (p === 'tonight') { d.setHours(20, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); }
  if (p === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); }
  return d;
}

const IDEAS = ['idea.meds', 'idea.water', 'idea.call', 'idea.appointment', 'idea.pickup', 'idea.prayer'] as const;

export function SendSheet({ sync, userId, simple, initialReceiver, onClose }: {
  sync: SyncState; userId: string; simple: boolean; initialReceiver?: string; onClose: () => void;
}) {
  const { t, lang } = useT();
  const toast = useToast();
  const { people, profiles, ruleFor, actions, nameOf } = sync;

  const [step, setStep] = useState(initialReceiver ? 2 : 1);
  const [receiver, setReceiver] = useState(initialReceiver ?? '');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<ItemKind>('reminder');
  const [preset, setPreset] = useState<Preset>('in15');
  const [date, setDate] = useState(toDateInput(presetDate('in1h')));
  const [time, setTime] = useState(toTimeInput(presetDate('in1h')));
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isMe = receiver === userId;
  const rule = isMe ? undefined : ruleFor(receiver, userId); // the RECEIVER's rule about me
  const alarmsAllowed = isMe || !rule || rule.allow_alarms;
  const willAutoSet = isMe || (rule?.level === 'auto' && (kind === 'reminder' || rule.allow_alarms));
  const who = isMe ? t('send.me') : nameOf(receiver);
  // Quick ideas are written in the language of the person whose phone will show them.
  const tReceiver = makeT(profiles.find((p) => p.id === receiver)?.language ?? lang);

  const dueAt = useMemo(() => {
    if (preset !== 'custom') return presetDate(preset);
    return new Date(`${date}T${time}`);
  }, [preset, date, time]);

  const submit = async () => {
    // Re-compute relative presets at the moment of sending ("in 15 min" means from now, not from when tapped).
    const at = preset === 'custom' ? new Date(`${date}T${time}`) : presetDate(preset);
    if (!(at.getTime() > Date.now())) { setError(t('send.past')); return; }
    setBusy(true); setError('');
    try {
      await actions.send({
        receiver_id: receiver, kind: alarmsAllowed ? kind : 'reminder',
        title: title.trim(), note: note.trim() || undefined, due_at: at.toISOString(), repeat,
      });
      toast({ text: isMe ? t('send.saved') : t('send.sent', { name: who }) });
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;
  const Next = lang === 'ar' ? ChevronLeft : ChevronRight;

  const choice = (active: boolean) =>
    `tap w-full rounded-2xl border-2 px-4 py-3 text-start font-semibold transition-colors ${
      active ? 'border-brand bg-brand-soft text-brand-dark' : 'border-field bg-card hover:border-ink-2'}`;

  const footer = (
    <div className="flex gap-3 pb-2">
      {step > 1 && (
        <Button variant="secondary" onClick={() => { setError(''); setStep(step - 1); }} icon={<Back className="w-5 h-5" aria-hidden />}>
          {t('send.back')}
        </Button>
      )}
      {step < 3 ? (
        <Button className="flex-1" disabled={step === 1 ? !receiver : !title.trim()} onClick={() => setStep(step + 1)}>
          {t('send.next')} <Next className="w-5 h-5 inline" aria-hidden />
        </Button>
      ) : (
        <Button className="flex-1" variant="ok" disabled={busy} onClick={submit} icon={<Check className="w-5 h-5" aria-hidden />}>
          {isMe ? t('send.save') : t('send.send')}
        </Button>
      )}
    </div>
  );

  return (
    <Sheet title={t('send.title')} onClose={onClose} footer={footer} dismissible={!title.trim() && !note.trim()}>
      {/* progress: text, not just dots */}
      <p className="text-ink-2 font-semibold" aria-live="polite">{t('send.step', { n: lang === 'ar' ? '١٢٣'[step - 1] : step })}</p>
      <div className="flex gap-1.5 mt-2 mb-5" aria-hidden>
        {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-brand' : 'bg-line'}`} />)}
      </div>

      {step === 1 && (
        <fieldset>
          <legend className="text-[1.3rem] font-bold mb-3">{t('send.stepWho')}</legend>
          <div className="grid gap-3">
            {people.map((p) => (
              <button key={p.id} type="button" onClick={() => setReceiver(p.id)} aria-pressed={receiver === p.id}
                className={`${choice(receiver === p.id)} flex items-center gap-3`}>
                <Avatar id={p.id} name={p.display_name} />
                <span className="text-[1.15rem]">{p.display_name}</span>
              </button>
            ))}
            <button type="button" onClick={() => setReceiver(userId)} aria-pressed={isMe}
              className={`${choice(isMe)} flex items-center gap-3`}>
              <Avatar id={userId} name={nameOf(userId)} />
              <span className="text-[1.15rem]">{t('send.me')}</span>
            </button>
            {people.length === 0 && <p className="text-ink-2">{t('send.noPeople')}</p>}
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <label htmlFor="title" className="block text-[1.3rem] font-bold mb-2">{t('send.titleLabel')}</label>
            <input id="title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={t('send.titlePlaceholder')}
              className="tap w-full rounded-2xl border-2 border-field bg-card px-4 text-[1.15rem] focus:border-brand outline-none" />
            <p className="mt-3 mb-2 text-ink-2 font-semibold">{t('send.ideas')}</p>
            <div className="flex flex-wrap gap-2">
              {IDEAS.slice(0, simple ? 4 : IDEAS.length).map((k) => (
                <button key={k} type="button" onClick={() => setTitle(tReceiver(k))}
                  className="tap rounded-full border-2 border-field bg-card px-4 font-medium hover:border-brand">
                  {t(k)}
                </button>
              ))}
            </div>
          </div>

          {!simple && (
            <div>
              <label htmlFor="note" className="block font-semibold mb-2">{t('send.noteLabel')}</label>
              <input id="note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)}
                className="tap w-full rounded-2xl border-2 border-field bg-card px-4 focus:border-brand outline-none" />
            </div>
          )}

          <fieldset>
            <legend className="font-bold text-[1.1rem] mb-2">{t('send.kindLabel')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" aria-pressed={kind === 'reminder'} onClick={() => setKind('reminder')} className={choice(kind === 'reminder')}>
                <Bell className="w-6 h-6 mb-1" aria-hidden />
                <span className="block">{t('send.kindReminder')}</span>
                <span className="block text-[0.9rem] font-normal text-ink-2">{t('send.kindReminderHint')}</span>
              </button>
              <button type="button" aria-pressed={kind === 'alarm'} disabled={!alarmsAllowed} onClick={() => setKind('alarm')}
                className={`${choice(kind === 'alarm')} disabled:opacity-50`}>
                <AlarmClock className="w-6 h-6 mb-1 text-alarm" aria-hidden />
                <span className="block">{t('send.kindAlarm')}</span>
                <span className="block text-[0.9rem] font-normal text-ink-2">{t('send.kindAlarmHint')}</span>
              </button>
            </div>
            {!alarmsAllowed && <p className="mt-2 text-warn">{t('send.alarmNotAllowed', { name: who })}</p>}
          </fieldset>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <fieldset>
            <legend className="text-[1.3rem] font-bold mb-3">{t('send.stepWhen')}</legend>
            <div className="grid grid-cols-2 gap-3">
              {(['in1', 'in15', 'tonight', 'tomorrow'] as const).filter((p) => p !== 'tonight' || new Date().getHours() < 20).map((p) => (
                <button key={p} type="button" aria-pressed={preset === p} onClick={() => setPreset(p)} className={choice(preset === p)}>
                  {t(`send.when${p === 'in1' ? 'In1' : p === 'in15' ? 'In15' : p === 'tonight' ? 'Tonight' : 'Tomorrow'}`)}
                </button>
              ))}
            </div>
            <button type="button" aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')} className={`${choice(preset === 'custom')} mt-3`}>
              {t('send.whenCustom')}
            </button>
            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <label className="block">
                  <span className="block font-semibold mb-1">{t('send.date')}</span>
                  <input type="date" value={date} min={toDateInput(new Date())} onChange={(e) => setDate(e.target.value)}
                    className="tap w-full rounded-2xl border-2 border-field bg-card px-3 focus:border-brand outline-none" />
                </label>
                <label className="block">
                  <span className="block font-semibold mb-1">{t('send.time')}</span>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                    className="tap w-full rounded-2xl border-2 border-field bg-card px-3 focus:border-brand outline-none" />
                </label>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="font-bold text-[1.1rem] mb-2">{t('send.repeatLabel')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(['none', 'daily', 'weekly'] as const).map((r) => (
                <button key={r} type="button" aria-pressed={repeat === r} onClick={() => setRepeat(r)} className={`${choice(repeat === r)} text-center`}>
                  {t(r === 'none' ? 'send.repeatNone' : r === 'daily' ? 'send.repeatDaily' : 'send.repeatWeekly')}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Plain-language summary before sending */}
          <div className="rounded-2xl bg-card border-2 border-line p-4 space-y-2">
            <p className="font-bold text-[1.1rem]">{title}</p>
            {(() => {
              const vars = {
                kind: t(alarmsAllowed && kind === 'alarm' ? 'item.alarm' : 'item.reminder'),
                name: who,
                when: isNaN(dueAt.getTime()) ? '—' : formatWhen(dueAt.toISOString(), lang, t),
              };
              return <p>{t(isMe ? 'send.summaryMe' : 'send.summary', vars)}</p>;
            })()}
            {!isMe && (
              <p className={`flex items-center gap-2 font-semibold ${willAutoSet ? 'text-ok' : 'text-warn'}`}>
                {willAutoSet ? <ShieldCheck className="w-5 h-5" aria-hidden /> : <Hourglass className="w-5 h-5" aria-hidden />}
                {t(willAutoSet ? 'send.willRing' : 'send.willAsk', { name: who })}
              </p>
            )}
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-4 rounded-2xl bg-alarm-soft text-alarm px-4 py-3 font-semibold">{error}</p>}
    </Sheet>
  );
}
