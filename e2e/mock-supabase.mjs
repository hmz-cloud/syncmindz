// A tiny in-memory stand-in for Supabase (auth + the REST calls SyncMindz makes), used only
// for headless UI tests. It mirrors the server rules in supabase/migrations closely enough to
// drive the UI; the real rules are tested separately against the live database
// (supabase/tests/loop_test.sql). Sign-in code is always 123456. No emails are sent.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.MOCK_PORT || 54321);
const db = { users: [], profiles: [], connections: [], trust_rules: [], items: [] };
const now = () => new Date().toISOString();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-' + user.id, user };
}
function uidFrom(req) {
  const h = req.headers.authorization || '';
  const tok = h.replace(/^Bearer /, '');
  try { return JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).sub ?? null; } catch { return null; }
}
const connected = (a, b) => a === b || db.connections.some((c) => c.status === 'accepted' && !c.ended_at
  && ((c.requester_id === a && c.addressee_id === b) || (c.requester_id === b && c.addressee_id === a)));

function visible(table, me) {
  if (!me) return [];
  switch (table) {
    case 'profiles': return db.profiles.filter((p) => p.id === me || db.connections.some((c) => !c.ended_at
      && ((c.requester_id === me && c.addressee_id === p.id) || (c.addressee_id === me && c.requester_id === p.id))));
    case 'connections': return db.connections.filter((c) => c.requester_id === me || c.addressee_id === me);
    case 'trust_rules': return db.trust_rules.filter((r) => r.owner_id === me || r.sender_id === me);
    case 'items': return db.items.filter((i) => i.sender_id === me || i.receiver_id === me);
    case 'push_tokens': return [];
    default: return [];
  }
}

// PostgREST filter subset: eq, is, in, gte, or=(...)
function cond(col, expr) {
  const [op, ...rest] = expr.split('.');
  const v = rest.join('.');
  return (row) => {
    const x = row[col];
    if (op === 'eq') return String(x) === v;
    if (op === 'is') return v === 'null' ? x == null : String(x) === v;
    if (op === 'in') return v.replace(/^\(|\)$/g, '').split(',').includes(String(x));
    if (op === 'gte') return x != null && String(x) >= v;
    return true;
  };
}
function filtersFrom(params) {
  const fs = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(k)) continue;
    if (k === 'or') {
      const inner = v.replace(/^\(|\)$/g, '');
      const parts = inner.split(/,(?![^()]*\))/).map((p) => { const [c, ...e] = p.split('.'); return cond(c, e.join('.')); });
      fs.push((row) => parts.some((f) => f(row)));
    } else fs.push(cond(k, v));
  }
  return (row) => fs.every((f) => f(row));
}

const err = (res, status, message) => send(res, status, { message, code: 'P0001', details: null, hint: null });
function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*',
    'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function itemInsert(me, n) {
  if (!connected(me, n.receiver_id)) throw new Error('not_connected');
  const it = { id: randomUUID(), sender_id: me, receiver_id: n.receiver_id, kind: n.kind, title: n.title, note: n.note ?? null,
    due_at: n.due_at, repeat: n.repeat ?? 'none', status: 'pending', snooze_until: null, reply: null, done_at: null,
    created_at: now(), updated_at: now() };
  if (me === n.receiver_id) it.status = 'scheduled';
  else {
    const r = db.trust_rules.find((x) => x.owner_id === n.receiver_id && x.sender_id === me);
    if (r?.level === 'blocked') throw new Error('blocked');
    if (r?.level === 'auto' && (n.kind === 'reminder' || r.allow_alarms)) it.status = 'scheduled';
  }
  db.items.push(it);
  return it;
}
function itemUpdate(me, old, patch) {
  const next = { ...old, ...patch, updated_at: now() };
  if (me === old.receiver_id && me !== old.sender_id) {
    for (const k of ['title', 'note', 'kind', 'receiver_id', 'sender_id']) if (k in patch && patch[k] !== old[k]) throw new Error('receiver cannot edit content');
    if (!['scheduled', 'snoozed', 'done', 'declined', 'missed'].includes(next.status)) throw new Error('invalid status for receiver');
  } else if (me === old.sender_id && me !== old.receiver_id) {
    for (const k of ['reply', 'done_at', 'snooze_until']) if (k in patch && patch[k] !== old[k]) throw new Error('sender cannot answer for receiver');
    const undo = old.status === 'cancelled' && ['pending', 'scheduled', 'snoozed'].includes(next.status) && connected(old.sender_id, old.receiver_id);
    if (![old.status, 'cancelled'].includes(next.status) && !undo) throw new Error('sender can only cancel');
  }
  delete next.due_pushed_at;
  Object.assign(old, next);
  return old;
}

const rpc = {
  request_connection(me, { code }) {
    const p = db.profiles.find((x) => x.invite_code === String(code).trim());
    if (!p) throw new Error('code_not_found');
    if (p.id === me) throw new Error('own_code');
    const ex = db.connections.find((c) => (c.requester_id === me && c.addressee_id === p.id) || (c.requester_id === p.id && c.addressee_id === me));
    if (ex && !ex.ended_at) return null;
    if (ex) Object.assign(ex, { requester_id: me, addressee_id: p.id, status: 'pending', ended_at: null, created_at: now() });
    else db.connections.push({ id: randomUUID(), requester_id: me, addressee_id: p.id, status: 'pending', ended_at: null, created_at: now() });
    return null;
  },
  respond_connection(me, { cid, accept }) {
    const c = db.connections.find((x) => x.id === cid && x.addressee_id === me && x.status === 'pending' && !x.ended_at);
    if (!c) throw new Error('not_found');
    if (!accept) { c.ended_at = now(); return null; }
    c.status = 'accepted';
    for (const [o, s] of [[c.requester_id, c.addressee_id], [c.addressee_id, c.requester_id]]) {
      if (!db.trust_rules.some((r) => r.owner_id === o && r.sender_id === s))
        db.trust_rules.push({ owner_id: o, sender_id: s, level: 'ask', allow_alarms: true, updated_at: now() });
    }
    return null;
  },
  remove_connection(me, { other }) {
    for (const c of db.connections) if (!c.ended_at && ((c.requester_id === me && c.addressee_id === other) || (c.requester_id === other && c.addressee_id === me))) c.ended_at = now();
    for (const i of db.items) if (['pending', 'scheduled', 'snoozed'].includes(i.status) && ((i.sender_id === me && i.receiver_id === other) || (i.sender_id === other && i.receiver_id === me))) i.status = 'cancelled';
    return null;
  },
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, 'http://x');
  let body = '';
  for await (const ch of req) body += ch;
  const json = body ? JSON.parse(body) : {};
  const me = uidFrom(req);

  // test helpers
  if (url.pathname === '/__state') return send(res, 200, db);
  if (url.pathname === '/__reset') { for (const k of Object.keys(db)) db[k] = []; return send(res, 200, {}); }
  if (url.pathname === '/__age') { // move an item's time back (simulate waiting) — body {title, minutes}
    for (const i of db.items) if (i.title === json.title) i.due_at = new Date(Date.parse(i.due_at) - json.minutes * 60000).toISOString();
    return send(res, 200, {});
  }

  // auth
  if (url.pathname === '/auth/v1/otp') return send(res, 200, {});
  if (url.pathname === '/auth/v1/verify') {
    if (json.token !== '123456') return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    let u = db.users.find((x) => x.email === json.email);
    if (!u) {
      u = { id: randomUUID(), aud: 'authenticated', role: 'authenticated', email: json.email, app_metadata: {}, user_metadata: {}, created_at: now() };
      db.users.push(u);
      db.profiles.push({ id: u.id, display_name: '', avatar_color: '#0f766e', language: 'ar', simple_mode: false, text_scale: 'large',
        invite_code: String(100000 + db.profiles.length * 111111).slice(0, 6), created_at: now() });
    }
    return send(res, 200, session(u));
  }
  if (url.pathname === '/auth/v1/user') { const u = db.users.find((x) => x.id === me); return u ? send(res, 200, u) : send(res, 401, { msg: 'no user' }); }
  if (url.pathname === '/auth/v1/token') { const u = db.users.find((x) => 'r-' + x.id === json.refresh_token); return u ? send(res, 200, session(u)) : send(res, 400, { msg: 'bad' }); }
  if (url.pathname === '/auth/v1/logout') return send(res, 204);

  // rpc
  const m = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (m) {
    try { return send(res, 200, rpc[m[1]](me, json)); } catch (e) { return err(res, 400, e.message); }
  }

  // tables
  const t = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (t) {
    const table = t[1];
    const single = (req.headers.accept || '').includes('vnd.pgrst.object');
    const wantRows = (req.headers.prefer || '').includes('return=representation');
    try {
      if (req.method === 'GET') {
        let rows = visible(table, me).filter(filtersFrom(url.searchParams));
        const order = url.searchParams.get('order');
        if (order) { const [c, dir] = order.split('.'); rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : -1) * (dir === 'desc' ? -1 : 1)); }
        const limit = url.searchParams.get('limit'); if (limit) rows = rows.slice(0, Number(limit));
        return send(res, 200, single ? rows[0] : rows);
      }
      if (req.method === 'PATCH') {
        const rows = visible(table, me).filter(filtersFrom(url.searchParams));
        const out = [];
        for (const r of rows) {
          if (table === 'items') out.push(itemUpdate(me, r, json));
          else if (table === 'profiles') { if (r.id !== me) continue; Object.assign(r, json); out.push(r); }
          else if (table === 'trust_rules') { if (r.owner_id !== me) continue; Object.assign(r, json); out.push(r); }
        }
        return send(res, 200, wantRows ? (single ? out[0] : out) : undefined);
      }
      if (req.method === 'POST') {
        if (table === 'push_tokens') return send(res, 201, undefined);
        if (table !== 'items') return err(res, 403, 'not allowed');
        const list = Array.isArray(json) ? json : [json];
        const out = list.map((n) => itemInsert(me, n));
        return send(res, 201, wantRows ? (single ? out[0] : out) : undefined);
      }
    } catch (e) { return err(res, 400, e.message); }
  }
  send(res, 404, { message: 'not mocked: ' + req.method + ' ' + url.pathname });
});
server.listen(PORT, () => console.log('mock supabase on', PORT));
