# SyncMindz · سينك مايندز

Share reminders and alarms with the people you trust — parents, partners, kids, friends.

- **React 19 + TypeScript + Tailwind 4**, packaged as Android/iOS apps with **Capacitor**
- **Supabase** for accounts, data, live sync, and server-side trust rules
- **Arabic + English** with full RTL, adjustable text size, and a Simple mode

```bash
cp .env.example .env   # add your Supabase URL + publishable key
npm install
npm run dev
```

- `AUDIT.md` — what was wrong with the prototype and how each issue was fixed
- `LAUNCH.md` — step-by-step to production (Supabase, push, app stores)

## Structure
```
supabase/migrations/0001_init.sql   tables, security rules, pairing, missed-alarm job
supabase/functions/dispatch/        push notifications (new item + backup ring)
src/lib/alarms.ts                   phone-level alarm scheduling (works with app closed)
src/lib/i18n.tsx                    Arabic / English strings
src/hooks/useSync.ts                data + live updates + actions
src/components/                     screens (Home, Send, Ringing, People, Settings)
```
