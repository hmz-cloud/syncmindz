import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Clock, 
  Volume2, 
  Bell, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  Play, 
  Sparkles,
  Zap
} from 'lucide-react';
import { User, SyncItemType, ItemCategory, AlarmSound } from '../types';
import { checkAutoAcceptPermission } from '../services/storageService';
import { playSoundSample, getAudioContext } from '../services/audioService';
import { UserAvatar } from './UserAvatar';

interface SendItemModalProps {
  currentUser: User;
  users: User[];
  preselectedUserId?: string;
  onClose: () => void;
  onSend: (itemData: {
    receiverId: string;
    type: SyncItemType;
    title: string;
    notes?: string;
    targetDateTime: string;
    category: ItemCategory;
    alarmSound: AlarmSound;
    repeat?: 'none' | 'daily' | 'weekdays' | 'weekly';
    ringVolume: number;
  }) => void;
}

export const SendItemModal: React.FC<SendItemModalProps> = ({
  currentUser,
  users,
  preselectedUserId,
  onClose,
  onSend,
}) => {
  const recipients = users.filter((u) => u.id !== currentUser.id);

  const [receiverId, setReceiverId] = useState(
    preselectedUserId && preselectedUserId !== currentUser.id 
      ? preselectedUserId 
      : recipients[0]?.id || ''
  );
  const [type, setType] = useState<SyncItemType>('alarm');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  // Default to 15 minutes from now
  const defaultDate = new Date(Date.now() + 15 * 60 * 1000);
  const toLocalISO = (d: Date) => {
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [dateTimeString, setDateTimeString] = useState(toLocalISO(defaultDate));
  const [category, setCategory] = useState<ItemCategory>('meds');
  const [alarmSound, setAlarmSound] = useState<AlarmSound>('radar');
  const [ringVolume] = useState(0.85);

  const selectedReceiver = users.find((u) => u.id === receiverId);
  const isAutoAccepted = receiverId ? checkAutoAcceptPermission(receiverId, currentUser.id, type) : false;

  // Quick preset shortcuts
  const applyPresetMinutes = (min: number) => {
    getAudioContext(); // Unlock audio
    const target = new Date(Date.now() + min * 60 * 1000);
    setDateTimeString(toLocalISO(target));
  };

  const applySecondsPreset = (sec: number) => {
    getAudioContext(); // Unlock audio
    const target = new Date(Date.now() + sec * 1000);
    setDateTimeString(toLocalISO(target));
  };

  const applyTomorrowMorning = () => {
    getAudioContext();
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(8, 0, 0, 0);
    setDateTimeString(toLocalISO(target));
  };

  const quickIdeas = [
    { label: 'Take Medication', type: 'alarm' as const, cat: 'meds' as const, sound: 'radar' as const },
    { label: 'Wake up for Exam!', type: 'alarm' as const, cat: 'urgent' as const, sound: 'siren' as const },
    { label: 'Leave now to beat traffic', type: 'reminder' as const, cat: 'work' as const, sound: 'chime' as const },
    { label: 'Family Dinner', type: 'calendar' as const, cat: 'family' as const, sound: 'zen' as const },
    { label: 'Drink water & stretch', type: 'reminder' as const, cat: 'health' as const, sound: 'chime' as const },
  ];

  const handleTestSound = () => {
    playSoundSample(alarmSound, 0.85);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !receiverId) return;

    onSend({
      receiverId,
      type,
      title: title.trim(),
      notes: notes.trim(),
      targetDateTime: new Date(dateTimeString).toISOString(),
      category,
      alarmSound,
      repeat: 'none',
      ringVolume,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-lg my-6 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-900">
              Send to a Friend's Phone
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set a reminder or alarm that rings autonomously on their device
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          
          {/* Step 1: Who receives it? */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              1. Choose Recipient
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {recipients.map((rec) => {
                const auto = checkAutoAcceptPermission(rec.id, currentUser.id, type);
                const isSelected = rec.id === receiverId;
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => setReceiverId(rec.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/70 text-slate-700'
                    }`}
                  >
                    <UserAvatar name={rec.name} avatar={rec.avatar} color={rec.color} size="sm" isOnline={rec.isOnline} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-slate-900">{rec.name.split(' ')[0]}</p>
                      <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${auto ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {auto ? <ShieldCheck className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                        {auto ? 'Auto-Accept' : 'Ask First'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Auto-accept confirmation note */}
            {selectedReceiver && (
              <div className={`mt-2.5 p-3 rounded-2xl border text-xs flex items-center gap-2.5 ${
                isAutoAccepted 
                  ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-800' 
                  : 'bg-amber-50/80 border-amber-200/80 text-amber-800'
              }`}>
                {isAutoAccepted ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Auto-Accept is ON:</strong> Rings directly on {selectedReceiver.name.split(' ')[0]}'s phone without delay.</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span><strong>Requires Approval:</strong> {selectedReceiver.name.split(' ')[0]} will get a 1-tap confirmation prompt.</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Step 2: What is the reminder/alarm? */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              2. What should it say?
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Take Blood Pressure Meds, Wake up for exam..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />

            {/* Quick preset idea chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickIdeas.map((idea) => (
                <button
                  key={idea.label}
                  type="button"
                  onClick={() => {
                    setTitle(idea.label);
                    setType(idea.type);
                    setCategory(idea.cat);
                    setAlarmSound(idea.sound);
                  }}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                >
                  + {idea.label}
                </button>
              ))}
            </div>

            {/* Optional note */}
            <input
              type="text"
              placeholder="Optional message: 'With a tall glass of water'..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Trigger Type Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Trigger Intensity
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('alarm')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  type === 'alarm'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Audio Alarm</span>
              </button>

              <button
                type="button"
                onClick={() => setType('reminder')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  type === 'reminder'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Bell className="w-3.5 h-3.5 text-blue-500" />
                <span>Chime Alert</span>
              </button>

              <button
                type="button"
                onClick={() => setType('calendar')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  type === 'calendar'
                    ? 'bg-purple-50 border-purple-500 text-purple-700 ring-2 ring-purple-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-purple-500" />
                <span>Calendar Slot</span>
              </button>
            </div>
          </div>

          {/* Step 3: When should it ring? */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-600">
                3. When to Ring
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applySecondsPreset(10)}
                  className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all cursor-pointer"
                  title="Test in 10 seconds"
                >
                  ⚡ Test in 10s
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetMinutes(15)}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={applyTomorrowMorning}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                >
                  Tomorrow 8am
                </button>
              </div>
            </div>

            <input
              type="datetime-local"
              required
              value={dateTimeString}
              onChange={(e) => setDateTimeString(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sound selector with instant preview */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-700">Ringtone Tone:</span>
              <select
                value={alarmSound}
                onChange={(e) => setAlarmSound(e.target.value as AlarmSound)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-medium focus:outline-none"
              >
                <option value="radar">Classic Radar</option>
                <option value="chime">Friendly Chime</option>
                <option value="pulse">Sub-Pulse</option>
                <option value="siren">Urgent Siren</option>
                <option value="zen">Zen Bowl</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleTestSound}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
            >
              <Play className="w-3 h-3 fill-blue-600" />
              <span>Test</span>
            </button>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition-all cursor-pointer active:scale-98"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Arm on {selectedReceiver?.name.split(' ')[0] || 'Phone'}'s Device</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
