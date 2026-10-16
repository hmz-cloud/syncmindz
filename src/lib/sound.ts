// In-app ringing sound (used while the app is open). On a locked phone the
// OS plays the notification sound instead — see alarms.ts.
let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* no audio */ }
}

function beep(at: number, freq: number, len: number, vol: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, at + len);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + len + 0.05);
}

/** Loud alarm repeats until stopped; gentle reminder plays once. Returns a stop function. */
export function startRinging(kind: 'alarm' | 'reminder'): () => void {
  unlockAudio();
  if (!ctx) return () => {};
  const play = () => {
    const t = ctx!.currentTime;
    if (kind === 'alarm') {
      [0, 0.25, 0.5].forEach((d) => beep(t + d, 880, 0.2, 0.6));
    } else {
      beep(t, 660, 0.6, 0.35);
      beep(t + 0.35, 880, 0.8, 0.3);
    }
  };
  play();
  if (kind === 'reminder') return () => {};
  const id = window.setInterval(play, 1500);
  navigator.vibrate?.([400, 200, 400]);
  const vib = window.setInterval(() => navigator.vibrate?.([400, 200, 400]), 1500);
  return () => {
    clearInterval(id);
    clearInterval(vib);
    navigator.vibrate?.(0);
  };
}

/** Reads the reminder out loud — helpful for low vision or reading difficulty. */
export function speak(text: string, lang: 'ar' | 'en') {
  if (!('speechSynthesis' in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return true;
}
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
