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
**Already done (in repo):** `android/` and `ios/` generated with Capacitor 7 and synced.
- Android: app name "SyncMindz", RTL on, permissions `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `USE_FULL_SCREEN_INTENT`, `WAKE_LOCK`.
- Alarm sound `android/app/src/main/res/raw/alarm.wav` (8 s, 3-beep; regenerate with `python3 scripts/make-alarm-sound.py`).
- White bell notification icon `res/drawable/ic_stat_syncmindz.xml`.
- `ios/App/App/alarm.wav` copied in (not yet added to the Xcode target).

**You still must do (on your Mac/PC):**
```bash
npm install
npm run android   # builds web, syncs, opens Android Studio
npm run ios       # on a Mac: cd ios/App && pod install first, then opens Xcode
```
Android:
- Download `google-services.json` from Firebase → `android/app/google-services.json`.
- Create an upload keystore and configure signing (Build → Generate Signed Bundle) — keep the keystore safe.
- Play Console: declare exact-alarm use (reminder app sent by family qualifies) and full-screen intent use.

iOS:
- `pod install` in `ios/App` (CocoaPods was not available on the build machine).
- In Xcode, drag `App/alarm.wav` into the App target (Copy Bundle Resources). Optional: `afconvert -f caff -d LEI16 alarm.wav alarm.caf` (must be ≤30 s; then point `sound` at `alarm.caf`).
- Signing & Capabilities: set your Team; add Push Notifications, Background Modes → Remote notifications, Time Sensitive Notifications.
- Create an APNs key (.p8) in the Apple Developer portal and upload it to Firebase Cloud Messaging.
- Apply for the **Critical Alerts** entitlement (explain: medication reminders sent by family caregivers); add it to the entitlements once approved.

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
