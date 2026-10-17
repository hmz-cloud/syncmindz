import { useEffect, useRef, useState } from 'react';
import { AlarmClock, Bell, Check, Clock3, Volume2 } from 'lucide-react';
import { useT } from '../lib/i18n';
import { formatTime } from '../lib/time';
import { canSpeak, speak, startRinging } from '../lib/sound';
import { silenceNative } from '../lib/alarms';
import { Avatar } from './ui/Avatar';
import type { Item } from '../types';

/**
 * Full-screen. One giant "Done" button in thumb reach. Snooze is clearly second.
 * Replies are optional and never block turning the alarm off.
 */
export function RingingScreen({ item, fromName, onDone, onSnooze }: {
  item: Item; fromName: string; onDone: (reply?: string) => void; onSnooze: () => void;
}) {
  const { t, lang } = useT();
  const [reply, setReply] = useState<string | undefined>();
  const doneRef = useRef<HTMLButtonElement>(null);
  const own = item.sender_id === item.receiver_id;

  useEffect(() => {
    const stop = startRinging(item.kind);
    void silenceNative(item.id); // the app is ringing now; stop the phone's own notification sound
    doneRef.current?.focus({ preventScroll: true }); // keep the title in view; Done is pinned below
    return stop;
  }, [item.id, item.kind]);

  const Icon = item.kind === 'alarm' ? AlarmClock : Bell;
  const replies = ['ring.r1', 'ring.r2', 'ring.r3'] as const;

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="ring-title" aria-describedby="ring-from"
      className="fixed inset-0 z-[70] bg-paper flex flex-col safe-top safe-bottom px-6 overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-6">
        <div className="relative grid place-items-center w-28 h-28">
          <span className={`absolute inset-0 rounded-full pulse-ring ${item.kind === 'alarm' ? 'bg-alarm/30' : 'bg-brand/30'}`} aria-hidden />
          <span className={`relative grid place-items-center w-24 h-24 rounded-full text-white ${item.kind === 'alarm' ? 'bg-alarm' : 'bg-brand'}`}>
            <Icon className="w-12 h-12" aria-hidden />
          </span>
        </div>

        <p className="text-[1.5rem] font-bold">{formatTime(new Date(), lang)}</p>
        <h1 id="ring-title" className="text-[2.2rem] font-bold leading-tight max-w-md">{item.title}</h1>
        {item.note && <p className="text-[1.2rem] text-ink-2 max-w-md">{item.note}</p>}

        <div id="ring-from" className="flex items-center gap-3 mt-2">
          {!own && <Avatar id={item.sender_id} name={fromName} />}
          <p className="text-[1.2rem] font-semibold">{own ? t('ring.own') : t('ring.from', { name: fromName })}</p>
        </div>

        {canSpeak() && (
          <button type="button" onClick={() => speak(`${item.title}. ${item.note ?? ''}`, lang)}
            className="tap inline-flex items-center gap-2 rounded-full border-2 border-line bg-card px-5 font-semibold">
            <Volume2 className="w-5 h-5" aria-hidden /> {t('ring.readAloud')}
          </button>
        )}

        {!own && (
          <fieldset className="w-full max-w-md mt-2">
            <legend className="text-ink-2 font-semibold mb-2">{t('ring.reply')}</legend>
            <div className="flex flex-wrap justify-center gap-2">
              {replies.map((r) => {
                const text = t(r);
                const on = reply === text;
                return (
                  <button key={r} type="button" aria-pressed={on} onClick={() => setReply(on ? undefined : text)}
                    className={`tap rounded-full border-2 px-5 font-semibold ${on ? 'border-brand bg-brand-soft text-brand-dark' : 'border-field bg-card'}`}>
                    {text}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>

      {/* Pinned to the bottom so Done is always on screen, even when big text makes the page scroll */}
      <div className="sticky bottom-0 w-full max-w-md mx-auto space-y-3 pt-3 pb-4 bg-paper">
        <button ref={doneRef} type="button" onClick={() => onDone(reply)}
          className="w-full min-h-[5rem] rounded-3xl bg-ok text-white text-[1.6rem] font-bold inline-flex items-center justify-center gap-3 shadow-lg active:scale-[.98]">
          <Check className="w-9 h-9" aria-hidden /> {t('ring.done')}
        </button>
        <button type="button" onClick={onSnooze}
          className="tap w-full rounded-3xl border-2 border-line bg-card text-[1.15rem] font-semibold inline-flex items-center justify-center gap-2">
          <Clock3 className="w-6 h-6" aria-hidden /> {t('ring.snooze')}
        </button>
      </div>
    </div>
  );
}
