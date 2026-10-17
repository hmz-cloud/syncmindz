import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { nextOccurrence } from '../lib/time';
import type { Connection, Item, NewItem, Profile, TrustRule } from '../types';

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

// ── Offline outbox: "Done" / "Snooze" pressed without internet are kept and retried,
// so the sender is never told "not confirmed" when the person actually confirmed.
const OUTBOX = 'syncmindz.outbox';
type Pending = { id: string; patch: Partial<Item> & { due_pushed_at?: null } };
const readOutbox = (): Pending[] => { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch { return []; } };
const writeOutbox = (q: Pending[]) => { try { localStorage.setItem(OUTBOX, JSON.stringify(q)); } catch { /* storage unavailable */ } };
const isNetworkError = (e: { message?: string } | null) => !!e && /fetch|network|offline|Failed to fetch/i.test(e.message ?? '');

async function flushOutbox() {
  const q = readOutbox();
  if (!q.length) return;
  const left: Pending[] = [];
  for (const p of q) {
    const { error } = await supabase.from('items').update(p.patch).eq('id', p.id);
    if (error && isNetworkError(error)) left.push(p); // drop non-network errors (e.g. item cancelled meanwhile)
  }
  writeOutbox(left);
}
const applyOutbox = (items: Item[]) => {
  const q = readOutbox();
  return q.length ? items.map((i) => { const p = q.filter((x) => x.id === i.id).pop(); return p ? { ...i, ...p.patch } as Item : i; }) : items;
};

/** Update an item; if offline, queue it instead of losing it. */
async function updateOrQueue(id: string, patch: Pending['patch']) {
  const { error } = await supabase.from('items').update(patch).eq('id', id);
  if (!error) return;
  if (isNetworkError(error)) { writeOutbox([...readOutbox(), { id, patch }]); return; }
  throw error;
}

export function useSync(userId: string) {
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [rules, setRules] = useState<TrustRule[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loadingRef = useRef(false);
  const againRef = useRef(false);

  const load = useCallback(async () => {
    // If a change arrives mid-load, run once more afterwards so nothing is missed.
    if (loadingRef.current) { againRef.current = true; return; }
    loadingRef.current = true;
    try {
      do {
      againRef.current = false;
      await flushOutbox();
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const [p, c, r, i] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('connections').select('*').is('ended_at', null),
        supabase.from('trust_rules').select('*'),
        supabase.from('items').select('*')
          .or(`status.in.(pending,scheduled,snoozed),updated_at.gte.${since}`)
          .order('due_at', { ascending: true }).limit(300),
      ]);
      if (p.data) {
        setProfiles(p.data as Profile[]);
        setMe((p.data as Profile[]).find((x) => x.id === userId) ?? null);
      }
      if (c.data) setConnections(c.data as Connection[]);
      if (r.data) setRules(r.data as TrustRule[]);
      if (i.data) setItems(applyOutbox(i.data as Item[]));
      setLoaded(true);
      } while (againRef.current);
    } finally {
      loadingRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const ch = supabase.channel('sync-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trust_rules' }, () => void load())
      .subscribe();
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onVis);
    return () => {
      void supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onVis);
    };
  }, [load, userId]);

  const nameOf = useCallback(
    (id: string) => profiles.find((p) => p.id === id)?.display_name || '…',
    [profiles],
  );

  const people = useMemo(() => {
    const accepted = connections.filter((c) => c.status === 'accepted');
    return accepted
      .map((c) => profiles.find((p) => p.id === (c.requester_id === userId ? c.addressee_id : c.requester_id)))
      .filter((p): p is Profile => Boolean(p))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [connections, profiles, userId]);

  /** Rule that `ownerId` has set for things coming from `senderId`. */
  const ruleFor = useCallback(
    (ownerId: string, senderId: string) => rules.find((r) => r.owner_id === ownerId && r.sender_id === senderId),
    [rules],
  );

  // optimistic local patch
  const patchLocal = (id: string, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const actions = useMemo(() => ({
    reload: load,

    async updateProfile(patch: Partial<Profile>) {
      setMe((m) => (m ? { ...m, ...patch } : m));
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) throw error;
    },

    async send(n: NewItem) {
      const { data, error } = await supabase.from('items').insert(n).select().single();
      if (error) throw error;
      setItems((xs) => [...xs, data as Item]);
      return data as Item;
    },

    async markDone(item: Item, reply?: string) {
      const now = new Date().toISOString();
      if (item.repeat !== 'none') {
        // repeating: record the reply and roll forward to the next occurrence
        // Always move past the current occurrence — "Done" pressed early (7:50 for an 8:00 dose)
        // must not leave today's 8:00 alarm armed.
        const from = new Date(Math.max(Date.now(), new Date(item.due_at).getTime()));
        const next = nextOccurrence(item.due_at, item.repeat, from);
        const patch = { status: 'scheduled' as const, due_at: next, snooze_until: null, reply: reply ?? null, done_at: now };
        patchLocal(item.id, patch);
        await updateOrQueue(item.id, { ...patch, due_pushed_at: null });
      } else {
        const patch = { status: 'done' as const, reply: reply ?? null, done_at: now, snooze_until: null };
        patchLocal(item.id, patch);
        await updateOrQueue(item.id, patch);
      }
    },

    async snooze(item: Item, minutes = 10) {
      const until = new Date(Date.now() + minutes * 60_000).toISOString();
      patchLocal(item.id, { status: 'snoozed', snooze_until: until });
      await updateOrQueue(item.id, { status: 'snoozed', snooze_until: until, due_pushed_at: null });
    },

    async approve(item: Item, always: boolean) {
      patchLocal(item.id, { status: 'scheduled' });
      const { error } = await supabase.from('items').update({ status: 'scheduled' }).eq('id', item.id);
      if (error) throw error;
      if (always) {
        // "Always allow" = no more approval prompts. Loud alarms stay a separate choice in My people.
        setRules((rs) => rs.map((r) => (r.owner_id === userId && r.sender_id === item.sender_id ? { ...r, level: 'auto' } : r)));
        const { error: e2 } = await supabase.from('trust_rules')
          .update({ level: 'auto', updated_at: new Date().toISOString() })
          .eq('owner_id', userId).eq('sender_id', item.sender_id);
        if (e2) throw e2;
      }
    },

    async decline(item: Item) {
      patchLocal(item.id, { status: 'declined' });
      const { error } = await supabase.from('items').update({ status: 'declined' }).eq('id', item.id);
      if (error) throw error;
    },

    async cancel(item: Item) {
      patchLocal(item.id, { status: 'cancelled' });
      const { error } = await supabase.from('items').update({ status: 'cancelled' }).eq('id', item.id);
      if (error) throw error;
    },

    async restore(item: Item, status: Item['status']) {
      patchLocal(item.id, { status });
      const { error } = await supabase.from('items').update({ status }).eq('id', item.id);
      if (error) { await load(); throw error; }
    },

    async requestConnection(code: string) {
      const { error } = await supabase.rpc('request_connection', { code });
      if (error) throw error;
      await load();
    },

    async respondConnection(id: string, accept: boolean) {
      const { error } = await supabase.rpc('respond_connection', { cid: id, accept });
      if (error) throw error;
      await load();
    },

    async removePerson(otherId: string) {
      const { error } = await supabase.rpc('remove_connection', { other: otherId });
      if (error) throw error;
      await load();
    },

    async setRule(senderId: string, patch: Partial<Pick<TrustRule, 'level' | 'allow_alarms'>>) {
      setRules((rs) => rs.map((r) => (r.owner_id === userId && r.sender_id === senderId ? { ...r, ...patch } : r)));
      const { error } = await supabase.from('trust_rules')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('owner_id', userId).eq('sender_id', senderId);
      if (error) throw error;
    },
  }), [load, userId]);

  return { loaded, me, profiles, people, connections, rules, items, nameOf, ruleFor, actions };
}

export type SyncState = ReturnType<typeof useSync>;
