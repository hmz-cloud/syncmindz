import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  Bell, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  Check, 
  Trash2, 
  Plus, 
  Smartphone,
  Play,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { SyncItem, User } from '../types';
import { playSoundSample, getAudioContext } from '../services/audioService';
import { UserAvatar } from './UserAvatar';

interface RemindersAlarmsViewProps {
  items: SyncItem[];
  currentUser: User;
  users: User[];
  onOpenSendModal: (preselectedUserId?: string) => void;
  onTriggerNow: (item: SyncItem) => void;
  onDelete: (itemId: string) => void;
  onAcknowledge: (itemId: string) => void;
}

export const RemindersAlarmsView: React.FC<RemindersAlarmsViewProps> = ({
  items,
  currentUser,
  users,
  onOpenSendModal,
  onTriggerNow,
  onDelete,
  onAcknowledge,
}) => {
  const [filterTab, setFilterTab] = useState<'incoming' | 'sent' | 'all'>('incoming');
  const [now, setNow] = useState(Date.now());

  // Update clock every second for live countdown tickers
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (targetIso: string) => {
    const diffMs = new Date(targetIso).getTime() - now;
    if (diffMs <= 0) {
      const pastMin = Math.floor(Math.abs(diffMs) / 60000);
      return pastMin === 0 ? 'Due right now' : `${pastMin}m ago`;
    }
    const diffSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `In ${days}d`;
    }
    if (hours > 0) {
      return `In ${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `In ${mins}m ${secs}s`;
    }
    return `In ${secs}s`;
  };

  const handleTestSound = (sound: SyncItem['alarmSound']) => {
    getAudioContext();
    playSoundSample(sound, 0.85);
  };

  const contacts = users.filter((u) => u.id !== currentUser.id);

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filterTab === 'incoming') {
      return item.receiverId === currentUser.id && item.status !== 'rejected';
    }
    if (filterTab === 'sent') {
      return item.senderId === currentUser.id;
    }
    return item.status !== 'rejected';
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* 1-Tap Quick Send Bar to Friends & Family */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Quick Send to a Mind
          </span>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => onOpenSendModal(contact.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-300 transition-all cursor-pointer group"
                title={`Send an alarm to ${contact.name}'s phone`}
              >
                <UserAvatar
                  name={contact.name}
                  avatar={contact.avatar}
                  color={contact.color}
                  size="xs"
                />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700">
                  {contact.name.split(' ')[0]}
                </span>
                <Plus className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onOpenSendModal()}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition-all cursor-pointer active:scale-98 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Reminder or Alarm</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterTab('incoming')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'incoming'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Phone Triggers
          </button>
          <button
            onClick={() => setFilterTab('sent')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'sent'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Sent by Me
          </button>
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              filterTab === 'all'
                ? 'bg-slate-200 text-slate-800'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            All
          </button>
        </div>

        <span className="text-xs text-slate-400 font-medium">
          {filteredItems.length} {filteredItems.length === 1 ? 'Trigger' : 'Triggers'}
        </span>
      </div>

      {/* Minimalist Cards Grid */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white border border-slate-200/80 text-center text-slate-500 shadow-xs">
            <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <h4 className="text-sm font-bold text-slate-800">No triggers scheduled</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Tap a friend's name above or click "New Reminder or Alarm" to set an autonomous trigger!
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isAlarm = item.type === 'alarm';
            const isReminder = item.type === 'reminder';
            const isSentByMe = item.senderId === currentUser.id;
            const targetDate = new Date(item.targetDateTime);
            const isDueSoon = targetDate.getTime() - now < 30 * 60 * 1000 && targetDate.getTime() > now;
            const isPast = targetDate.getTime() <= now;

            const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = targetDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

            return (
              <div
                key={item.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                  item.status === 'ringing'
                    ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/30 shadow-md'
                    : item.status === 'acknowledged'
                    ? 'bg-slate-50/70 border-slate-200/60 opacity-80'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  
                  {/* Left info */}
                  <div className="flex items-start gap-3.5">
                    {/* Time Box */}
                    <div className="text-center bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-2 shrink-0">
                      <p className="text-sm font-extrabold text-slate-900 font-mono tracking-tight">
                        {timeStr}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                        {dateStr}
                      </p>
                    </div>

                    <div>
                      {/* Chips & Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          isAlarm 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : isReminder 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {item.type}
                        </span>

                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          isPast 
                            ? 'bg-slate-100 text-slate-600' 
                            : isDueSoon 
                            ? 'bg-amber-100 text-amber-800 font-extrabold animate-pulse' 
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {formatCountdown(item.targetDateTime)}
                        </span>

                        {item.autoAccepted && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" /> Auto-Accepted
                          </span>
                        )}

                        {item.status === 'acknowledged' && (
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                            ✓ Done
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-base font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h4>

                      {/* Notes */}
                      {item.notes && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          "{item.notes}"
                        </p>
                      )}

                      {/* Sender / Receiver Info */}
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                        {isSentByMe ? (
                          <span>Sent to <strong>{item.receiverName}</strong></span>
                        ) : (
                          <span>⚡ Sent by <strong>{item.senderName}</strong> to your phone</span>
                        )}
                        <span>·</span>
                        <span className="capitalize">Sound: {item.alarmSound}</span>
                      </div>

                      {/* Acknowledgement response note */}
                      {item.responseNote && (
                        <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Note from {item.receiverName.split(' ')[0]}: "{item.responseNote}"</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    
                    {/* Audio Preview Button */}
                    <button
                      onClick={() => handleTestSound(item.alarmSound)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                      title="Preview Alarm Tone"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    {/* Ring Immediately Test */}
                    <button
                      onClick={() => onTriggerNow(item)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all cursor-pointer"
                      title="Ring right now to test autonomous screen"
                    >
                      <Play className="w-3 h-3 fill-blue-600 text-blue-600" />
                      <span>Ring Now</span>
                    </button>

                    {/* Acknowledge Button */}
                    {item.status !== 'acknowledged' && item.receiverId === currentUser.id && (
                      <button
                        onClick={() => onAcknowledge(item.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
