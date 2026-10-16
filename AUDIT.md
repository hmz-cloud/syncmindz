# SYNCMINDZ — UX, Accessibility & Launch-Readiness Audit

Audited: the AI Studio prototype (`sync-minds/`), October 2026.
Lens: older users (e.g. Amina), mobile one-handed use, Arabic speakers, and any trusted circle (spouses, kids, friends).

Severity: **P0** = blocks launch / safety risk · **P1** = real friction or WCAG failure · **P2** = polish.

---

## 1. Launch blockers (architecture)

| # | Finding | Why it matters | Fix in rebuild |
|---|---|---|---|
| P0-1 | All data is in `localStorage`; "sync" uses `BroadcastChannel`, which only reaches other tabs **in the same browser**. | Mom's phone and yours never exchange anything. The core promise does not work. | Supabase (Postgres + Auth + Realtime). `useSync.ts` loads and live-updates from the server. |
| P0-2 | Alarms fire from a `setInterval` inside the page. | A closed app, locked phone, or backgrounded tab = **no alarm**. For medication this is a safety issue. | Capacitor `LocalNotifications` mirrors every upcoming item into the phone's own scheduler (`alarms.ts → syncLocalAlarms`), with exact-alarm permission on Android. Server sends a backup push at ring time (`functions/dispatch`). |
| P0-3 | No accounts. A header dropdown lets anyone "become" any user. | No identity, no privacy. | Email + 6-digit code sign-in; RLS so each person only sees their own items and people. |
| P0-4 | Pairing by PIN instantly grants **full auto-accept with loud alarms**, one-way, with no consent from the other side. Six digits are guessable. | A stranger who guesses a code can make someone's phone ring loudly at 3 AM. | Code only sends a *request*; the other person must Accept. New links default to **"Ask me first"**. Loud alarms are a separate opt-in. |
| P0-5 | "Auto-accepted" is decided by the **sender's** client (`checkAutoAcceptPermission`). | Trust can be bypassed by anyone editing the client. | Decided by a database trigger from the **receiver's** rules (`items_before_insert`). Receivers can't edit content; senders can't fake a "Done". |
| P1-6 | Nothing happens when an alarm is ignored. | The caregiver never learns that Mom didn't take her medicine. | Server marks un-confirmed items **missed** after 30 min; sender sees "Not confirmed — maybe call Amina". |
| P1-7 | Unused `@google/genai`, `express`, `GEMINI_API_KEY`; demo seed data with real-looking emails. | Bundle bloat, secret-handling confusion, leftover personal data. | Removed. |

## 2. Cognitive friction (older and less-technical users)

| # | Before | Problem | After |
|---|---|---|---|
| P1-8 | "Autonomous Phone Alarm", "Trigger Intensity", "Arm on device", "Auto-Accept", "Calendar Slot", "Sub-Pulse". | Technical jargon; Amina has to translate every label. | Plain words: **Alarm** (loud, rings until Done) vs **Reminder** (one gentle sound). "Set on Amina's phone". "Waiting for Amina to accept". |
| P1-9 | Three item types; "Calendar" type behaves like a reminder. | Extra choice with no visible difference. | Two kinds only. Calendar view removed from v1. |
| P1-10 | Send form shows ~20 controls on one screen (recipient, title, 5 idea chips, note, 3 types, 3 time presets, datetime, sound select, test). | Overwhelming; easy to send the wrong thing. | 3 steps — **Who → What → When** — with "Step 2 of 3" in words, a Back button, and a plain-language summary before Send that says whether it will ask first. |
| P1-11 | Time set with `datetime-local` defaulting to "+15 min". | Tiny native picker, hard on older eyes; easy to send the wrong day. | Big presets (In 15 min / In 1 hour / Tonight 8:00 / Tomorrow 8:00) + separate Day and Time fields. Past times are rejected with a clear message. |
| P1-12 | Times shown as "in 3h" or raw times without day. | Relative time is ambiguous; "8:00" — today or tomorrow? | Always explicit: "Today 8:00 PM", "Tomorrow 8:00 AM", weekday + date otherwise. |
| P1-13 | Ringing screen: snooze and Done the same size, side by side; Done is only 14px text; reply chips 11px. | Mis-taps, and you have to read small text while an alarm is blaring. | Full screen. **Done is huge** (80px tall, 1.6rem) and at the bottom in thumb reach; snooze is clearly secondary. Replies optional and never block Done. "Read it to me" (Arabic / English speech). |
| P1-14 | Snooze 5 min fixed, label "Snooze (5m)". | Abbreviation; too short for someone walking to the kitchen. | "Remind me in 10 minutes". |
| P1-15 | Approve banner offers "approve & trust sender" as a primary path. | Pushes users to give away control without understanding it. | "Allow" / "No thanks" are the two main buttons; "Always allow Hassan" is secondary, and loud alarms still require the separate opt-in. |
| P2-16 | Toasts appear top-right for 4.5 s, no screen-reader announcement, no undo. | Missed by slow readers; destructive actions are final. | Bottom toast, 7 s, `aria-live`, **Undo** on cancel. |
| P2-17 | Header shows device names, PIN, test buttons, online dots. | Noise on every screen. | Removed. Code lives in "My people"; test alarm lives in Settings. |
| P2-18 | Same complexity for everyone. | One design can't serve a teen and an 80-year-old. | **Simple mode** (any user can switch it on): bigger targets, only today + next item, no optional fields. **Text size**: Normal / Large / Extra large. Default is Large. |

## 3. Accessibility (WCAG 2.2 AA)

| # | Issue | Criterion | Fix |
|---|---|---|---|
| P1-19 | Text at 10–11px (`text-[10px]`, `text-[11px]`) throughout; `text-slate-400` on white (~2.6:1). | 1.4.3 Contrast, 1.4.4 Resize | Base 17–22px in `rem`, scales with the setting. Secondary text `#44403c` (9.7:1). Brand teal on white 5.4:1. |
| P1-20 | Mobile tab labels 11px; preset chips ~24px tall. | 2.5.8 Target size | Every primary control ≥ 56px (64px in Simple mode). |
| P1-21 | Modals have no `role="dialog"`, no focus trap, no Escape, close button has no label. | 4.1.2, 2.1.2, 2.4.3 | `Sheet.tsx`: `role=dialog`, `aria-modal`, labelled title, focus trap, Escape, focus returned on close. Ringing uses `role=alertdialog`. |
| P1-22 | Trust state shown only by green/amber colour. | 1.4.1 Use of colour | Icon + words everywhere (e.g. shield + "Set on her phone right away"). |
| P1-23 | Inputs without associated `<label>`; selected state not exposed. | 1.3.1, 4.1.2 | Every input labelled; choice buttons use `aria-pressed`; nav uses `aria-current`; trust settings are real radio buttons. |
| P1-24 | No visible focus styles (`focus:outline-none`). | 2.4.7 Focus visible | 3px teal outline on `:focus-visible`. |
| P2-25 | `animate-ping`/bounce always on. | 2.3.3 Motion | Respects `prefers-reduced-motion`. |
| P2-26 | English-only, LTR-only. | Saudi market | Full Arabic + English, `dir="rtl"`, logical CSS (`ms-`, `text-start`), Arabic font (IBM Plex Sans Arabic), Gregorian dates in Arabic, digits isolated for codes. |

## 4. Mobile

- Notch / home-indicator safe areas (`viewport-fit=cover`, `env(safe-area-inset-*)`).
- Bottom nav: 3 labelled tabs + one wide labelled **"New reminder"** button instead of an unlabeled floating "+".
- Numeric keypad for codes (`inputMode="numeric"`, `autocomplete="one-time-code"` so iOS/Android can autofill the email code).
- Native share sheet for inviting (WhatsApp is how most families will send the code).
- App re-syncs when it returns to the foreground or the network comes back.

## 5. Known limits — be honest with users

1. **iPhone locked-screen alarms**: iOS plays a notification sound of up to 30 s, not a continuous alarm. A true alarm needs Apple's AlarmKit (iOS 26+) via a small native plugin, or the Critical Alerts entitlement (Apple approves this mainly for health apps — worth applying for, since medication reminders qualify well). Android rings continuously via the `alarms` channel.
2. **Arming on the receiver's phone**: if the receiver's phone is offline when an item is sent, it is armed the next time the app syncs (opening the app or the "new reminder" notification). The server's backup push at ring time covers most of this gap.
3. **Missed-alarm calls**: escalation is currently "show the sender". A phone call / SMS to the sender after a miss is a good v1.1 feature.
