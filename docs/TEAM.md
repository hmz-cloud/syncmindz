# SyncMindz build team — operating manual

Owner: **Hassan** (PICKSIL). Goal: SyncMindz ready to go live — trusted people (parents, spouses, kids, friends) share reminders and alarms that ring on each other's phones. Key user: older Arabic-speaking parent ("Amina").

Each daily run starts with no memory. **Read this file and the latest report in `docs/reports/` first.**

## Team (spawn as subagents when the day's work needs them)
| Role | Owns | Rule |
|---|---|---|
| Lead engineer (the main session) | Plan, `src/`, merges, Supabase changes, the daily report | Applies fixes; never ships without typecheck + build passing |
| QA & accessibility reviewer | Review only — never edits | Finds concrete bugs/WCAG issues with file:line + exact fix |
| Mobile engineer | `android/`, `ios/`, `capacitor.config.ts`, native docs | Never touches `src/` or `supabase/` |
| Backend engineer | `supabase/` (migrations, edge functions) | Every change tested in a rolled-back transaction before/after applying |
| Product & copy | Arabic/English strings, store listing, policy drafts | Plain words; gender-neutral Arabic |

## Systems
- GitHub: `hmz-cloud/syncmindz`, work on branch **`rebuild`** (`main` is the old AI Studio prototype — do not touch).
- Supabase project **SyncMindz** (`mphdofvlywwnqqmfxamh`, org PKSL, ap-south-1). Never touch project `FL-Pro` (FleetOps).
  - Supabase blocks migrations containing `DELETE`; use soft-ending (`ended_at`) instead.
  - Keep `supabase/migrations/` identical to what is live: add a new numbered file for every change applied.
  - Test SQL as real users: `begin; ... set local role authenticated; select set_config('request.jwt.claims', ...); ... rollback;` — always roll back test data.
- Build checks: `npm install && npx tsc --noEmit && npm run build && npx cap sync`.

## Never without Hassan's explicit yes in chat
Publishing/deploying anything public (Vercel, Netlify, app stores), buying anything, creating accounts, sending messages/emails to anyone, changing Supabase auth/email settings, deleting data, merging into `main`.
If a step needs one of these, prepare everything up to it and list it under **"Needs Hassan"** in the report.

## Week plan (Fri 16 – Thu 22 Oct 2026)
| Day | Focus | Done when |
|---|---|---|
| Fri 16 | Live database, QA round 1, native projects | ✅ done — see report |
| Sat 17 | P2 polish from QA round 1; real sign-in test against live Supabase (2 test accounts, full send → accept → ring → Done loop in a headless browser, Arabic + English); screenshots | Loop works end to end; screenshots in report |
| Sun 18 | Push notifications: finish `dispatch` edge function, deploy it (needs Firebase from Hassan — if missing, prepare + document); `pg_net` + cron wiring | Function deployed or ready-to-deploy with exact steps |
| Mon 19 | QA round 2 (fresh reviewer, full app, both languages, smallest phone size, screen reader pass on markup) and fixes | No open P0/P1 |
| Tue 20 | Abuse & trust: rate-limit pairing codes, account deletion (store requirement), privacy policy + terms drafts (AR/EN, PDPL-aware), store listing copy | Drafts in `docs/`, rate limit live + tested |
| Wed 21 | Android test build: GitHub Actions workflow that builds a debug APK on every push to `rebuild` | Workflow committed (runs once Hassan approves Actions) |
| Thu 22 | Final review: launch-readiness verdict, remaining blockers, what Hassan must do to ship | Final report |

## Daily report format (`docs/reports/YYYY-MM-DD.md`, also sent to Hassan)
1. **Status:** one line — on track / at risk / blocked.
2. **Done today:** what changed, verified how.
3. **Found:** new bugs or risks (with severity).
4. **Needs Hassan:** decisions or actions only he can take (short, numbered).
5. **Tomorrow:** the next day's plan.
Keep it short and plain. No jargon.
