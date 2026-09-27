import React, { useState } from 'react';
import { 
  Volume2, 
  Bell, 
  Calendar, 
  Clock, 
  Check, 
  ShieldCheck, 
  Send,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { SyncItem } from '../types';
import { UserAvatar } from './UserAvatar';

interface RingingOverlayProps {
  ringingItem: SyncItem;
  onDismiss: (itemId: string, responseNote?: string) => void;
  onSnooze: (itemId: string, minutes?: number) => void;
}

export const RingingOverlay: React.FC<RingingOverlayProps> = ({
  ringingItem,
  onDismiss,
  onSnooze,
}) => {
  const [responseNote, setResponseNote] = useState('');
  const [quickReplies] = useState([
    'Done! Thanks ❤️',
    'I took it / did it right now!',
    'Awake & on it!',
    'Heading out now!',
  ]);

  const isAlarm = ringingItem.type === 'alarm';
  const isReminder = ringingItem.type === 'reminder';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-300">
      
      {/* Background pulsing sound rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[500px] h-[500px] rounded-full border border-blue-500/20 animate-ping duration-1000" />
        <div className="w-[360px] h-[360px] rounded-full border border-blue-400/30 animate-pulse" />
        <div className="w-[220px] h-[220px] rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-900 z-10 text-center">
        
        {/* Status Top Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold mb-4">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>{isAlarm ? 'AUTONOMOUS PHONE ALARM' : isReminder ? 'REMINDER CHIME' : 'EVENT TRIGGER'}</span>
        </div>

        {/* Sender Info Banner */}
        <div className="flex items-center justify-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-6">
          <UserAvatar
            name={ringingItem.senderName}
            avatar={ringingItem.senderAvatar}
            size="md"
          />
          <div className="text-left">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Triggered On Your Device By
            </p>
            <p className="text-sm font-bold text-slate-900">
              {ringingItem.senderName}
            </p>
          </div>
          {ringingItem.autoAccepted && (
            <span className="ml-auto text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Auto
            </span>
          )}
        </div>

        {/* Main Alarm Icon & Title */}
        <div className="my-5">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-inner">
            {isAlarm ? <Volume2 className="w-8 h-8 animate-bounce" /> : <Bell className="w-8 h-8" />}
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
            {ringingItem.title}
          </h2>

          {ringingItem.notes && (
            <p className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              "{ringingItem.notes}"
            </p>
          )}

          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Tone: <strong className="capitalize text-slate-700">{ringingItem.alarmSound}</strong></span>
          </div>
        </div>

        {/* Quick Reply Note to Sender */}
        <div className="my-4 text-left space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-500">
            Send a quick note back to {ringingItem.senderName.split(' ')[0]}:
          </label>
          <div className="flex flex-wrap gap-1">
            {quickReplies.map((qr) => (
              <button
                key={qr}
                type="button"
                onClick={() => setResponseNote(qr)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  responseNote === qr
                    ? 'bg-blue-600 text-white border-blue-600 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {qr}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Actions: Turn Off & Snooze */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            onClick={() => onSnooze(ringingItem.id, 5)}
            className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer active:scale-98"
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Snooze (5m)</span>
          </button>

          <button
            onClick={() => onDismiss(ringingItem.id, responseNote)}
            className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>Turn Off & Done</span>
          </button>
        </div>

        <p className="mt-4 text-[11px] text-slate-400">
          Sync Minds autonomous triggering prevents missed reminders.
        </p>

      </div>
    </div>
  );
};
