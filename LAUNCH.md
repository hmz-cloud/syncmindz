# SYNCMINDZ — Launch guide

## 1. Supabase (≈15 min)
1. Create a project (region: closest to Saudi users, e.g. Frankfurt or Mumbai).
2. SQL editor → run `supabase/migrations/0001_init.sql`.
3. Database → Extensions → enable **pg_cron** and **pg_net**, then run the two `cron.schedule(...)` lines at the bottom of the migration with your project ref and service-role key.
4. Authentication → Providers → Email: on. Authentication → Email templates → "Magic Link": replace the link with the code, e.g. `Your SyncMindz code: {{ .Token }}` (Arabic + English text).
5. Authentication → SMTP: set a real sender (Resend, Postmark, SES). The built-in sender is rate-limited and not for production.
6. Copy URL + publishable key into `.env` (see `.env.example`).

## 2. Push (Firebase Cloud Messaging)
1. Create a Firebase project; add an Android app `com.picksil.syncmindz` and an iOS app with the same bundle id.
2. Download `google-services.json` → `android/app/`. `GoogleService-Info.plist` → `ios/App/App/`. Upload your APNs key in Firebase.
3. Service accounts → generate key → set it as an edge-function secret: `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat key.json)"`.
4. `supabase functions deploy dispatch --no-verify-jwt`.

## 3. Native apps
```bash
npm install
npx cap add android
npx cap add ios
npm run android   # opens Android Studio
npm run ios       # opens Xcode
```
Android:
- Put an alarm sound at `android/app/src/main/res/raw/alarm.wav` and a white notification icon `ic_stat_syncmindz`.
- `AndroidManifest.xml`: add `SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`.
- Google Play requires a short justification for exact alarms ("alarm clock / reminder app" qualifies).

iOS:
- Add `alarm.caf` (≤30 s) to the app bundle.
- Capabilities: Push Notifications, Background Modes → Remote notifications, Time Sensitive Notifications.
- Apply for the **Critical Alerts** entitlement (explain: medication reminders sent by family caregivers).

## 4. Before going live
- [ ] Test with two real phones: send → accept → lock phone → it rings → Done → sender sees "Done" + reply.
- [ ] Test with the phone on silent / Do Not Disturb (Android alarm channel should still sound).
- [ ] Test Arabic + Extra-large text on a small phone (iPhone SE size).
- [ ] TalkBack (Android) and VoiceOver (iOS) pass through sign-in, send, and ringing.
- [ ] Privacy policy + terms (Arabic + English) — required by both stores; mention health-related reminders and PDPL (Saudi data protection).
- [ ] Rate-limit `request_connection` (e.g. 10 per hour per user) to stop code-guessing — add via an edge function or a counter table.
- [ ] Run Supabase "Advisors" (security + performance) and fix anything flagged.

## 5. Web version
`npm run build` → deploy `dist/` (Vercel / Netlify). The web app works for sending and managing, but alarms only ring while the page is open — tell web users to install the phone app for reliable alarms.
