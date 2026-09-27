import { AlarmSound } from '../types';

let audioCtx: AudioContext | null = null;
let activeLoopInterval: number | null = null;
let isAudioUnlocked = false;

export function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  isAudioUnlocked = true;
  return audioCtx;
}

export function isAudioEngineReady(): boolean {
  return isAudioUnlocked && audioCtx !== null && audioCtx.state === 'running';
}

export function playSingleBeep(freq = 880, duration = 0.2, type: OscillatorType = 'sine', volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn('Audio playback not permitted yet or failed:', err);
  }
}

export function playSoundSample(sound: AlarmSound, volume = 0.75) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    switch (sound) {
      case 'radar': {
        // Dual energetic beep (classic phone alarm)
        [880, 1108].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = f;
          const start = now + i * 0.14;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(volume * 0.85, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.12);
        });
        break;
      }
      case 'chime': {
        // 3 harmonic notes C5 - E5 - G5 (friendly reminder chime)
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const start = now + idx * 0.13;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(volume * 0.8, start + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.8);
        });
        break;
      }
      case 'pulse': {
        // Energetic sub-pulse
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.28);
        gain.gain.setValueAtTime(volume * 0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
        break;
      }
      case 'siren': {
        // Urgent wake-up sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.25);
        osc.frequency.linearRampToValueAtTime(650, now + 0.5);
        gain.gain.setValueAtTime(volume * 0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.55);
        break;
      }
      case 'zen': {
        // Peaceful bowl harmonic
        const freqs = [440, 880, 1320];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const amp = (volume * 0.6) / (idx + 1);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(amp, now + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.00001, now + 1.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.2);
        });
        break;
      }
    }
  } catch (err) {
    console.warn('Error playing audio sample:', err);
  }
}

export function startAlarmLoop(sound: AlarmSound, volume = 0.85): () => void {
  stopAlarmLoop();

  // Play first immediately
  playSoundSample(sound, volume);

  const intervalMap: Record<AlarmSound, number> = {
    radar: 950,
    chime: 1600,
    pulse: 800,
    siren: 1000,
    zen: 2000,
  };

  const intervalMs = intervalMap[sound] || 1200;

  activeLoopInterval = window.setInterval(() => {
    playSoundSample(sound, volume);
  }, intervalMs);

  return stopAlarmLoop;
}

export function stopAlarmLoop() {
  if (activeLoopInterval !== null) {
    clearInterval(activeLoopInterval);
    activeLoopInterval = null;
  }
}
