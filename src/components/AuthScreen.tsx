import { useEffect, useState } from 'react';
import { Mail, Globe } from 'lucide-react';
import { supabase, errorKey } from '../lib/supabase';
import { useT } from '../lib/i18n';
import { Button } from './ui/Button';
import type { Lang } from '../types';

/** Email + 6-digit code. No passwords to forget, no magic link that opens the wrong browser. */
export function AuthScreen({ onLang }: { onLang: (l: Lang) => void }) {
  const { t, lang } = useT();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const resend = async () => {
    setBusy(true); setError('');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(t(errorKey(error))); else setCooldown(60);
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(t(errorKey(error))); else { setStep('code'); setCooldown(60); }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(t('auth.badCode'));
  };

  return (
    <main className="min-h-dvh flex flex-col safe-top safe-bottom px-6">
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={() => onLang(lang === 'ar' ? 'en' : 'ar')}
          className="tap inline-flex items-center gap-2 px-4 rounded-full border-2 border-line font-semibold"
        >
          <Globe className="w-5 h-5" aria-hidden />
          <span lang={lang === 'ar' ? 'en' : 'ar'}>{lang === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
        <h1 className="text-[2rem] font-bold leading-tight">{t('auth.title')}</h1>
        <p className="mt-2 text-ink-2 text-[1.1rem]">{t('app.tagline')}</p>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="mt-10 space-y-4">
            <label htmlFor="email" className="block text-[1.1rem] font-semibold">{t('auth.emailLabel')}</label>
            <input
              id="email" type="email" required autoComplete="email" inputMode="email" dir="ltr"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="tap w-full rounded-2xl border-2 border-field bg-card px-4 text-[1.1rem] focus:border-brand outline-none"
              aria-describedby="email-hint"
            />
            <p id="email-hint" className="text-ink-2">{t('auth.emailHint')}</p>
            <Button type="submit" block disabled={busy || !email.includes('@')} icon={<Mail className="w-5 h-5" aria-hidden />}>
              {t('auth.sendCode')}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-10 space-y-4">
            <p className="text-ink-2">{t('auth.codeSentTo', { email })}</p>
            <label htmlFor="code" className="block text-[1.1rem] font-semibold">{t('auth.codeLabel')}</label>
            <input
              id="code" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={6} dir="ltr"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="tap w-full rounded-2xl border-2 border-field bg-card px-4 text-center text-[1.8rem] tracking-[0.4em] font-bold focus:border-brand outline-none ltr-nums"
            />
            <Button type="submit" block disabled={busy || code.length < 6}>{t('auth.verify')}</Button>
            <Button variant="ghost" block disabled={busy || cooldown > 0} onClick={() => void resend()}>
              {cooldown > 0 ? t('auth.resendIn', { n: cooldown.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB') }) : t('auth.resend')}
            </Button>
            <Button variant="ghost" block onClick={() => { setStep('email'); setCode(''); setError(''); }}>
              {t('auth.changeEmail')}
            </Button>
          </form>
        )}

        {error && <p role="alert" className="mt-4 rounded-2xl bg-alarm-soft text-alarm px-4 py-3 font-semibold">{error}</p>}
      </div>
    </main>
  );
}

export function NameSetup({ onSave }: { onSave: (name: string) => Promise<void> }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="min-h-dvh flex flex-col justify-center safe-top safe-bottom px-6 max-w-md mx-auto">
      <form
        onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSave(name.trim()); } finally { setBusy(false); } }}
        className="space-y-4"
      >
        <label htmlFor="name" className="block text-[1.7rem] font-bold leading-tight">{t('name.title')}</label>
        <p id="name-hint" className="text-ink-2 text-[1.05rem]">{t('name.hint')}</p>
        <input
          id="name" required autoFocus maxLength={60} autoComplete="given-name" aria-describedby="name-hint"
          placeholder={t('name.placeholder')} value={name} onChange={(e) => setName(e.target.value)}
          className="tap w-full rounded-2xl border-2 border-field bg-card px-4 text-[1.2rem] focus:border-brand outline-none"
        />
        <Button type="submit" block disabled={busy || !name.trim()}>{t('name.save')}</Button>
      </form>
    </main>
  );
}
