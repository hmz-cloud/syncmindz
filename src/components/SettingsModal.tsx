import React, { useState, useEffect } from 'react';
import { 
  X, 
  Volume2, 
  Bell, 
  Smartphone, 
  RotateCcw, 
  ShieldCheck, 
  Play, 
  Check, 
  Cpu,
  Info
} from 'lucide-react';
import { User, AlarmSound } from '../types';
import { playSoundSample } from '../services/audioService';
import { requestNotificationPermission, getNotificationPermission } from '../services/notificationService';

interface SettingsModalProps {
  currentUser: User;
  onClose: () => void;
  onResetData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  onClose,
  onResetData,
}) => {
  const [testSound, setTestSound] = useState<AlarmSound>('radar');
  const [volume, setVolume] = useState(0.8);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');

  useEffect(() => {
    setNotifPerm(getNotificationPermission());
  }, []);

  const handleTestSound = () => {
    playSoundSample(testSound, volume);
  };

  const handleRequestNotif = async () => {
    const p = await requestNotificationPermission();
    setNotifPerm(p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-7 shadow-2xl text-white my-6">
        
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Device & Audio Settings</h3>
              <p className="text-xs text-slate-400">Sync Minds Engine Configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5 text-xs sm:text-sm">
          
          {/* Active Device Info */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Active Registered Device
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{currentUser.deviceName}</p>
                <p className="text-xs text-slate-400">{currentUser.name} ({currentUser.email})</p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Online & Armed
              </span>
            </div>
          </div>

          {/* Sound Synthesizer & Volume */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Audio Synthesis Alarm Engine
            </p>

            <div className="flex items-center gap-3">
              <select
                value={testSound}
                onChange={(e) => setTestSound(e.target.value as AlarmSound)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="radar">Classic Radar Pulse</option>
                <option value="chime">Harmonic Gentle Chime</option>
                <option value="pulse">Sub Tech Pulse</option>
                <option value="siren">Urgent Emergency Siren</option>
                <option value="zen">Zen Singing Bowl</option>
              </select>

              <button
                type="button"
                onClick={handleTestSound}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Test Tone</span>
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Ringing Volume</span>
                <span>{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Browser Notifications Permission */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-white">Browser System Alerts</span>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                  notifPerm === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {notifPerm}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Allows Sync Minds to push alarms even when your browser tab is minimized or in the background.
            </p>
            {notifPerm !== 'granted' && (
              <button
                onClick={handleRequestNotif}
                className="mt-1 w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all"
              >
                Enable System Notifications
              </button>
            )}
          </div>

          {/* Reset Demo Data */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-white text-xs">Reset All Data</p>
              <p className="text-[10px] text-slate-400">Restore default demo circles and alarms</p>
            </div>
            <button
              onClick={onResetData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700 text-xs font-semibold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Data</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
