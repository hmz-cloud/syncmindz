#!/usr/bin/env python3
"""Synthesize SyncMindz alarm: repeating 3-beep pattern, ~8s, 44.1kHz mono 16-bit.
Usage: python3 scripts/make-alarm-sound.py [out.wav ...]"""
import sys, wave
import numpy as np
SR = 44100
def beep(f, dur=0.16):
    t = np.arange(int(SR*dur))/SR
    tone = np.sin(2*np.pi*f*t) + 0.25*np.sin(2*np.pi*2*f*t)  # soft overtone
    env = np.minimum(1, np.minimum(t/0.01, (dur-t)/0.04))     # click-free attack/release
    return tone*env
def sil(d): return np.zeros(int(SR*d))
group = np.concatenate([beep(880), sil(0.09), beep(880), sil(0.09), beep(1046.5, 0.22), sil(0.55)])
reps = int(np.ceil(8.0/(len(group)/SR)))
sig = np.tile(group, reps)[:SR*8]
sig = sig/np.max(np.abs(sig))*0.7
pcm = (sig*32767).astype('<i2')
for out in (sys.argv[1:] or ['android/app/src/main/res/raw/alarm.wav']):
    with wave.open(out, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('wrote', out)
