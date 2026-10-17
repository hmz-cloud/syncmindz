// Headless two-person test: Amina (Arabic, phone) and Hassan (English, phone).
// sign in → pair by code → accept → send → allow → it rings → Done + reply → sender sees it.
// Runs against e2e/mock-supabase.mjs (no real accounts, no emails). Screenshots → e2e/shots/.
// Usage: node e2e/mock-supabase.mjs & VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=test npx vite --port 5174 &
//        node e2e/loop.mjs
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const APP = process.env.APP_URL || 'http://127.0.0.1:5174';
const MOCK = 'http://127.0.0.1:54321';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

// Read UI strings straight from the app's dictionary so the test follows copy changes.
const src = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const dict = (name) => {
  const start = src.indexOf(`const ${name}`);
  const body = src.slice(start, src.indexOf('\n}', start));
  const out = {};
  for (const m of body.matchAll(/'([\w.]+)':\s*(['"])((?:\\.|(?!\2).)*)\2/g)) out[m[1]] = m[3].replace(/\\'/g, "'");
  return out;
};
const D = { en: dict('en'), ar: dict('ar') };
const T = (lang, k, vars = {}) => D[lang][k].replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? ''));

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${info ? ' [' + info + ']' : ''}`); };
const state = async () => (await fetch(MOCK + '/__state')).json();
const sync = (page) => page.evaluate(() => window.dispatchEvent(new Event('online'))); // app re-syncs on "online"

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const phone = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['notifications'] };
const ctxA = await browser.newContext({ ...phone, locale: 'ar-SA' });
const ctxB = await browser.newContext({ ...phone, locale: 'en-GB' });
const A = await ctxA.newPage(); const B = await ctxB.newPage();
const errors = [];
for (const [who, p] of [['A', A], ['B', B]]) {
  p.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
  p.on('dialog', (d) => d.accept());
}
const shot = (p, name) => p.screenshot({ path: SHOTS + name + '.png' });

async function signIn(p, lang, email, name, prefix) {
  await p.goto(APP);
  await p.getByRole('button', { name: T(lang, 'auth.sendCode') }).waitFor();
  check(`${prefix}: sign-in screen in ${lang}`, (await p.evaluate(() => document.documentElement.lang)) === lang);
  await shot(p, `${prefix}-01-sign-in`);
  await p.fill('#email', email);
  await p.getByRole('button', { name: T(lang, 'auth.sendCode') }).click();
  await p.fill('#code', '123456');
  await shot(p, `${prefix}-02-code`);
  await p.getByRole('button', { name: T(lang, 'auth.verify'), exact: true }).click();
  await p.fill('#name', name);
  check(`${prefix}: name screen keeps ${lang}`, (await p.evaluate(() => document.documentElement.lang)) === lang);
  await p.getByRole('button', { name: T(lang, 'name.save') }).click();
  await p.getByRole('heading', { level: 1 }).waitFor();
  await p.waitForTimeout(400);
  await shot(p, `${prefix}-03-home-empty`);
}

try {
  await fetch(MOCK + '/__reset', { method: 'POST' });
  await signIn(A, 'ar', 'amina@example.invalid', 'أمينة', 'A');
  await signIn(B, 'en', 'hassan@example.invalid', 'Hassan', 'B');
  let s = await state();
  const pa = s.profiles.find((x) => x.display_name === 'أمينة');
  const pb = s.profiles.find((x) => x.display_name === 'Hassan');
  check('languages saved per person', pa.language === 'ar' && pb.language === 'en', `${pa.language}/${pb.language}`);

  // Hassan adds Amina by her code
  await B.getByRole('button', { name: T('en', 'nav.people') }).click();
  await B.fill('#code', pa.invite_code);
  await B.getByRole('button', { name: T('en', 'people.add') }).click();
  await B.waitForTimeout(500);
  await shot(B, 'B-04-request-sent');

  // Amina accepts
  await A.getByRole('button', { name: T('ar', 'nav.people') }).click();
  await sync(A);
  await A.getByRole('button', { name: T('ar', 'people.accept') }).waitFor();
  await shot(A, 'A-04-request-incoming');
  await A.getByRole('button', { name: T('ar', 'people.accept') }).click();
  await A.waitForTimeout(500);
  await shot(A, 'A-05-people');
  s = await state();
  check('pairing accepted', s.connections[0]?.status === 'accepted');

  // Hassan sends "Take your medicine" in 1 minute, daily
  await sync(B);
  await B.getByRole('button', { name: T('en', 'nav.new') }).click();
  const sheet = B.getByRole('dialog');
  await sheet.getByRole('button', { name: /أمينة/ }).click();
  await sheet.getByRole('button', { name: T('en', 'send.next') }).click();
  await sheet.getByRole('button', { name: T('en', 'idea.meds') }).click();
  await sheet.getByRole('button', { name: T('en', 'send.next') }).click();
  await sheet.getByRole('button', { name: T('en', 'send.whenIn1') }).click();
  await sheet.getByRole('button', { name: T('en', 'send.repeatDaily') }).click();
  await shot(B, 'B-05-send-summary');
  await sheet.getByRole('button', { name: T('en', 'send.send'), exact: true }).click();
  await B.waitForTimeout(600);
  await shot(B, 'B-06-sent-waiting');
  s = await state();
  check('item arrives as "waiting for OK"', s.items[0]?.status === 'pending', s.items[0]?.status);
  check('quick idea written in Amina\'s language', s.items[0]?.title === T('ar', 'idea.meds'), s.items[0]?.title);

  // Amina allows it
  await A.getByRole('button', { name: T('ar', 'nav.home') }).click();
  await sync(A);
  await A.getByRole('button', { name: T('ar', 'approve.allow'), exact: true }).waitFor();
  await shot(A, 'A-06-approval');
  await A.getByRole('button', { name: T('ar', 'approve.allow'), exact: true }).click();
  await A.waitForTimeout(500);
  await shot(A, 'A-07-scheduled');
  s = await state();
  check('allowed → scheduled', s.items[0]?.status === 'scheduled');

  // Time passes: move it to "due now" → the ringing screen appears
  await fetch(MOCK + '/__age', { method: 'POST', body: JSON.stringify({ title: T('ar', 'idea.meds'), minutes: 1.1 }) });
  await sync(A);
  const dialog = A.getByRole('alertdialog');
  await dialog.waitFor({ timeout: 10000 });
  check('it rings on Amina\'s phone', await dialog.isVisible());
  await shot(A, 'A-08-ringing');
  const replyBtn = dialog.locator('fieldset button').first();
  const reply = (await replyBtn.innerText()).trim();
  await replyBtn.click();
  await dialog.getByRole('button', { name: T('ar', 'ring.done'), exact: true }).click();
  await A.waitForTimeout(600);
  await shot(A, 'A-09-after-done');
  s = await state();
  const it = s.items[0];
  check('Done recorded with reply', !!it.done_at && it.reply === reply, `reply=${it.reply}`);

  // Hassan sees Done + reply
  await B.getByRole('button', { name: T('en', 'nav.home') }).click();
  await sync(B);
  await B.getByText(reply).first().waitFor({ timeout: 5000 });
  check('Hassan sees the reply', true, reply);
  await shot(B, 'B-07-sees-done');

  // Repeat check: Amina presses Done EARLY on a daily item (QA P1 fix) → it must move to tomorrow
  const before = (await state()).items[0];
  // before = already rolled to next day by Done above (daily). Press Done again early on the big card:
  await sync(A);
  const done = A.getByRole('button', { name: T('ar', 'item.markDone'), exact: true }).first();
  if (await done.count()) {
    await done.click(); await A.waitForTimeout(500);
    const after = (await state()).items[0];
    check('Done pressed early moves a daily reminder forward', Date.parse(after.due_at) > Date.parse(before.due_at),
      `${before.due_at} → ${after.due_at}`);
  } else check('Done pressed early moves a daily reminder forward', false, 'no Done button');

  // Larger text + Arabic on the smallest phone: no sideways scrolling
  await A.getByRole('button', { name: T('ar', 'nav.settings') }).click();
  await A.getByRole('button', { name: T('ar', 'settings.text.xlarge') }).click();
  await A.waitForTimeout(300);
  await shot(A, 'A-10-settings-xlarge');
  for (const tab of ['nav.home', 'nav.people']) {
    await A.getByRole('button', { name: T('ar', tab) }).click(); await A.waitForTimeout(200);
    const w = await A.evaluate(() => document.documentElement.scrollWidth);
    check(`no sideways scroll (${tab}, xlarge, 375px)`, w <= 375, `width ${w}`);
  }
  await shot(A, 'A-11-people-xlarge');
} catch (e) {
  check('script ran to the end', false, e.message.split('\n').slice(0, 4).join(' / '));
  await shot(A, 'zz-A-failure').catch(() => {}); await shot(B, 'zz-B-failure').catch(() => {});
}
check('no JavaScript errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
