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

export function useSync(userId: string) {
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [rules, setRules] = useState<TrustRule[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
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
      if (i.data) setItems(i.data as Item[]);
      setLoaded(true);
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
        const next = nextOccurrence(item.due_at, item.repeat);
        const patch = { status: 'scheduled' as const, due_at: next, snooze_until: null, reply: reply ?? null, done_at: now };
        patchLocal(item.id, patch);
        const { error } = await supabase.from('items').update({ ...patch, due_pushed_at: null }).eq('id', item.id);
        if (error) throw error;
      } else {
        const patch = { status: 'done' as const, reply: reply ?? null, done_at: now, snooze_until: null };
        patchLocal(item.id, patch);
        const { error } = await supabase.from('items').update(patch).eq('id', item.id);
        if (error) throw error;
      }
    },

    async snooze(item: Item, minutes = 10) {
      const until = new Date(Date.now() + minutes * 60_000).toISOString();
      patchLocal(item.id, { status: 'snoozed', snooze_until: until });
      const { error } = await supabase.from('items')
        .update({ status: 'snoozed', snooze_until: until, due_pushed_at: null }).eq('id', item.id);
      if (error) throw error;
    },

    async approve(item: Item, always: boolean) {
      patchLocal(item.id, { status: 'scheduled' });
      const { error } = await supabase.from('items').update({ status: 'scheduled' }).eq('id', item.id);
      if (error) throw error;
      if (always) {
        await supabase.from('trust_rules')
          .update({ level: 'auto', allow_alarms: true, updated_at: new Date().toISOString() })
          .eq('owner_id', userId).eq('sender_id', item.sender_id);
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
      await supabase.from('items').update({ status }).eq('id', item.id);
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
