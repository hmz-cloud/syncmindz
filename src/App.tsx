import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home, Plus, Settings, Users } from 'lucide-react';
import { LangContext, makeT } from './lib/i18n';
import { isConfigured } from './lib/supabase';
import { ringTime } from './lib/time';
import { App as CapApp } from '@capacitor/app';
import { isNative, setupNative, setNativeLanguage, syncLocalAlarms, webNotify, checkPermission, requestPermission } from './lib/alarms';
import { unlockAudio } from './lib/sound';
import { useSession, useSync } from './hooks/useSync';
import { AuthScreen, NameSetup } from './components/AuthScreen';
import { HomeView } from './components/HomeView';
import { PeopleView } from './components/PeopleView';
import { SettingsView } from './components/SettingsView';
import { SendSheet } from './components/SendSheet';
import { RingingScreen } from './components/RingingScreen';
import { ToastProvider, useToast } from './components/ui/Toast';
import type { Item, Lang, TextScale } from './types';

const LANG_KEY = 'syncmindz.lang';

function applyDocument(lang: Lang, text: TextScale, simple: boolean) {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  html.dataset.text = text;
  html.classList.toggle('simple', simple);
}

export default function App() {
  const session = useSession();
  const [guestLang, setGuestLang] = useState<Lang>(() => {
    try { return (localStorage.getItem(LANG_KEY) as Lang) || (navigator.language.startsWith('ar') ? 'ar' : 'en'); }
    catch { return 'ar'; }
  });

  if (!isConfigured) {
    return <div className="p-8 font-semibold">{makeT(guestLang)('setup.missing')}</div>;
  }

  if (session === undefined) return <Splash lang={guestLang} />;

  if (!session) {
    applyDocument(guestLang, 'large', false);
    return (
      <LangContext.Provider value={{ lang: guestLang, t: makeT(guestLang) }}>
        <AuthScreen onLang={(l) => { setGuestLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* */ } }} />
      </LangContext.Provider>
    );
  }

  return (
    <ToastProvider>
      <SignedIn userId={session.user.id} fallbackLang={guestLang} />
    </ToastProvider>
  );
}

function Splash({ lang }: { lang: Lang }) {
  return (
    <div role="status" className="min-h-dvh grid place-items-center">
      <span aria-hidden className="w-10 h-10 rounded-full border-4 border-brand border-t-transparent animate-spin" />
      <span className="sr-only">{makeT(lang)('common.loading')}</span>
    </div>
  );
}

type Tab = 'home' | 'people' | 'settings';

function SignedIn({ userId, fallbackLang }: { userId: string; fallbackLang: Lang }) {
  const sync = useSync(userId);
  const { me, items, nameOf, actions, loaded } = sync;
  const toast = useToast();

  // A brand-new account has the database default language ('ar'); until the person has a name,
  // keep the language they picked on the sign-in screen, and save it with their name.
  const isNew = !!me && !me.display_name;
  const lang = isNew ? fallbackLang : me?.language ?? fallbackLang;
  const simple = me?.simple_mode ?? false;
  const t = useMemo(() => makeT(lang), [lang]);

  useEffect(() => {
    applyDocument(lang, me?.text_scale ?? 'large', simple);
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* */ }
  }, [lang, me?.text_scale, simple]);

  const [tab, setTab] = useState<Tab>('home');
  const [sendFor, setSendFor] = useState<string | null | undefined>(undefined); // undefined = closed
  const [ringingId, setRingingId] = useState<string | null>(null);
  const handled = useRef(new Set<string>());

  const mine = useMemo(() => items.filter((i) => i.receiver_id === userId), [items, userId]);
  // Only ring live items: if it was cancelled or done elsewhere, the ringing screen closes.
  const ringing = items.find((i) => i.id === ringingId && ['scheduled', 'snoozed'].includes(i.status)) ?? null;
  useEffect(() => { if (ringingId && !ringing && loaded) setRingingId(null); }, [ringingId, ringing, loaded]);

  // Native: notification taps. On a cold start the tap can arrive before data loads,
  // so it is held and replayed once items are in.
  const pendingAction = useRef<{ id: string; a: string } | null>(null);
  const openItem = useCallback((itemId: string, action: string) => {
    const it = sync.items.find((i) => i.id === itemId);
    if (!it && !loaded) { pendingAction.current = { id: itemId, a: action }; return; }
    if (action === 'SNOOZE' && it) { actions.snooze(it).catch(() => {}); return; }
    if (action === 'DONE' && it) { actions.markDone(it).catch(() => {}); return; }
    setRingingId(itemId);
  }, [sync.items, actions, loaded]);
  const openRef = useRef(openItem);
  openRef.current = openItem;
  useEffect(() => {
    if (loaded && pendingAction.current) {
      const p = pendingAction.current;
      pendingAction.current = null;
      openItem(p.id, p.a);
    }
  }, [loaded, openItem]);
  useEffect(() => {
    void setupNative((id, a) => openRef.current(id, a), lang);
    void checkPermission().then((p) => { if (p === 'prompt') void requestPermission(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock-screen buttons and channel names follow the language setting (setupNative uses the first one).
  const firstLang = useRef(true);
  useEffect(() => {
    if (firstLang.current) { firstLang.current = false; return; }
    void setNativeLanguage(lang);
  }, [lang]);

  // Android Back button: never silently kill a ringing alarm or close the app from inside a sheet.
  useEffect(() => {
    if (!isNative) return;
    const h = CapApp.addListener('backButton', () => {
      if (ringing) { setRingingId(null); actions.snooze(ringing).catch(() => {}); return; } // Back = remind me in 10 min
      if (sendFor !== undefined) { setSendFor(undefined); return; }
      if (tab !== 'home') { setTab('home'); return; }
      void CapApp.minimizeApp();
    });
    return () => { void h.then((x) => x.remove()); };
  }, [ringing, sendFor, tab, actions]);

  // Mirror upcoming items into the OS alarm scheduler (works with the app closed).
  useEffect(() => {
    if (loaded) void syncLocalAlarms(mine, nameOf);
  }, [mine, nameOf, loaded]);

  // In-app ringing check (foreground). Rings anything due within the last 30 minutes.
  useEffect(() => {
    const tick = () => {
      if (ringingId) return;
      const now = Date.now();
      const due = mine.find((i) => {
        if (!['scheduled', 'snoozed'].includes(i.status)) return false;
        const at = new Date(ringTime(i)).getTime();
        return at <= now && now - at < 30 * 60_000 && !handled.current.has(i.id + ringTime(i));
      });
      if (due) {
        handled.current.add(due.id + ringTime(due));
        setRingingId(due.id);
        if (!isNative) webNotify(due.title, due.sender_id === userId ? '' : t('ring.from', { name: nameOf(due.sender_id) }));
      }
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [mine, ringingId, nameOf, t, userId]);

  // first tap anywhere unlocks web audio (browsers block sound until then)
  useEffect(() => {
    const u = () => unlockAudio();
    window.addEventListener('pointerdown', u, { once: true });
    return () => window.removeEventListener('pointerdown', u);
  }, []);

  if (!loaded) return <Splash lang={lang} />;

  const ctx = { lang, t };

  if (me && !me.display_name) {
    return (
      <LangContext.Provider value={ctx}>
        <NameSetup onSave={(n) => actions.updateProfile({ display_name: n, language: fallbackLang })} />
      </LangContext.Provider>
    );
  }

  const done = (item: Item, reply?: string) => {
    setRingingId(null);
    actions.markDone(item, reply).catch(() => toast({ text: t('err.offline'), tone: 'error' }));
  };
  const snooze = (item: Item) => {
    setRingingId(null);
    actions.snooze(item).catch(() => toast({ text: t('err.offline'), tone: 'error' }));
  };

  const navItems: { id: Tab; label: string; Icon: typeof Home }[] = [
    { id: 'home', label: t('nav.home'), Icon: Home },
    { id: 'people', label: t('nav.people'), Icon: Users },
    { id: 'settings', label: t('nav.settings'), Icon: Settings },
  ];

  return (
    <LangContext.Provider value={ctx}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[80] bg-card p-3 rounded-xl">
        {t('nav.skip')}
      </a>

      <main id="main" inert={ringing ? true : undefined} className="max-w-xl mx-auto px-5 safe-top"
        style={{ paddingBottom: 'calc(12rem + env(safe-area-inset-bottom))' }}>
        {tab === 'home' && <HomeView sync={sync} userId={userId} simple={simple} />}
        {tab === 'people' && <PeopleView sync={sync} userId={userId} onRemind={(id) => setSendFor(id)} />}
        {tab === 'settings' && <SettingsView sync={sync} userId={userId} />}
      </main>

      {/* Big, labelled "New" button above the nav — not an unlabeled floating "+" */}
      <div inert={ringing ? true : undefined} className="fixed inset-x-0 z-30 flex justify-center px-5 pointer-events-none"
        style={{ bottom: 'calc(5.2rem + env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={() => setSendFor(null)}
          className="pointer-events-auto tap w-full max-w-xl rounded-2xl bg-brand text-white text-[1.15rem] font-bold shadow-lg inline-flex items-center justify-center gap-2 active:scale-[.98]">
          <Plus className="w-6 h-6" aria-hidden /> {t('nav.new')}
        </button>
      </div>

      <nav inert={ringing ? true : undefined} aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-30 bg-card border-t-2 border-line safe-bottom">
        <ul className="max-w-xl mx-auto grid grid-cols-3">
          {navItems.map(({ id, label, Icon }) => {
            const active = tab === id;
            const badge = id === 'home'
              ? items.filter((i) => i.receiver_id === userId && i.sender_id !== userId && i.status === 'pending').length
              : id === 'people' ? sync.connections.filter((c) => c.status === 'pending' && c.addressee_id === userId).length : 0;
            return (
              <li key={id}>
                <button type="button" onClick={() => { setTab(id); window.scrollTo(0, 0); }} aria-current={active ? 'page' : undefined}
                  className={`relative w-full min-h-[4.2rem] flex flex-col items-center justify-center gap-0.5 font-semibold
                    ${active ? 'text-brand-dark' : 'text-ink-2'}`}>
                  <Icon className={`w-7 h-7 ${active ? 'stroke-[2.5]' : ''}`} aria-hidden />
                  <span className="text-[0.95rem]">{label}</span>
                  {active && <span className="absolute top-0 h-1 w-12 rounded-b-full bg-brand" aria-hidden />}
                  {badge > 0 && (
                    <>
                      <span aria-hidden className="absolute top-1.5 ms-8 min-w-6 h-6 px-1.5 rounded-full bg-alarm text-white text-[0.8rem] grid place-items-center">
                        {badge}
                      </span>
                      <span className="sr-only">{t('nav.badge', { n: badge })}</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {sendFor !== undefined && (
        <div inert={ringing ? true : undefined}>
          <SendSheet sync={sync} userId={userId} simple={simple} initialReceiver={sendFor ?? undefined} onClose={() => setSendFor(undefined)} />
        </div>
      )}

      {ringing && (
        <RingingScreen item={ringing} fromName={nameOf(ringing.sender_id)}
          onDone={(reply) => done(ringing, reply)} onSnooze={() => snooze(ringing)} />
      )}
    </LangContext.Provider>
  );
}
