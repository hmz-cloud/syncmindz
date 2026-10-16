import { useEffect, useState } from 'react';
import { BellOff, LogOut, Volume2 } from 'lucide-react';
import { useT } from '../lib/i18n';
import { supabase, errorKey } from '../lib/supabase';
import { checkPermission, requestPermission, type PermState } from '../lib/alarms';
import { unlockAudio } from '../lib/sound';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import type { SyncState } from '../hooks/useSync';
import type { Lang, TextScale } from '../types';

export function SettingsView({ sync, userId }: { sync: SyncState; userId: string }) {
  const { t } = useT();
  const toast = useToast();
  const { me, actions } = sync;
  const [name, setName] = useState(me?.display_name ?? '');
  const [perm, setPerm] = useState<PermState>('granted');

  useEffect(() => { void checkPermission().then(setPerm); }, []);
  if (!me) return null;

  const save = (patch: Parameters<typeof actions.updateProfile>[0]) =>
    actions.updateProfile(patch).catch((e) => toast({ text: t(errorKey(e)), tone: 'error' }));

  const seg = (active: boolean) =>
    `tap flex-1 rounded-2xl border-2 font-semibold ${active ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-card'}`;

  const testAlarm = async () => {
    unlockAudio();
    try {
      await actions.send({
        receiver_id: userId, kind: 'alarm', title: t('settings.test'),
        due_at: new Date(Date.now() + 10_000).toISOString(), repeat: 'none',
      });
      toast({ text: t('settings.testArmed') });
    } catch (e) {
      toast({ text: t(errorKey(e)), tone: 'error' });
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-[1.7rem] font-bold">{t('settings.title')}</h1>

      {perm !== 'granted' && (
        <div role="alert" className="rounded-3xl bg-alarm-soft border-2 border-alarm/40 p-5 space-y-3">
          <p className="flex items-center gap-2 font-bold text-alarm text-[1.1rem]"><BellOff className="w-6 h-6" aria-hidden />{t('settings.notifications')}</p>
          <p>{t('settings.notificationsHint')}</p>
          <Button onClick={async () => setPerm(await requestPermission())}>{t('settings.enable')}</Button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-[1.15rem] font-bold">{t('settings.language')}</h2>
        <div className="flex gap-3" role="group" aria-label={t('settings.language')}>
          {(['ar', 'en'] as Lang[]).map((l) => (
            <button key={l} type="button" aria-pressed={me.language === l} onClick={() => save({ language: l })} className={seg(me.language === l)}>
              {l === 'ar' ? 'العربية' : 'English'}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[1.15rem] font-bold">{t('settings.textSize')}</h2>
        <div className="flex gap-3" role="group" aria-label={t('settings.textSize')}>
          {(['normal', 'large', 'xlarge'] as TextScale[]).map((s, i) => (
            <button key={s} type="button" aria-pressed={me.text_scale === s} onClick={() => save({ text_scale: s })} className={seg(me.text_scale === s)}>
              <span style={{ fontSize: `${0.95 + i * 0.2}rem` }}>{t(`settings.text.${s}`)}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <label className="flex items-start gap-4 rounded-3xl bg-card border-2 border-line p-5 cursor-pointer">
          <input type="checkbox" role="switch" checked={me.simple_mode} onChange={(e) => save({ simple_mode: e.target.checked })}
            className="mt-1 w-7 h-7 accent-brand shrink-0" />
          <span>
            <span className="block font-bold text-[1.15rem]">{t('settings.simple')}</span>
            <span className="block text-ink-2">{t('settings.simpleHint')}</span>
          </span>
        </label>
      </section>

      <section className="space-y-2">
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void save({ display_name: name.trim() }).then(() => toast({ text: t('people.saved') })); }}>
          <label htmlFor="s-name" className="block text-[1.15rem] font-bold">{t('settings.name')}</label>
          <div className="flex gap-3">
            <input id="s-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)}
              className="tap flex-1 min-w-0 rounded-2xl border-2 border-line bg-card px-4 focus:border-brand outline-none" />
            <Button type="submit" variant="secondary">{t('send.save')}</Button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl bg-card border-2 border-line p-5 space-y-3">
        <p className="font-bold text-[1.15rem]">{t('settings.test')}</p>
        <p className="text-ink-2">{t('settings.testHint')}</p>
        <Button block onClick={testAlarm} icon={<Volume2 className="w-5 h-5" aria-hidden />}>{t('settings.test')}</Button>
      </section>

      <Button variant="danger" block onClick={() => void supabase.auth.signOut()} icon={<LogOut className="w-5 h-5" aria-hidden />}>
        {t('settings.signOut')}
      </Button>
    </div>
  );
}
