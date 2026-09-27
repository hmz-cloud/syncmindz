# Implementation Plan: Sync Minds MVP

## Executive Overview
**Sync Minds** solves the ubiquitous human error of forgotten reminders, skipped medications, and missed commitments. When a trusted partner, parent, doctor, or study buddy sends a trigger to your phone, it **auto-accepts and rings out loud autonomously on your device** without manual confirmation.

Based on user feedback:
1. **Visual Style**: Minimalist card-based dashboard with focus on quick actions (clean daylight aesthetics, generous whitespace, zero cognitive clutter).
2. **Autonomous Triggering**: Auto-ringing audio alarm with a full lockscreen overlay, Web Audio continuous synthesis, and browser notification alerts.
3. **Connection Model**: Hybrid model supporting both instant 1-tap invite link sharing, 6-digit pairing PINs, and quick contact search.

---

## Specialized Engineering Team Roles

- **Lead Product Architect & UX Specialist**: Streamlines customer workflows into 3 intuitive tabs, removes technical telemetry, and enforces touch-friendly mobile layouts.
- **Frontend & Audio Systems Engineer**: Hardens Web Audio API synthesis engine (Radar, Chime, Sub-Pulse, Emergency Siren, Zen Bowl), handles background audio unlocking, and manages the continuous ringing loop.
- **Mesh State & Device Sync Engineer**: Enhances persistent `localStorage` and `BroadcastChannel` real-time mesh for cross-tab multi-device simulation, pairing codes, and auto-accept rule validation.
- **QA & Reliability Engineer**: Implements 1-click test alarms (5s and 10s), verification tests, and audio device diagnostics.

---

## User Review Required

> [!IMPORTANT]
> - **Connection Method**: We are implementing a hybrid pairing system: users can share a 1-tap invite link, enter a 6-digit sync PIN, or pick from quick family/classmate presets.
> - **Autonomous Alarms**: Web browsers require at least one user interaction before playing audio. We will include a one-time "Arm Phone Audio" permission banner so the alarms are guaranteed to ring loudly when triggered in the background.

---

## Key Workflows & Proposed Architecture

### 1. Minimalist Card-Based Dashboard (`RemindersAlarmsView.tsx`)
- **Quick Send Bar**: Floating or top-anchored action bar with 1-tap contact avatars (*Send to Sarah*, *Send to Mom*, *Send to Omar*).
- **Active Trigger Cards**:
  - Clear typography: Scheduled time in large bold tabular font (`08:00 AM`), relative countdown badge (`In 15m` / `Due now`), and category chip (`Medication`, `Exam`, `Family`).
  - Sender attribution: *"⚡ Pushed by Sarah (Auto-Accepted)"*.
  - Inline controls: **Test Ring Tone** (speaker icon) and **Acknowledge / Done** (checkmark).
- **Segmented Filter**: Quick pill toggle between *My Phone Triggers*, *Sent by Me*, and *All*.

### 2. Hybrid Mind Pairing & Connection Hub (`TrustedCircleView.tsx`)
- **1-Tap Pairing Link**: Generates a shareable URL (`https://.../?sync_code=MIND-7492`) that auto-adds and arms the relationship when opened.
- **6-Digit Pairing PIN**: Simple numeric code for quick pairing across phones or laptops without typing long emails.
- **Trust Level Switch**: Clean iOS-style toggle (`Auto-Accept ON` / `Ask First`) with plain-English explanation:
  - *When ON*: Alarms and reminders sent by this person ring immediately on your phone without waiting for you to accept.

### 3. Streamlined 3-Step "Send Trigger" Modal (`SendItemModal.tsx`)
- **Step 1 (Who)**: Tap avatar or search contact. Dynamic badge confirms: *"✓ Auto-Accept is enabled. This will ring directly on their phone."*
- **Step 2 (What)**: Title with 1-tap quick presets (*"Take Blood Pressure Meds"*, *"Leave now"*, *"Wake up for exam"*, *"Drink water"*).
- **Step 3 (When & Tone)**: Quick chips (*⚡ Test in 10s*, *+15m*, *Tomorrow 8:00 AM*) + Sound picker with immediate preview.
- **Action**: Large prominent button: *"Send & Arm on [Name]'s Phone"*.

### 4. Lockscreen Ringing Takeover (`RingingOverlay.tsx`)
- Ambient frosted glass overlay with pulsing radar wave feedback.
- Prominent sender card: *"Sarah Chen sent an alarm to your phone"*.
- **I'm Done / Turn Off**: Large primary action that silences the audio synthesis and marks the item complete.
- **Snooze 5 Min**: Delays the alarm by 5 minutes.
- **1-Tap Feedback Notes**: Quick buttons to notify the sender back (*"Done! Thanks ❤️"*, *"Awake & on it!"*).

### 5. Multi-Profile Live Simulator (`Header.tsx` & `App.tsx`)
- Top-bar profile switcher (*Hassan's Pixel 9 Pro*, *Sarah's iPhone 16*, *Mom's Galaxy*, *Alex's Laptop*) allowing immediate testing of peer triggers.
- **"Try 5s Alarm"**: 1-click test button in the header that schedules an alarm 5 seconds ahead so anyone can test the auto-accept and audio engine in seconds.

---

## Step-by-Step Implementation Sequence

1. **Refine Data Models & Storage Service (`src/services/storageService.ts`, `src/types/index.ts`)**:
   - Add support for 6-digit sync pairing codes (`syncCode`) and invite links.
   - Refine seed contacts (Hassan, Sarah, Mom, Omar, Alex).
2. **Harden Web Audio Synthesizer (`src/services/audioService.ts`)**:
   - Ensure audio context auto-resumes smoothly on first tap.
   - Fine-tune 5 rich sound profiles (Radar, Harmonic Chime, Sub-Pulse, Siren, Zen Bowl).
3. **Upgrade Send Modal (`src/components/SendItemModal.tsx`)**:
   - Polish 3-step card workflow with quick-idea chips and instant sound test.
4. **Upgrade Trusted Circle (`src/components/TrustedCircleView.tsx`)**:
   - Add 6-digit PIN generator/input modal and 1-tap shareable link copy.
   - Simplified trust cards with direct "Send Trigger" shortcuts.
5. **Upgrade Alarms & Reminders Dashboard (`src/components/RemindersAlarmsView.tsx`)**:
   - Implement minimalist card styling, tabular countdown numbers, and 1-tap sound preview.
6. **Polish Ringing Overlay (`src/components/RingingOverlay.tsx`)**:
   - Add ambient glowing rings, high-contrast buttons, and sender feedback notes.
7. **Verification & Testing (`compile_applet`, `lint_applet`)**:
   - Verify build bundles, zero TypeScript/lint errors, and responsive mobile behavior.
