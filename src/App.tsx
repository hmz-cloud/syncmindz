/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Clock, 
  ShieldCheck, 
  Calendar as CalendarIcon, 
  Plus, 
  Play, 
  Sparkles,
  Smartphone,
  CheckCircle2,
  Volume2
} from 'lucide-react';
import { User, SyncItem, TrustRule, ActivityLog, SyncItemType, ItemCategory, AlarmSound } from './types';
import { 
  getUsers, 
  saveUsers, 
  getCurrentUserId, 
  setCurrentUserId, 
  getTrustRules, 
  saveTrustRules, 
  getSyncItems, 
  saveSyncItems, 
  getActivityLogs, 
  addActivityLog,
  subscribeToSyncChannel,
  checkAutoAcceptPermission,
  pairWithSyncCode,
  INITIAL_USERS
} from './services/storageService';
import { startAlarmLoop, stopAlarmLoop, playSoundSample, getAudioContext } from './services/audioService';
import { triggerSystemNotification } from './services/notificationService';

import { Header } from './components/Header';
import { RingingOverlay } from './components/RingingOverlay';
import { SendItemModal } from './components/SendItemModal';
import { RemindersAlarmsView } from './components/RemindersAlarmsView';
import { TrustedCircleView } from './components/TrustedCircleView';
import { CalendarView } from './components/CalendarView';
import { IncomingApprovalsBanner } from './components/IncomingApprovalsBanner';

export default function App() {
  const [users, setUsers] = useState<User[]>(getUsers());
  const [currentUserId, setCurrentUserIdState] = useState<string>(getCurrentUserId());
  const [items, setItems] = useState<SyncItem[]>(getSyncItems());
  const [trustRules, setTrustRules] = useState<TrustRule[]>(getTrustRules(currentUserId));
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(getActivityLogs());

  const [activeTab, setActiveTab] = useState<'alarms' | 'trusted' | 'calendar'>('alarms');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [preselectedReceiverId, setPreselectedReceiverId] = useState<string | undefined>(undefined);
  const [ringingItem, setRingingItem] = useState<SyncItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const stopAlarmRef = useRef<(() => void) | null>(null);

  const currentUser = users.find((u) => u.id === currentUserId) || users[0] || INITIAL_USERS[0];

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  const refreshData = useCallback(() => {
    setUsers(getUsers());
    const cId = getCurrentUserId();
    setCurrentUserIdState(cId);
    setItems(getSyncItems());
    setTrustRules(getTrustRules(cId));
    setActivityLogs(getActivityLogs());
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSyncChannel(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [refreshData]);

  // Check URL query for pairing PIN (?pin=839402)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get('pin');
    if (pin && pin.length === 6) {
      const res = pairWithSyncCode(pin, currentUserId);
      if (res.success) {
        refreshData();
        showToast(res.message);
      }
    }
  }, [currentUserId, refreshData, showToast]);

  // Audio unlock listener on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      getAudioContext();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  // Switch Active User / Device Simulator
  const handleSwitchUser = (userId: string) => {
    if (stopAlarmRef.current) {
      stopAlarmRef.current();
      stopAlarmRef.current = null;
    }
    setRingingItem(null);

    setCurrentUserId(userId);
    setCurrentUserIdState(userId);
    setTrustRules(getTrustRules(userId));
    showToast(`Active phone: ${users.find((u) => u.id === userId)?.name}`);
  };

  // Autonomous Background Scheduler Loop (checks every second)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const currentItems = getSyncItems();
      let hasUpdates = false;

      currentItems.forEach((item) => {
        if (item.receiverId !== currentUserId) return;

        const targetTime = item.status === 'snoozed' && item.snoozeUntil 
          ? new Date(item.snoozeUntil).getTime() 
          : new Date(item.targetDateTime).getTime();

        if (
          (item.status === 'scheduled' || item.status === 'snoozed') &&
          targetTime <= now
        ) {
          item.status = 'ringing';
          item.triggeredAt = new Date().toISOString();
          hasUpdates = true;

          if (!ringingItem || ringingItem.id !== item.id) {
            setRingingItem(item);
            stopAlarmRef.current = startAlarmLoop(item.alarmSound, item.ringVolume || 0.85);

            triggerSystemNotification(
              item.type === 'alarm' ? `🚨 ALARM: ${item.title}` : `🔔 REMINDER: ${item.title}`,
              {
                body: item.notes || `Sent by ${item.senderName} (Auto-Accepted on your phone)`,
                tag: item.id,
              }
            );

            addActivityLog({
              actorId: item.senderId,
              actorName: item.senderName,
              receiverId: item.receiverId,
              receiverName: item.receiverName,
              type: 'alarm_fired',
              title: `⚡ Autonomous ${item.type.toUpperCase()} Fired`,
              details: `"${item.title}" triggered on ${currentUser.deviceName}.`,
            });
          }
        }
      });

      if (hasUpdates) {
        saveSyncItems(currentItems);
        setItems(currentItems);
        setActivityLogs(getActivityLogs());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUserId, ringingItem, currentUser.deviceName]);

  // Dismiss / Acknowledge Ringing Alarm
  const handleDismissRinging = (itemId: string, responseNote?: string) => {
    if (stopAlarmRef.current) {
      stopAlarmRef.current();
      stopAlarmRef.current = null;
    }
    setRingingItem(null);

    const currentItems = getSyncItems();
    const target = currentItems.find((it) => it.id === itemId);
    if (target) {
      target.status = 'acknowledged';
      target.acknowledgedAt = new Date().toISOString();
      if (responseNote) {
        target.responseNote = responseNote;
      }
      saveSyncItems(currentItems);
      setItems(currentItems);

      addActivityLog({
        actorId: currentUser.id,
        actorName: currentUser.name,
        receiverId: target.senderId,
        receiverName: target.senderName,
        type: 'acknowledged',
        title: `✓ Done: ${target.title}`,
        details: responseNote
          ? `${currentUser.name} turned off alarm and replied: "${responseNote}"`
          : `${currentUser.name} turned off alarm.`,
      });
      setActivityLogs(getActivityLogs());
      showToast('Alarm turned off and marked done.');
    }
  };

  // Snooze Ringing Alarm
  const handleSnoozeRinging = (itemId: string, minutes = 5) => {
    if (stopAlarmRef.current) {
      stopAlarmRef.current();
      stopAlarmRef.current = null;
    }
    setRingingItem(null);

    const currentItems = getSyncItems();
    const target = currentItems.find((it) => it.id === itemId);
    if (target) {
      target.status = 'snoozed';
      target.snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      saveSyncItems(currentItems);
      setItems(currentItems);

      addActivityLog({
        actorId: currentUser.id,
        actorName: currentUser.name,
        receiverId: target.senderId,
        receiverName: target.senderName,
        type: 'snoozed',
        title: `💤 Snoozed for ${minutes}m: ${target.title}`,
        details: `Will ring again at ${new Date(target.snoozeUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });
      setActivityLogs(getActivityLogs());
      showToast(`Snoozed for ${minutes} minutes.`);
    }
  };

  // Quick 5-Second Test Alarm Trigger
  const handleTriggerInstantTestAlarm = () => {
    getAudioContext();
    const now = new Date();
    const target = new Date(now.getTime() + 5000); // 5 seconds ahead
    const sarah = users.find((u) => u.id === 'user_sarah') || users[1];

    const testItem: SyncItem = {
      id: 'test_alarm_' + Date.now(),
      senderId: sarah.id,
      senderName: sarah.name,
      senderAvatar: sarah.avatar,
      receiverId: currentUser.id,
      receiverName: currentUser.name,
      type: 'alarm',
      title: '🚨 Test Autonomous Phone Alarm',
      notes: 'Pushed by Sarah Chen via Sync Minds. Testing zero-delay auto-accept!',
      targetDateTime: target.toISOString(),
      category: 'urgent',
      alarmSound: 'radar',
      status: 'scheduled',
      autoAccepted: true,
      repeat: 'none',
      createdAt: now.toISOString(),
      ringVolume: 0.9,
    };

    const currentItems = getSyncItems();
    currentItems.unshift(testItem);
    saveSyncItems(currentItems);
    setItems(currentItems);

    addActivityLog({
      actorId: sarah.id,
      actorName: sarah.name,
      receiverId: currentUser.id,
      receiverName: currentUser.name,
      type: 'auto_accept',
      title: '⚡ Test Alarm Armed (5s Countdown)',
      details: 'Instant test alarm scheduled to ring in 5 seconds to test audio & overlay.',
    });
    setActivityLogs(getActivityLogs());

    showToast('🚨 Test Alarm armed! Watch it trigger in 5 seconds...');
  };

  const handleImmediateRing = (item: SyncItem) => {
    getAudioContext();
    if (stopAlarmRef.current) {
      stopAlarmRef.current();
    }
    setRingingItem(item);
    stopAlarmRef.current = startAlarmLoop(item.alarmSound, item.ringVolume || 0.85);
  };

  const handleSendItem = (data: {
    receiverId: string;
    type: SyncItemType;
    title: string;
    notes?: string;
    targetDateTime: string;
    category: ItemCategory;
    alarmSound: AlarmSound;
    repeat?: 'none' | 'daily' | 'weekdays' | 'weekly';
    ringVolume: number;
  }) => {
    const receiver = users.find((u) => u.id === data.receiverId);
    if (!receiver) return;

    const isAutoAccept = checkAutoAcceptPermission(data.receiverId, currentUser.id, data.type);

    const newItem: SyncItem = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      receiverId: receiver.id,
      receiverName: receiver.name,
      type: data.type,
      title: data.title,
      notes: data.notes,
      targetDateTime: data.targetDateTime,
      category: data.category,
      alarmSound: data.alarmSound,
      status: isAutoAccept ? 'scheduled' : 'pending_approval',
      autoAccepted: isAutoAccept,
      repeat: data.repeat || 'none',
      createdAt: new Date().toISOString(),
      ringVolume: data.ringVolume,
    };

    const currentItems = getSyncItems();
    currentItems.unshift(newItem);
    saveSyncItems(currentItems);
    setItems(currentItems);

    addActivityLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      receiverId: receiver.id,
      receiverName: receiver.name,
      type: isAutoAccept ? 'auto_accept' : 'approval_needed',
      title: isAutoAccept 
        ? `⚡ Auto-Accepted: ${data.title}` 
        : `⏳ Approval Requested: ${data.title}`,
      details: isAutoAccept
        ? `${currentUser.name} pushed an auto-accepted ${data.type} to ${receiver.name}'s ${receiver.deviceName}.`
        : `${currentUser.name} sent a ${data.type} to ${receiver.name} awaiting manual confirmation.`,
    });
    setActivityLogs(getActivityLogs());

    setIsSendModalOpen(false);
    setPreselectedReceiverId(undefined);

    if (isAutoAccept) {
      showToast(`✓ Auto-Accepted! Armed on ${receiver.name.split(' ')[0]}'s phone.`);
    } else {
      showToast(`Sent! Awaiting confirmation from ${receiver.name.split(' ')[0]}.`);
    }
  };

  const handleApprovePending = (itemId: string, andTrustSender = false) => {
    const currentItems = getSyncItems();
    const item = currentItems.find((it) => it.id === itemId);
    if (!item) return;

    item.status = 'scheduled';
    item.autoAccepted = andTrustSender;
    saveSyncItems(currentItems);
    setItems(currentItems);

    if (andTrustSender) {
      const rules = getTrustRules(currentUser.id);
      const existing = rules.find((r) => r.targetUserId === item.senderId);
      if (existing) {
        existing.level = 'auto_accept';
        existing.allowAlarms = true;
        existing.allowCalendar = true;
        existing.allowReminders = true;
        existing.allowLoudOverride = true;
      } else {
        rules.push({
          targetUserId: item.senderId,
          level: 'auto_accept',
          allowAlarms: true,
          allowCalendar: true,
          allowReminders: true,
          allowLoudOverride: true,
          updatedAt: new Date().toISOString(),
        });
      }
      saveTrustRules(currentUser.id, rules);
      setTrustRules(rules);
    }

    addActivityLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      receiverId: item.senderId,
      receiverName: item.senderName,
      type: 'manual_accept',
      title: `✓ Approved: ${item.title}`,
      details: andTrustSender
        ? `${currentUser.name} approved the item and gave ${item.senderName} Auto-Accept access!`
        : `${currentUser.name} approved the item.`,
    });
    setActivityLogs(getActivityLogs());

    showToast(andTrustSender ? `Approved & ${item.senderName.split(' ')[0]} can now Auto-Accept!` : 'Approved & armed on your phone.');
  };

  const handleRejectPending = (itemId: string) => {
    const currentItems = getSyncItems();
    const item = currentItems.find((it) => it.id === itemId);
    if (!item) return;

    item.status = 'rejected';
    saveSyncItems(currentItems);
    setItems(currentItems);
    showToast('Declined request.');
  };

  const handleUpdateTrustRule = (targetUserId: string, updates: Partial<TrustRule>) => {
    const rules = [...trustRules];
    const idx = rules.findIndex((r) => r.targetUserId === targetUserId);
    const targetUser = users.find((u) => u.id === targetUserId);

    if (idx >= 0) {
      rules[idx] = { ...rules[idx], ...updates, updatedAt: new Date().toISOString() };
    } else {
      rules.push({
        targetUserId,
        level: 'require_approval',
        allowAlarms: false,
        allowCalendar: true,
        allowReminders: true,
        allowLoudOverride: false,
        updatedAt: new Date().toISOString(),
        ...updates,
      });
    }

    saveTrustRules(currentUser.id, rules);
    setTrustRules(rules);
    showToast(`Updated trust settings for ${targetUser?.name || 'Contact'}`);
  };

  const handleAddContact = (contact: { name: string; email: string; deviceName: string; autoAccept: boolean }) => {
    const newId = 'user_' + Date.now().toString(36);
    const colors = ['#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4'];
    const newUser: User = {
      id: newId,
      name: contact.name,
      email: contact.email,
      avatar: `https://images.unsplash.com/photo-${1535713875002 + Math.floor(Math.random() * 1000)}?auto=format&fit=crop&w=256&q=80`,
      deviceName: contact.deviceName,
      color: colors[users.length % colors.length],
      syncCode: Math.floor(100000 + Math.random() * 900000).toString(),
      relationship: 'Friend',
      isOnline: true,
    };

    const updatedUsers = [...users, newUser];
    saveUsers(updatedUsers);
    setUsers(updatedUsers);

    if (contact.autoAccept) {
      handleUpdateTrustRule(newId, {
        level: 'auto_accept',
        allowAlarms: true,
        allowCalendar: true,
        allowReminders: true,
        allowLoudOverride: true,
      });
    }

    showToast(`Added ${contact.name} to Sync Minds!`);
  };

  const handleDeleteItem = (itemId: string) => {
    const updated = items.filter((it) => it.id !== itemId);
    saveSyncItems(updated);
    setItems(updated);
    showToast('Trigger removed.');
  };

  const handleAcknowledge = (itemId: string) => {
    const updated = items.map((it) => {
      if (it.id === itemId) {
        return {
          ...it,
          status: 'acknowledged' as const,
          acknowledgedAt: new Date().toISOString(),
        };
      }
      return it;
    });
    saveSyncItems(updated);
    setItems(updated);
    showToast('Marked as done!');
  };

  const handleOpenSendModalWithTarget = (targetUserId?: string) => {
    setPreselectedReceiverId(targetUserId);
    setIsSendModalOpen(true);
  };

  const pendingApprovals = items.filter(
    (it) => it.receiverId === currentUser.id && it.status === 'pending_approval'
  );

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-20 sm:pb-8">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white font-medium text-xs sm:text-sm shadow-xl border border-slate-700 animate-in slide-in-from-top-3">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        users={users}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        onOpenSendModal={() => handleOpenSendModalWithTarget()}
        onTriggerInstantTestAlarm={handleTriggerInstantTestAlarm}
        pendingApprovalsCount={pendingApprovals.length}
        activeRingingCount={ringingItem ? 1 : 0}
      />

      {/* Clean 3-Tab Bar (Desktop/Tablet) */}
      <div className="hidden sm:block bg-white border-b border-slate-200/80 sticky top-16 sm:top-18 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between overflow-x-auto py-2 gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setActiveTab('alarms')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'alarms'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Alarms & Reminders</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'alarms' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {items.filter((it) => it.receiverId === currentUser.id && it.status !== 'rejected').length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('trusted')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'trusted'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>My People & Auto-Accept</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  {trustRules.filter((r) => r.level === 'auto_accept').length} Auto
                </span>
              </button>

              <button
                onClick={() => setActiveTab('calendar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'calendar'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                <span>Calendar</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span>PIN: <strong className="font-mono text-slate-800">{currentUser.syncCode}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {/* Approvals Banner */}
        <IncomingApprovalsBanner
          pendingItems={pendingApprovals}
          onApprove={handleApprovePending}
          onReject={handleRejectPending}
        />

        {/* Tab Content */}
        {activeTab === 'alarms' && (
          <RemindersAlarmsView
            items={items}
            currentUser={currentUser}
            users={users}
            onOpenSendModal={handleOpenSendModalWithTarget}
            onTriggerNow={handleImmediateRing}
            onDelete={handleDeleteItem}
            onAcknowledge={handleAcknowledge}
          />
        )}

        {activeTab === 'trusted' && (
          <TrustedCircleView
            currentUser={currentUser}
            users={users}
            trustRules={trustRules}
            onUpdateRule={handleUpdateTrustRule}
            onAddContact={handleAddContact}
            onQuickSendToContact={handleOpenSendModalWithTarget}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            items={items}
            currentUser={currentUser}
            onOpenSendModal={() => handleOpenSendModalWithTarget()}
            onTriggerNow={handleImmediateRing}
          />
        )}

      </main>

      {/* Lockscreen Ringing Overlay when an alarm or reminder triggers */}
      {ringingItem && (
        <RingingOverlay
          ringingItem={ringingItem}
          onDismiss={handleDismissRinging}
          onSnooze={handleSnoozeRinging}
        />
      )}

      {/* Send Alarm / Reminder Modal */}
      {isSendModalOpen && (
        <SendItemModal
          currentUser={currentUser}
          users={users}
          preselectedUserId={preselectedReceiverId}
          onClose={() => {
            setIsSendModalOpen(false);
            setPreselectedReceiverId(undefined);
          }}
          onSend={handleSendItem}
        />
      )}

      {/* Mobile Bottom Thumb Navigation - Accessible, 48px+ Tap Targets for all ages */}
      <nav 
        aria-label="Mobile Navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-1.5 flex items-center justify-around shadow-lg"
      >
        <button
          onClick={() => setActiveTab('alarms')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 min-h-[48px] rounded-xl transition-all cursor-pointer ${
            activeTab === 'alarms' 
              ? 'text-blue-600 font-extrabold' 
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
          aria-label="Alarms and Reminders Tab"
        >
          <Clock className={`w-5 h-5 ${activeTab === 'alarms' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
          <span className="text-[11px] mt-0.5">Alarms</span>
        </button>

        {/* Floating Center Send Button */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            onClick={() => handleOpenSendModalWithTarget()}
            className="w-13 h-13 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/35 active:scale-95 transition-all cursor-pointer ring-4 ring-white"
            aria-label="Send New Reminder or Alarm"
            title="Send New Reminder or Alarm"
          >
            <Plus className="w-6 h-6 stroke-[2.5px]" />
          </button>
        </div>

        <button
          onClick={() => setActiveTab('trusted')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 min-h-[48px] rounded-xl transition-all cursor-pointer ${
            activeTab === 'trusted' 
              ? 'text-blue-600 font-extrabold' 
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
          aria-label="My People and Auto-Accept Tab"
        >
          <ShieldCheck className={`w-5 h-5 ${activeTab === 'trusted' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
          <span className="text-[11px] mt-0.5">My People</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 min-h-[48px] rounded-xl transition-all cursor-pointer ${
            activeTab === 'calendar' 
              ? 'text-blue-600 font-extrabold' 
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
          aria-label="Calendar Tab"
        >
          <CalendarIcon className={`w-5 h-5 ${activeTab === 'calendar' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
          <span className="text-[11px] mt-0.5">Calendar</span>
        </button>
      </nav>

    </div>
  );
}
