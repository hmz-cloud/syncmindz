import React, { useState, useEffect, useRef } from 'react';
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
  MessageSquare,
  ArrowUpDown,
  ChevronDown,
  AlertTriangle,
  History,
  Filter,
  Tag,
  X
} from 'lucide-react';
import { SyncItem, User, ItemCategory } from '../types';
import { playSoundSample, getAudioContext } from '../services/audioService';
import { UserAvatar } from './UserAvatar';

export type SortOption = 'upcoming' | 'urgent' | 'recent';

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
  const [sortBy, setSortBy] = useState<SortOption>('upcoming');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ItemCategory>('all');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false);
      }
    };
    if (sortDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [sortDropdownOpen]);

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

  // Filter items by active tab (incoming, sent, or all)
  const baseItems = items.filter((item) => {
    if (filterTab === 'incoming') {
      return item.receiverId === currentUser.id && item.status !== 'rejected';
    }
    if (filterTab === 'sent') {
      return item.senderId === currentUser.id;
    }
    return item.status !== 'rejected';
  });

  // Filter and sort items according to selected sort option and category
  const sortedItems = baseItems
    .filter((item) => {
      // 1. Explicit Category Filter chip
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      // 2. When 'urgent' is selected in the dropdown, filter by category:
      // Isolate urgent, medication, or alarm triggers
      if (sortBy === 'urgent') {
        const isUrgent = item.category === 'urgent' || item.category === 'meds' || item.type === 'alarm' || item.status === 'ringing';
        return isUrgent;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'upcoming') {
        // Sort by scheduled target date (soonest upcoming first)
        return new Date(a.targetDateTime).getTime() - new Date(b.targetDateTime).getTime();
      }
      if (sortBy === 'urgent') {
        // Sort by category urgency score first, then by target date
        const getUrgencyScore = (item: SyncItem) => {
          let score = 0;
          if (item.status === 'ringing') score += 500;
          if (item.category === 'urgent') score += 200;
          if (item.category === 'meds') score += 100;
          if (item.type === 'alarm') score += 50;
          return score;
        };
        const scoreDiff = getUrgencyScore(b) - getUrgencyScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(a.targetDateTime).getTime() - new Date(b.targetDateTime).getTime();
      }
      if (sortBy === 'recent') {
        // Sort by most recently created date (newest first)
        const timeA = new Date(a.createdAt || a.targetDateTime).getTime();
        const timeB = new Date(b.createdAt || b.targetDateTime).getTime();
        return timeB - timeA;
      }
      return 0;
    });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* 1-Tap Quick Send Bar to Friends & Family - Senior & Multi-Age Friendly */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Quick Send to a Mind
          </span>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => onOpenSendModal(contact.id)}
                className="flex items-center gap-2 px-3 py-1.5 min-h-[42px] rounded-full bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-300 transition-all cursor-pointer group active:scale-95 shadow-2xs"
                title={`Send an alarm to ${contact.name}'s phone`}
                aria-label={`Send alarm to ${contact.name}`}
              >
                <UserAvatar
                  name={contact.name}
                  avatar={contact.avatar}
                  color={contact.color}
                  size="sm"
                />
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 block leading-tight">
                    {contact.name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-400 block leading-none">
                    {contact.relationship ? contact.relationship.split(' ')[0] : 'Mind'}
                  </span>
                </div>
                <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 ml-0.5" />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onOpenSendModal()}
          className="hidden sm:inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition-all cursor-pointer active:scale-98 shrink-0 min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>New Reminder or Alarm</span>
        </button>
      </div>

      {/* Filter Tabs and Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterTab('incoming')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'incoming'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Phone Triggers
          </button>
          <button
            onClick={() => setFilterTab('sent')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'sent'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Sent by Me
          </button>
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-slate-200 text-slate-800'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            All
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          {/* Sorting Dropdown Component */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer"
              title="Sort triggers by Upcoming, Urgent, or Recent"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Sort: <strong className="text-slate-900 font-bold capitalize">{sortBy}</strong></span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {sortDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-30 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Sort & Filter By
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('upcoming');
                    setSortDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                    sortBy === 'upcoming'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 text-left">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">Upcoming</p>
                      <p className="text-[10px] text-slate-400 font-normal">By Date · Soonest first</p>
                    </div>
                  </div>
                  {sortBy === 'upcoming' && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSortBy('urgent');
                    setSortDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                    sortBy === 'urgent'
                      ? 'bg-rose-50 text-rose-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 text-left">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">Urgent</p>
                      <p className="text-[10px] text-rose-600 font-medium">By Category · Urgent & Meds</p>
                    </div>
                  </div>
                  {sortBy === 'urgent' && <Check className="w-3.5 h-3.5 text-rose-600 shrink-0 ml-1" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSortBy('recent');
                    setSortDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                    sortBy === 'recent'
                      ? 'bg-purple-50 text-purple-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 text-left">
                    <History className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">Recent</p>
                      <p className="text-[10px] text-slate-400 font-normal">By Date · Newest added</p>
                    </div>
                  </div>
                  {sortBy === 'recent' && <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 ml-1" />}
                </button>
              </div>
            )}
          </div>

          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
            {sortedItems.length} {sortedItems.length === 1 ? 'Trigger' : 'Triggers'}
          </span>
        </div>
      </div>

      {/* Category Quick Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
          <Tag className="w-3 h-3 text-slate-400" /> Filter Category:
        </span>
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
            categoryFilter === 'all'
              ? 'bg-slate-800 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setCategoryFilter('urgent')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
            categoryFilter === 'urgent'
              ? 'bg-rose-600 text-white shadow-2xs'
              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
          }`}
        >
          🚨 Urgent
        </button>
        <button
          onClick={() => setCategoryFilter('meds')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
            categoryFilter === 'meds'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
          }`}
        >
          💊 Meds
        </button>
        <button
          onClick={() => setCategoryFilter('family')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
            categoryFilter === 'family'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          👥 Family
        </button>
        <button
          onClick={() => setCategoryFilter('work')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
            categoryFilter === 'work'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
          }`}
        >
          💼 Work
        </button>
        <button
          onClick={() => setCategoryFilter('health')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
            categoryFilter === 'health'
              ? 'bg-teal-600 text-white shadow-2xs'
              : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
          }`}
        >
          ❤️ Health
        </button>
      </div>

      {/* Active Filter/Sort Notification Pill */}
      {(sortBy === 'urgent' || categoryFilter !== 'all') && (
        <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs font-medium animate-in fade-in">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              {sortBy === 'urgent' ? (
                <>Filtering by <strong>Urgent & Meds Category</strong> ({sortedItems.length} found)</>
              ) : (
                <>Filtered by <strong>{categoryFilter}</strong> category ({sortedItems.length} found)</>
              )}
            </span>
          </div>
          <button
            onClick={() => {
              setSortBy('upcoming');
              setCategoryFilter('all');
            }}
            className="flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
          >
            <span>Reset to All</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Minimalist Cards Grid */}
      <div className="space-y-3">
        {sortedItems.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white border border-slate-200/80 text-center text-slate-500 shadow-xs">
            <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <h4 className="text-sm font-bold text-slate-800">No triggers matching this filter</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {sortBy === 'urgent' || categoryFilter !== 'all' 
                ? 'Try resetting the filter or switching sort modes to view all triggers.' 
                : 'Tap a friend\'s name above or click "New Reminder or Alarm" to set an autonomous trigger!'}
            </p>
            {(sortBy === 'urgent' || categoryFilter !== 'all') && (
              <button
                onClick={() => {
                  setSortBy('upcoming');
                  setCategoryFilter('all');
                }}
                className="mt-3 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
              >
                Show All Triggers
              </button>
            )}
          </div>
        ) : (
          sortedItems.map((item) => {
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
                      className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all cursor-pointer"
                      title="Preview Alarm Tone"
                      aria-label="Preview Alarm Tone"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    {/* Ring Immediately Test */}
                    <button
                      onClick={() => onTriggerNow(item)}
                      className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all cursor-pointer"
                      title="Ring right now to test autonomous screen"
                      aria-label="Ring alarm now"
                    >
                      <Play className="w-3.5 h-3.5 fill-blue-600 text-blue-600" />
                      <span>Ring Now</span>
                    </button>

                    {/* Acknowledge Button */}
                    {item.status !== 'acknowledged' && item.receiverId === currentUser.id && (
                      <button
                        onClick={() => onAcknowledge(item.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                        aria-label="Mark task done"
                      >
                        <Check className="w-4 h-4" />
                        <span>Done</span>
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      title="Delete trigger"
                      aria-label="Delete trigger"
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
